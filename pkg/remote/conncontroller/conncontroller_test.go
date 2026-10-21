// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package conncontroller

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/wavetermdev/waveterm/pkg/remote"
	"golang.org/x/crypto/ssh"
)

type disconnectTestConn struct {
	ssh.Conn
	waitStarted  chan struct{}
	disconnected chan struct{}
	closed       atomic.Bool
}

func (c *disconnectTestConn) Wait() error {
	close(c.waitStarted)
	<-c.disconnected
	return errors.New("old connection disconnected")
}

func (c *disconnectTestConn) Close() error {
	c.closed.Store(true)
	return nil
}

func TestSSHDisconnectDoesNotCloseReplacement(t *testing.T) {
	oldTransport := &disconnectTestConn{
		waitStarted:  make(chan struct{}),
		disconnected: make(chan struct{}),
	}
	newTransport := &disconnectTestConn{}
	oldClient := &ssh.Client{Conn: oldTransport}
	newClient := &ssh.Client{Conn: newTransport}
	conn := &SSHConn{
		lock:          &sync.Mutex{},
		lifecycleLock: &sync.Mutex{},
		Opts:          &remote.SSHOpts{SSHHost: "test"},
		Status:        Status_Connected,
		Client:        oldClient,
		WshEnabled:    &atomic.Bool{},
	}
	done := make(chan struct{})
	go func() {
		conn.waitForDisconnect(oldClient)
		close(done)
	}()
	select {
	case <-oldTransport.waitStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("disconnect waiter did not start")
	}

	func() {
		conn.lifecycleLock.Lock()
		defer conn.lifecycleLock.Unlock()
		conn.WithLock(func() {
			conn.Client = newClient
		})
		close(oldTransport.disconnected)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("old disconnect waiter did not finish")
	}
	if conn.GetClient() != newClient || conn.GetStatus() != Status_Connected {
		t.Fatal("old disconnect callback changed the replacement connection")
	}
	if newTransport.closed.Load() {
		t.Fatal("old disconnect callback closed the replacement transport")
	}
	if conn.Error != "" {
		t.Fatalf("old disconnect error leaked into replacement: %s", conn.Error)
	}
}

func TestSSHDisconnectClosesCurrentConnection(t *testing.T) {
	transport := &disconnectTestConn{
		waitStarted:  make(chan struct{}),
		disconnected: make(chan struct{}),
	}
	client := &ssh.Client{Conn: transport}
	conn := &SSHConn{
		lock:          &sync.Mutex{},
		lifecycleLock: &sync.Mutex{},
		Opts:          &remote.SSHOpts{SSHHost: "test"},
		Status:        Status_Connected,
		Client:        client,
		WshEnabled:    &atomic.Bool{},
	}
	close(transport.disconnected)
	conn.waitForDisconnect(client)
	if conn.GetClient() != nil || conn.GetStatus() != Status_Disconnected || !transport.closed.Load() {
		t.Fatal("current disconnected connection was not cleaned up")
	}
}
