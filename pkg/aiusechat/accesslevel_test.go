// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func TestNormalizeAccessLevel(t *testing.T) {
	for _, level := range []string{uctypes.AccessLevelOff, uctypes.AccessLevelReadOnly, uctypes.AccessLevelCollab, uctypes.AccessLevelTrust} {
		if got := NormalizeAccessLevel(level); got != level {
			t.Errorf("NormalizeAccessLevel(%q) = %q", level, got)
		}
	}
	for _, level := range []string{"", "bogus", "TRUST"} {
		if got := NormalizeAccessLevel(level); got != uctypes.AccessLevelCollab {
			t.Errorf("NormalizeAccessLevel(%q) = %q, want collab", level, got)
		}
	}
}

func TestFilterToolsForAccessLevel(t *testing.T) {
	tools := []uctypes.ToolDefinition{
		{Name: "observe", ToolRisk: uctypes.ToolRiskObserve},
		{Name: "read", ToolRisk: uctypes.ToolRiskRead},
		{Name: "write", ToolRisk: uctypes.ToolRiskWrite},
		{Name: "delete", ToolRisk: uctypes.ToolRiskDelete},
		{Name: "action", ToolRisk: uctypes.ToolRiskAction},
		{Name: "unclassified"},
	}
	names := func(defs []uctypes.ToolDefinition) []string {
		var rtn []string
		for _, def := range defs {
			rtn = append(rtn, def.Name)
		}
		return rtn
	}
	if got := filterToolsForAccessLevel(uctypes.AccessLevelOff, tools); len(got) != 0 {
		t.Errorf("off exposed tools: %v", names(got))
	}
	readOnly := names(filterToolsForAccessLevel(uctypes.AccessLevelReadOnly, tools))
	if len(readOnly) != 2 || readOnly[0] != "observe" || readOnly[1] != "read" {
		t.Errorf("readonly exposed %v, want [observe read]", readOnly)
	}
	for _, level := range []string{uctypes.AccessLevelCollab, uctypes.AccessLevelTrust} {
		if got := filterToolsForAccessLevel(level, tools); len(got) != len(tools) {
			t.Errorf("%s exposed %v, want all tools", level, names(got))
		}
	}
}

func TestIsPathInTrustedRoots(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "project")
	outside := filepath.Join(base, "other")
	for _, dir := range []string{filepath.Join(root, "src"), outside} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	trustedRoot := makeTrustedRoot(root)
	if trustedRoot == "" {
		t.Fatalf("makeTrustedRoot(%q) rejected a normal directory", root)
	}
	roots := []string{trustedRoot}

	cases := []struct {
		path string
		want bool
	}{
		{filepath.Join(root, "src", "main.go"), true},
		{filepath.Join(root, "newfile.txt"), true},
		{root, true},
		{filepath.Join(root, "..", "other", "x.txt"), false},
		{filepath.Join(outside, "x.txt"), false},
		{root + "-sibling/x.txt", false},
		{"relative/path.txt", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := isPathInTrustedRoots(tc.path, roots); got != tc.want {
			t.Errorf("isPathInTrustedRoots(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}

	link := filepath.Join(root, "escape")
	if err := os.Symlink(outside, link); err == nil {
		if isPathInTrustedRoots(filepath.Join(link, "x.txt"), roots) {
			t.Errorf("symlink out of the trusted root was treated as inside it")
		}
	}
}

func TestMakeTrustedRootRejectsBroadRoots(t *testing.T) {
	if got := makeTrustedRoot("/"); got != "" {
		t.Errorf("makeTrustedRoot(/) = %q, want rejected", got)
	}
	if got := makeTrustedRoot("~"); got != "" {
		t.Errorf("makeTrustedRoot(~) = %q, want rejected", got)
	}
	if got := makeTrustedRoot("relative/dir"); got != "" {
		t.Errorf("makeTrustedRoot(relative) = %q, want rejected", got)
	}
}

func TestApplyAccessPolicyChatAllowList(t *testing.T) {
	readDef := &uctypes.ToolDefinition{Name: "read_text_file", ToolRisk: uctypes.ToolRiskRead}
	deleteDef := &uctypes.ToolDefinition{Name: "delete_text_file", ToolRisk: uctypes.ToolRiskDelete}
	chatOpts := uctypes.WaveChatOpts{ChatId: "test-allowlist-chat", AccessLevel: uctypes.AccessLevelCollab}

	pending := uctypes.UIMessageDataToolUse{Approval: uctypes.ApprovalNeedsApproval}
	applyAccessPolicy(&pending, readDef, nil, chatOpts)
	if pending.Approval != uctypes.ApprovalNeedsApproval {
		t.Fatalf("collab auto approved a read without an allow-list entry")
	}

	chatToolAllowList.allow(chatOpts.ChatId, readDef.Name)
	chatToolAllowList.allow(chatOpts.ChatId, deleteDef.Name)

	applyAccessPolicy(&pending, readDef, nil, chatOpts)
	if pending.Approval != uctypes.ApprovalAutoApproved {
		t.Errorf("allow-listed read was not auto approved, got %q", pending.Approval)
	}

	pendingDelete := uctypes.UIMessageDataToolUse{Approval: uctypes.ApprovalNeedsApproval}
	applyAccessPolicy(&pendingDelete, deleteDef, nil, chatOpts)
	if pendingDelete.Approval != uctypes.ApprovalNeedsApproval {
		t.Errorf("delete was auto approved, got %q", pendingDelete.Approval)
	}

	otherChat := chatOpts
	otherChat.ChatId = "test-allowlist-other-chat"
	pendingOther := uctypes.UIMessageDataToolUse{Approval: uctypes.ApprovalNeedsApproval}
	applyAccessPolicy(&pendingOther, readDef, nil, otherChat)
	if pendingOther.Approval != uctypes.ApprovalNeedsApproval {
		t.Errorf("allow list leaked into another chat")
	}
}
