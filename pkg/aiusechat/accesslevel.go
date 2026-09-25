// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wstore"
)

const trustedRootsTimeout = 2 * time.Second

var chatToolAllowList = &toolAllowList{chats: make(map[string]map[string]bool)}

// toolAllowList records tools the user approved with "always allow for this chat", keyed by chatid.
type toolAllowList struct {
	lock  sync.Mutex
	chats map[string]map[string]bool
}

func (al *toolAllowList) allow(chatId string, toolName string) {
	al.lock.Lock()
	defer al.lock.Unlock()
	tools := al.chats[chatId]
	if tools == nil {
		tools = make(map[string]bool)
		al.chats[chatId] = tools
	}
	tools[toolName] = true
}

func (al *toolAllowList) isAllowed(chatId string, toolName string) bool {
	al.lock.Lock()
	defer al.lock.Unlock()
	return al.chats[chatId][toolName]
}

func NormalizeAccessLevel(level string) string {
	switch level {
	case uctypes.AccessLevelOff, uctypes.AccessLevelReadOnly, uctypes.AccessLevelCollab, uctypes.AccessLevelTrust:
		return level
	}
	return uctypes.AccessLevelCollab
}

// accessLevelAllowsTool treats a tool without a ToolRisk as mutating, so a newly added tool
// stays out of read-only mode until someone classifies it.
func accessLevelAllowsTool(level string, toolDef uctypes.ToolDefinition) bool {
	switch level {
	case uctypes.AccessLevelOff:
		return false
	case uctypes.AccessLevelReadOnly:
		return toolDef.ToolRisk == uctypes.ToolRiskObserve || toolDef.ToolRisk == uctypes.ToolRiskRead
	}
	return true
}

func filterToolsForAccessLevel(level string, tools []uctypes.ToolDefinition) []uctypes.ToolDefinition {
	var rtn []uctypes.ToolDefinition
	for _, tool := range tools {
		if accessLevelAllowsTool(level, tool) {
			rtn = append(rtn, tool)
		}
	}
	return rtn
}

func accessLevelPromptLine(level string) string {
	switch level {
	case uctypes.AccessLevelReadOnly:
		return "Access Level: read-only. You can inspect widgets and read files, but the user has not granted any tool that modifies files or widgets. If a change is needed, show the user what to change instead."
	case uctypes.AccessLevelTrust:
		return "Access Level: trusted. Reading and editing files inside the working directories of the user's local terminals runs without per-call approval. Deleting files, or touching anything outside those directories, still asks the user."
	}
	return ""
}

func isLocalConnName(connName string) bool {
	return connName == "" || connName == "local" || strings.HasPrefix(connName, "local:")
}

// resolvePath follows symlinks so a link inside a trusted root cannot point the tool outside it.
// Files that do not exist yet (a new write) are resolved through their parent directory.
func resolvePath(path string) string {
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		return resolved
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return path
	}
	return filepath.Join(parent, filepath.Base(path))
}

func cleanAbsPath(path string) string {
	if path == "" {
		return ""
	}
	expanded, err := wavebase.ExpandHomeDir(path)
	if err != nil || !filepath.IsAbs(expanded) {
		return ""
	}
	return filepath.Clean(expanded)
}

func makeTrustedRoot(cwd string) string {
	root := cleanAbsPath(cwd)
	if root == "" {
		return ""
	}
	// a terminal sitting in / or ~ must not turn the whole disk or home directory into a trusted root
	if root == filepath.Dir(root) {
		return ""
	}
	if home := cleanAbsPath(wavebase.GetHomeDir()); home != "" && root == home {
		return ""
	}
	return resolvePath(root)
}

// getTrustedRoots returns the working directories of the local terminals in the tab. Remote
// terminals are skipped: their cwd names a path on another machine, while the file tools
// always operate on the local filesystem.
func getTrustedRoots(ctx context.Context, tabId string) []string {
	if tabId == "" {
		return nil
	}
	tabObj, err := wstore.DBGet[*waveobj.Tab](ctx, tabId)
	if err != nil || tabObj == nil {
		return nil
	}
	var roots []string
	for _, blockId := range tabObj.BlockIds {
		block, err := wstore.DBGet[*waveobj.Block](ctx, blockId)
		if err != nil || block == nil || block.Meta == nil {
			continue
		}
		if view, _ := block.Meta[waveobj.MetaKey_View].(string); view != "term" {
			continue
		}
		connName, _ := block.Meta[waveobj.MetaKey_Connection].(string)
		if !isLocalConnName(connName) {
			continue
		}
		cwd, _ := block.Meta[waveobj.MetaKey_CmdCwd].(string)
		if root := makeTrustedRoot(cwd); root != "" {
			roots = append(roots, root)
		}
	}
	return roots
}

func isPathInTrustedRoots(path string, roots []string) bool {
	cleanPath := cleanAbsPath(path)
	if cleanPath == "" || len(roots) == 0 {
		return false
	}
	resolved := resolvePath(cleanPath)
	for _, root := range roots {
		rel, err := filepath.Rel(root, resolved)
		if err != nil {
			continue
		}
		if rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))) {
			return true
		}
	}
	return false
}

// applyAccessPolicy only ever relaxes a pending approval to auto-approved; it never adds an
// approval requirement. Deletes are excluded from both the per-chat allow list and the trust
// level so removing a file always asks.
func applyAccessPolicy(toolUseData *uctypes.UIMessageDataToolUse, toolDef *uctypes.ToolDefinition, input any, chatOpts uctypes.WaveChatOpts) {
	if toolUseData == nil || toolDef == nil || toolUseData.Approval != uctypes.ApprovalNeedsApproval {
		return
	}
	if toolDef.ToolRisk == uctypes.ToolRiskDelete {
		return
	}
	if chatToolAllowList.isAllowed(chatOpts.ChatId, toolDef.Name) {
		toolUseData.Approval = uctypes.ApprovalAutoApproved
		return
	}
	if chatOpts.AccessLevel != uctypes.AccessLevelTrust || toolDef.ToolInputPath == nil {
		return
	}
	if toolDef.ToolRisk != uctypes.ToolRiskRead && toolDef.ToolRisk != uctypes.ToolRiskWrite {
		return
	}
	ctx, cancelFn := context.WithTimeout(context.Background(), trustedRootsTimeout)
	defer cancelFn()
	roots := getTrustedRoots(ctx, chatOpts.TabId)
	if isPathInTrustedRoots(toolDef.ToolInputPath(input), roots) {
		toolUseData.Approval = uctypes.ApprovalAutoApproved
	}
}

func readTextFileInputPath(input any) string {
	params, err := parseReadTextFileInput(input)
	if err != nil {
		return ""
	}
	return params.Filename
}

func readDirInputPath(input any) string {
	params, err := parseReadDirInput(input)
	if err != nil {
		return ""
	}
	return params.Path
}

func writeTextFileInputPath(input any) string {
	params, err := parseWriteTextFileInput(input)
	if err != nil {
		return ""
	}
	return params.Filename
}

func editTextFileInputPath(input any) string {
	params, err := parseEditTextFileInput(input)
	if err != nil {
		return ""
	}
	return params.Filename
}
