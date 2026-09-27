// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package chatstore

import (
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

type testMessage struct {
	id   string
	role string
}

func (m *testMessage) GetMessageId() string       { return m.id }
func (m *testMessage) GetUsage() *uctypes.AIUsage { return nil }
func (m *testMessage) GetRole() string            { return m.role }

func makeTestStore(t *testing.T, ids ...string) *ChatStore {
	t.Helper()
	cs := &ChatStore{chats: make(map[string]*uctypes.AIChat)}
	opts := &uctypes.AIOptsType{APIType: "test", Model: "test-model"}
	for i, id := range ids {
		role := "user"
		if i%2 == 1 {
			role = "assistant"
		}
		if err := cs.PostMessage("chat", opts, &testMessage{id: id, role: role}); err != nil {
			t.Fatalf("PostMessage(%s): %v", id, err)
		}
	}
	return cs
}

func TestTruncateAtMessageReleasesDroppedMessages(t *testing.T) {
	tests := []struct {
		name        string
		messageId   string
		keepMessage bool
		wantIds     []string
	}{
		{name: "drop message and after", messageId: "m2", keepMessage: false, wantIds: []string{"m0", "m1"}},
		{name: "keep message", messageId: "m2", keepMessage: true, wantIds: []string{"m0", "m1", "m2"}},
		{name: "drop everything", messageId: "m0", keepMessage: false, wantIds: []string{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cs := makeTestStore(t, "m0", "m1", "m2", "m3")
			before := cs.chats["chat"].NativeMessages
			if !cs.TruncateAtMessage("chat", tc.messageId, tc.keepMessage) {
				t.Fatalf("TruncateAtMessage returned false")
			}
			got := cs.chats["chat"].NativeMessages
			if len(got) != len(tc.wantIds) {
				t.Fatalf("got %d messages, want %d", len(got), len(tc.wantIds))
			}
			for i, id := range tc.wantIds {
				if got[i].GetMessageId() != id {
					t.Errorf("message %d = %s, want %s", i, got[i].GetMessageId(), id)
				}
			}
			for i := len(tc.wantIds); i < len(before); i++ {
				if before[i] != nil {
					t.Errorf("backing array slot %d still references %s", i, before[i].GetMessageId())
				}
			}
		})
	}
}

func TestTruncateAtMessageUnknownId(t *testing.T) {
	cs := makeTestStore(t, "m0", "m1")
	if cs.TruncateAtMessage("chat", "missing", false) {
		t.Fatalf("TruncateAtMessage returned true for an unknown message")
	}
	if len(cs.chats["chat"].NativeMessages) != 2 {
		t.Fatalf("chat was modified")
	}
	if cs.TruncateAtMessage("nochat", "m0", false) {
		t.Fatalf("TruncateAtMessage returned true for an unknown chat")
	}
}
