// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshremote

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

const (
	GitCmdTimeout       = 30 * time.Second
	GitMaxOutputBytes   = 32 * 1024 * 1024
	GitMaxStderrBytes   = 16 * 1024
	GitMaxStatusFiles   = 5000
	GitMaxCommitFiles   = 5000
	GitDefaultLogLimit  = 200
	GitMaxLogLimit      = 1000
	GitMaxDiffFileBytes = 1024 * 1024
	GitBinarySniffBytes = 8000

	GitDiffModeUnstaged = "unstaged"
	GitDiffModeStaged   = "staged"
	GitDiffModeCommit   = "commit"

	GitFileKindChanged   = "changed"
	GitFileKindRenamed   = "renamed"
	GitFileKindUnmerged  = "unmerged"
	GitFileKindUntracked = "untracked"

	GitRefTypeHead   = "head"
	GitRefTypeBranch = "branch"
	GitRefTypeRemote = "remote"
	GitRefTypeTag    = "tag"

	GitStateMerging       = "merging"
	GitStateRebasing      = "rebasing"
	GitStateCherryPicking = "cherrypicking"
	GitStateReverting     = "reverting"
	GitStateBisecting     = "bisecting"

	GitFieldSep  = "\x1f"
	GitRecordSep = "\x1e"

	GitLogFormat    = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s%x1e"
	GitCommitFormat = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%B"
)

var gitHashRe = regexp.MustCompile(`^[0-9a-fA-F]{4,64}$`)

var errNotGitRepo = errors.New("not a git repository")

type gitRepo struct {
	GitPath string
	Root    string
	GitDir  string
}

type cappedBuffer struct {
	Buf bytes.Buffer
	Max int
}

func (cb *cappedBuffer) Write(p []byte) (int, error) {
	remaining := cb.Max - cb.Buf.Len()
	if remaining <= 0 {
		return len(p), nil
	}
	if len(p) > remaining {
		cb.Buf.Write(p[:remaining])
	} else {
		cb.Buf.Write(p)
	}
	return len(p), nil
}

// A GUI-launched wavesrv on macOS inherits launchd's minimal PATH, where `git` resolves to the
// /usr/bin/git Xcode shim (which pops an install dialog when the command line tools are missing),
// so a Homebrew install is preferred when one exists.
func findGitExecutable() (string, error) {
	pathGit, pathErr := exec.LookPath("git")
	if runtime.GOOS == "darwin" && (pathErr != nil || pathGit == "/usr/bin/git") {
		for _, candidate := range []string{"/opt/homebrew/bin/git", "/usr/local/bin/git"} {
			info, err := os.Stat(candidate)
			if err == nil && !info.IsDir() {
				return candidate, nil
			}
		}
	}
	if pathErr != nil {
		return "", fmt.Errorf("git executable not found: %w", pathErr)
	}
	return pathGit, nil
}

// LC_ALL=C keeps git's messages in English so error text can be matched regardless of the user's
// locale; GIT_OPTIONAL_LOCKS=0 stops the status poller from contending for the index lock with
// the user's own git commands.
func makeGitEnv() []string {
	env := os.Environ()
	return append(env, "LC_ALL=C", "GIT_OPTIONAL_LOCKS=0", "GIT_TERMINAL_PROMPT=0", "GIT_PAGER=cat", "PAGER=cat")
}

// runGitCmd returns at most maxBytes of stdout; when the output is longer the process is killed
// and truncated is true.
func runGitCmd(ctx context.Context, gitPath string, dir string, maxBytes int, args ...string) ([]byte, bool, error) {
	ctx, cancelFn := context.WithTimeout(ctx, GitCmdTimeout)
	defer cancelFn()
	fullArgs := []string{"-c", "core.quotepath=off", "-c", "color.ui=false", "-c", "log.showsignature=false"}
	fullArgs = append(fullArgs, args...)
	cmd := exec.CommandContext(ctx, gitPath, fullArgs...)
	cmd.Dir = dir
	cmd.Env = makeGitEnv()
	stderr := &cappedBuffer{Max: GitMaxStderrBytes}
	cmd.Stderr = stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, false, err
	}
	err = cmd.Start()
	if err != nil {
		return nil, false, fmt.Errorf("cannot run git: %w", err)
	}
	out, readErr := io.ReadAll(io.LimitReader(stdout, int64(maxBytes)+1))
	truncated := len(out) > maxBytes
	if truncated {
		out = out[:maxBytes]
		cmd.Process.Kill()
	}
	waitErr := cmd.Wait()
	if truncated {
		return out, true, nil
	}
	if ctx.Err() != nil {
		return nil, false, fmt.Errorf("git %s timed out", args[0])
	}
	if waitErr != nil {
		msg := strings.TrimSpace(stderr.Buf.String())
		if msg == "" {
			msg = waitErr.Error()
		}
		return nil, false, fmt.Errorf("git %s: %s", args[0], msg)
	}
	if readErr != nil {
		return nil, false, readErr
	}
	return out, false, nil
}

func openGitRepo(ctx context.Context, path string) (*gitRepo, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("path is required")
	}
	gitPath, err := findGitExecutable()
	if err != nil {
		return nil, err
	}
	dir, err := wavebase.ExpandHomeDir(path)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("cannot access %s: %w", path, err)
	}
	if !info.IsDir() {
		dir = filepath.Dir(dir)
	}
	out, _, err := runGitCmd(ctx, gitPath, dir, 64*1024, "rev-parse", "--show-toplevel", "--absolute-git-dir")
	if err != nil {
		if strings.Contains(err.Error(), "not a git repository") {
			return nil, errNotGitRepo
		}
		return nil, err
	}
	lines := strings.Split(strings.TrimRight(string(out), "\r\n"), "\n")
	if len(lines) < 2 {
		return nil, fmt.Errorf("unexpected git rev-parse output")
	}
	return &gitRepo{
		GitPath: gitPath,
		Root:    filepath.FromSlash(strings.TrimSpace(lines[0])),
		GitDir:  filepath.FromSlash(strings.TrimSpace(lines[1])),
	}, nil
}

func (repo *gitRepo) run(ctx context.Context, maxBytes int, args ...string) ([]byte, bool, error) {
	return runGitCmd(ctx, repo.GitPath, repo.Root, maxBytes, args...)
}

func (repo *gitRepo) hasHead(ctx context.Context) bool {
	_, _, err := repo.run(ctx, 4096, "rev-parse", "-q", "--verify", "HEAD")
	return err == nil
}

// readBlob treats any lookup failure as a missing blob: "HEAD:path" for a newly added file and
// ":0:path" for an untracked one are expected to fail.
func (repo *gitRepo) readBlob(ctx context.Context, spec string) ([]byte, bool) {
	out, truncated, err := repo.run(ctx, GitMaxDiffFileBytes, "cat-file", "blob", spec)
	if err != nil {
		return nil, false
	}
	return out, truncated
}

func detectGitRepoState(gitDir string) string {
	exists := func(name string) bool {
		_, err := os.Stat(filepath.Join(gitDir, name))
		return err == nil
	}
	if exists("rebase-merge") || exists("rebase-apply") {
		return GitStateRebasing
	}
	if exists("MERGE_HEAD") {
		return GitStateMerging
	}
	if exists("CHERRY_PICK_HEAD") {
		return GitStateCherryPicking
	}
	if exists("REVERT_HEAD") {
		return GitStateReverting
	}
	if exists("BISECT_LOG") {
		return GitStateBisecting
	}
	return ""
}

func parseGitStatusHeader(rtn *wshrpc.GitStatusResponse, line string) {
	key, value, ok := strings.Cut(strings.TrimPrefix(line, "# "), " ")
	if !ok {
		return
	}
	switch key {
	case "branch.oid":
		if value != "(initial)" {
			rtn.Head = value
		}
	case "branch.head":
		if value != "(detached)" {
			rtn.Branch = value
		}
	case "branch.upstream":
		rtn.Upstream = value
	case "branch.ab":
		parts := strings.Fields(value)
		if len(parts) == 2 {
			rtn.Ahead, _ = strconv.Atoi(strings.TrimPrefix(parts[0], "+"))
			rtn.Behind, _ = strconv.Atoi(strings.TrimPrefix(parts[1], "-"))
		}
	}
}

// parseGitStatusV2 parses `git status --porcelain=v2 --branch -z`. A rename record ("2 ...") is
// followed by its original path as a separate NUL-terminated token.
func parseGitStatusV2(out []byte, outputTruncated bool) *wshrpc.GitStatusResponse {
	rtn := &wshrpc.GitStatusResponse{Files: []wshrpc.GitStatusFile{}}
	tokens := strings.Split(string(out), "\x00")
	if outputTruncated && len(tokens) > 0 {
		tokens = tokens[:len(tokens)-1]
		rtn.Truncated = true
	}
	for i := 0; i < len(tokens); i++ {
		line := tokens[i]
		if line == "" {
			continue
		}
		if line[0] == '#' {
			parseGitStatusHeader(rtn, line)
			continue
		}
		if len(rtn.Files) >= GitMaxStatusFiles {
			rtn.Truncated = true
			break
		}
		switch line[0] {
		case '1':
			fields := strings.SplitN(line, " ", 9)
			if len(fields) < 9 || len(fields[1]) < 2 {
				continue
			}
			rtn.Files = append(rtn.Files, wshrpc.GitStatusFile{
				Path:     fields[8],
				Index:    fields[1][0:1],
				WorkTree: fields[1][1:2],
				Kind:     GitFileKindChanged,
			})
		case '2':
			fields := strings.SplitN(line, " ", 10)
			origPath := ""
			if i+1 < len(tokens) {
				origPath = tokens[i+1]
				i++
			}
			if len(fields) < 10 || len(fields[1]) < 2 {
				continue
			}
			rtn.Files = append(rtn.Files, wshrpc.GitStatusFile{
				Path:     fields[9],
				OrigPath: origPath,
				Index:    fields[1][0:1],
				WorkTree: fields[1][1:2],
				Kind:     GitFileKindRenamed,
			})
		case 'u':
			fields := strings.SplitN(line, " ", 11)
			if len(fields) < 11 || len(fields[1]) < 2 {
				continue
			}
			rtn.Files = append(rtn.Files, wshrpc.GitStatusFile{
				Path:     fields[10],
				Index:    fields[1][0:1],
				WorkTree: fields[1][1:2],
				Kind:     GitFileKindUnmerged,
			})
		case '?':
			if len(line) < 3 {
				continue
			}
			rtn.Files = append(rtn.Files, wshrpc.GitStatusFile{
				Path:     line[2:],
				Index:    ".",
				WorkTree: "?",
				Kind:     GitFileKindUntracked,
			})
		}
	}
	return rtn
}

// parseGitDecorations parses %D as printed with --decorate=full, e.g.
// "HEAD -> refs/heads/main, tag: refs/tags/v1.0, refs/remotes/origin/main".
func parseGitDecorations(decorations string) []wshrpc.GitRef {
	var rtn []wshrpc.GitRef
	for _, part := range strings.Split(decorations, ", ") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if part == "HEAD" {
			rtn = append(rtn, wshrpc.GitRef{Name: "HEAD", Type: GitRefTypeHead, Head: true})
			continue
		}
		isHead := false
		if after, ok := strings.CutPrefix(part, "HEAD -> "); ok {
			part = after
			isHead = true
		}
		if after, ok := strings.CutPrefix(part, "tag: "); ok {
			rtn = append(rtn, wshrpc.GitRef{Name: strings.TrimPrefix(after, "refs/tags/"), Type: GitRefTypeTag})
			continue
		}
		switch {
		case strings.HasPrefix(part, "refs/heads/"):
			rtn = append(rtn, wshrpc.GitRef{Name: strings.TrimPrefix(part, "refs/heads/"), Type: GitRefTypeBranch, Head: isHead})
		case strings.HasPrefix(part, "refs/remotes/"):
			name := strings.TrimPrefix(part, "refs/remotes/")
			if strings.HasSuffix(name, "/HEAD") {
				continue
			}
			rtn = append(rtn, wshrpc.GitRef{Name: name, Type: GitRefTypeRemote})
		case strings.HasPrefix(part, "refs/tags/"):
			rtn = append(rtn, wshrpc.GitRef{Name: strings.TrimPrefix(part, "refs/tags/"), Type: GitRefTypeTag})
		case strings.HasPrefix(part, "refs/"):
			// stash, notes, and other internal refs are not shown in the graph
		default:
			rtn = append(rtn, wshrpc.GitRef{Name: part, Type: GitRefTypeBranch, Head: isHead})
		}
	}
	return rtn
}

func parseGitLog(out []byte) []wshrpc.GitCommit {
	rtn := []wshrpc.GitCommit{}
	for _, record := range strings.Split(string(out), GitRecordSep) {
		record = strings.TrimLeft(record, "\r\n")
		if record == "" {
			continue
		}
		fields := strings.SplitN(record, GitFieldSep, 7)
		if len(fields) < 7 {
			continue
		}
		authorTime, _ := strconv.ParseInt(fields[4], 10, 64)
		rtn = append(rtn, wshrpc.GitCommit{
			Hash:    fields[0],
			Parents: strings.Fields(fields[1]),
			Author:  fields[2],
			Email:   fields[3],
			Time:    authorTime,
			Refs:    parseGitDecorations(fields[5]),
			Subject: fields[6],
		})
	}
	return rtn
}

// parseGitNameStatus parses `git diff-tree --name-status -z`, where a rename or copy is
// "R100\0old\0new\0" and anything else is "M\0path\0".
func parseGitNameStatus(out []byte, outputTruncated bool) ([]wshrpc.GitChangedFile, bool) {
	rtn := []wshrpc.GitChangedFile{}
	truncated := outputTruncated
	tokens := strings.Split(string(out), "\x00")
	if outputTruncated && len(tokens) > 0 {
		tokens = tokens[:len(tokens)-1]
	}
	for i := 0; i < len(tokens); i++ {
		status := tokens[i]
		if status == "" {
			continue
		}
		if len(rtn) >= GitMaxCommitFiles {
			truncated = true
			break
		}
		code := status[0:1]
		if code == "R" || code == "C" {
			if i+2 >= len(tokens) {
				break
			}
			rtn = append(rtn, wshrpc.GitChangedFile{Path: tokens[i+2], OrigPath: tokens[i+1], Status: code})
			i += 2
			continue
		}
		if i+1 >= len(tokens) {
			break
		}
		rtn = append(rtn, wshrpc.GitChangedFile{Path: tokens[i+1], Status: code})
		i++
	}
	return rtn, truncated
}

func isSafeRepoRelPath(relPath string) bool {
	if relPath == "" || strings.HasPrefix(relPath, "/") || filepath.IsAbs(relPath) {
		return false
	}
	for _, part := range strings.Split(relPath, "/") {
		if part == ".." {
			return false
		}
	}
	return true
}

func isBinaryContent(data []byte) bool {
	return bytes.IndexByte(data[:min(len(data), GitBinarySniffBytes)], 0) >= 0
}

// readWorkTreeFile mirrors what git would store for the path: a symlink's target rather than the
// file it points to, and nothing for a directory (e.g. a submodule checkout).
func readWorkTreeFile(root string, relPath string) ([]byte, bool, error) {
	fullPath := filepath.Join(root, filepath.FromSlash(relPath))
	info, err := os.Lstat(fullPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		target, err := os.Readlink(fullPath)
		if err != nil {
			return nil, false, err
		}
		return []byte(target), false, nil
	}
	if info.IsDir() {
		return nil, false, nil
	}
	if info.Size() > GitMaxDiffFileBytes {
		return nil, true, nil
	}
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, false, err
	}
	return data, false, nil
}

func (impl *ServerImpl) RemoteGitStatusCommand(ctx context.Context, data wshrpc.CommandRemoteGitStatusData) (*wshrpc.GitStatusResponse, error) {
	repo, err := openGitRepo(ctx, data.Path)
	if errors.Is(err, errNotGitRepo) {
		return &wshrpc.GitStatusResponse{IsRepo: false, Files: []wshrpc.GitStatusFile{}}, nil
	}
	if err != nil {
		return nil, err
	}
	out, truncated, err := repo.run(ctx, GitMaxOutputBytes, "status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all")
	if err != nil {
		return nil, err
	}
	rtn := parseGitStatusV2(out, truncated)
	rtn.IsRepo = true
	rtn.RepoRoot = repo.Root
	rtn.State = detectGitRepoState(repo.GitDir)
	return rtn, nil
}

func (impl *ServerImpl) RemoteGitLogCommand(ctx context.Context, data wshrpc.CommandRemoteGitLogData) (*wshrpc.GitLogResponse, error) {
	repo, err := openGitRepo(ctx, data.Path)
	if err != nil {
		return nil, err
	}
	limit := data.Limit
	if limit <= 0 {
		limit = GitDefaultLogLimit
	}
	limit = min(limit, GitMaxLogLimit)
	skip := max(data.Skip, 0)
	args := []string{
		"log",
		"--topo-order",
		"--decorate=full",
		"--format=" + GitLogFormat,
		"--skip=" + strconv.Itoa(skip),
		"-n", strconv.Itoa(limit + 1),
	}
	if data.All {
		args = append(args, "--exclude=refs/stash", "--all")
	} else {
		args = append(args, "HEAD")
	}
	args = append(args, "--")
	out, _, err := repo.run(ctx, GitMaxOutputBytes, args...)
	if err != nil {
		if !repo.hasHead(ctx) {
			return &wshrpc.GitLogResponse{Commits: []wshrpc.GitCommit{}}, nil
		}
		return nil, err
	}
	commits := parseGitLog(out)
	rtn := &wshrpc.GitLogResponse{Commits: commits}
	if len(commits) > limit {
		rtn.Commits = commits[:limit]
		rtn.HasMore = true
	}
	return rtn, nil
}

func (impl *ServerImpl) RemoteGitCommitCommand(ctx context.Context, data wshrpc.CommandRemoteGitCommitData) (*wshrpc.GitCommitDetail, error) {
	if !gitHashRe.MatchString(data.Hash) {
		return nil, fmt.Errorf("invalid commit hash %q", data.Hash)
	}
	repo, err := openGitRepo(ctx, data.Path)
	if err != nil {
		return nil, err
	}
	out, _, err := repo.run(ctx, GitMaxOutputBytes, "show", "-s", "--format="+GitCommitFormat, data.Hash)
	if err != nil {
		return nil, err
	}
	fields := strings.SplitN(string(out), GitFieldSep, 9)
	if len(fields) < 9 {
		return nil, fmt.Errorf("unexpected git show output")
	}
	authorTime, _ := strconv.ParseInt(fields[4], 10, 64)
	commitTime, _ := strconv.ParseInt(fields[7], 10, 64)
	rtn := &wshrpc.GitCommitDetail{
		Hash:           fields[0],
		Parents:        strings.Fields(fields[1]),
		Author:         fields[2],
		AuthorEmail:    fields[3],
		AuthorTime:     authorTime,
		Committer:      fields[5],
		CommitterEmail: fields[6],
		CommitTime:     commitTime,
		Message:        strings.TrimRight(fields[8], "\r\n"),
	}
	// merge commits are compared against their first parent, the same view `git log -p --first-parent` gives
	diffArgs := []string{"diff-tree", "-r", "-z", "-M", "--name-status", "--no-commit-id"}
	if len(rtn.Parents) > 0 {
		diffArgs = append(diffArgs, rtn.Parents[0], rtn.Hash)
	} else {
		diffArgs = append(diffArgs, "--root", rtn.Hash)
	}
	diffOut, diffTruncated, err := repo.run(ctx, GitMaxOutputBytes, diffArgs...)
	if err != nil {
		return nil, err
	}
	rtn.Files, rtn.Truncated = parseGitNameStatus(diffOut, diffTruncated)
	return rtn, nil
}

func (impl *ServerImpl) RemoteGitDiffCommand(ctx context.Context, data wshrpc.CommandRemoteGitDiffData) (*wshrpc.GitDiffResponse, error) {
	file := filepath.ToSlash(data.File)
	origFile := filepath.ToSlash(data.OrigFile)
	if origFile == "" {
		origFile = file
	}
	if !isSafeRepoRelPath(file) || !isSafeRepoRelPath(origFile) {
		return nil, fmt.Errorf("invalid file path %q", data.File)
	}
	repo, err := openGitRepo(ctx, data.Path)
	if err != nil {
		return nil, err
	}
	var origData, modData []byte
	var origTooLarge, modTooLarge bool
	switch data.Mode {
	case GitDiffModeUnstaged:
		// an unmerged path has no stage-0 entry, so fall back to HEAD for its base
		origData, origTooLarge = repo.readBlob(ctx, ":0:"+file)
		if origData == nil && !origTooLarge {
			origData, origTooLarge = repo.readBlob(ctx, "HEAD:"+file)
		}
		modData, modTooLarge, err = readWorkTreeFile(repo.Root, file)
		if err != nil {
			return nil, err
		}
	case GitDiffModeStaged:
		origData, origTooLarge = repo.readBlob(ctx, "HEAD:"+origFile)
		modData, modTooLarge = repo.readBlob(ctx, ":0:"+file)
	case GitDiffModeCommit:
		if !gitHashRe.MatchString(data.Hash) {
			return nil, fmt.Errorf("invalid commit hash %q", data.Hash)
		}
		if data.Parent != "" {
			if !gitHashRe.MatchString(data.Parent) {
				return nil, fmt.Errorf("invalid parent hash %q", data.Parent)
			}
			origData, origTooLarge = repo.readBlob(ctx, data.Parent+":"+origFile)
		}
		modData, modTooLarge = repo.readBlob(ctx, data.Hash+":"+file)
	default:
		return nil, fmt.Errorf("invalid diff mode %q", data.Mode)
	}
	if origTooLarge || modTooLarge {
		return &wshrpc.GitDiffResponse{TooLarge: true}, nil
	}
	if isBinaryContent(origData) || isBinaryContent(modData) {
		return &wshrpc.GitDiffResponse{Binary: true}, nil
	}
	return &wshrpc.GitDiffResponse{Original: string(origData), Modified: string(modData)}, nil
}
