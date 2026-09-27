// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshremote

import (
	"fmt"
	"strings"
	"testing"
)

func makeStatusRecord(pathLen int) string {
	hash := strings.Repeat("a", 64)
	path := strings.Repeat("p", pathLen)
	return fmt.Sprintf("1 .M N... 100644 100644 100644 %s %s %s\x00", hash, hash, path)
}

// The status cap must never be what hides files below GitMaxStatusFiles for ordinary repos, even
// with SHA-256 object names and long paths.
func TestGitMaxStatusBytesCoversFileLimit(t *testing.T) {
	header := "# branch.oid " + strings.Repeat("a", 64) + "\x00# branch.head main\x00"
	need := len(header) + GitMaxStatusFiles*len(makeStatusRecord(300))
	if need > GitMaxStatusBytes {
		t.Fatalf("%d status records need %d bytes, cap is %d", GitMaxStatusFiles, need, GitMaxStatusBytes)
	}
}

func TestParseGitStatusV2DropsPartialRecordWhenTruncated(t *testing.T) {
	out := "# branch.head main\x00" + makeStatusRecord(10) + "? untracked.txt\x00" + "? partial-na"
	rtn := parseGitStatusV2([]byte(out), true)
	if !rtn.Truncated {
		t.Fatalf("expected Truncated")
	}
	if rtn.Branch != "main" {
		t.Errorf("branch = %q, want main", rtn.Branch)
	}
	if len(rtn.Files) != 2 {
		t.Fatalf("got %d files, want 2: %+v", len(rtn.Files), rtn.Files)
	}
	if rtn.Files[1].Path != "untracked.txt" {
		t.Errorf("second file = %q, want untracked.txt", rtn.Files[1].Path)
	}
}
