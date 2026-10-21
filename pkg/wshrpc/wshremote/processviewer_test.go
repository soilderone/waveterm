// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshremote

import (
	"testing"
	"time"
)

func TestProcessViewerKeepAliveDoesNotKeepSampling(t *testing.T) {
	lastRequest := time.Now().Add(-2 * ProcCacheSamplingIdleTimeout)
	cache := &procCacheState{lastRequest: lastRequest, running: true}
	cache.storeWidgetPidOrder("paused", []int32{42, 7}, 2)
	cache.touchWidgetPidOrder("paused")
	if !cache.lastRequest.Equal(lastRequest) {
		t.Fatal("paused widget keepalive renewed the sampling lease")
	}
	firstDone := true
	if !cache.updateCacheAndCheckIdle(nil, &firstDone, nil) || cache.running {
		t.Fatal("idle sampling did not stop")
	}
	pids, total := cache.getWidgetPidOrder("paused")
	if total != 2 || len(pids) != 2 || pids[0] != 42 || pids[1] != 7 {
		t.Fatal("stopping sampling discarded the paused widget order")
	}
}

func TestProcessViewerPrunesExpiredWidgetOrders(t *testing.T) {
	cache := &procCacheState{
		widgetPidOrders: map[string]*widgetPidOrder{
			"expired": {lastRequest: time.Now().Add(-2 * ProcCacheIdleTimeout)},
		},
	}
	cache.storeWidgetPidOrder("active", []int32{1}, 1)
	if _, ok := cache.widgetPidOrders["expired"]; ok {
		t.Fatal("expired widget order was retained")
	}
}
