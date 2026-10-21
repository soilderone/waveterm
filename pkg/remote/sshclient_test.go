// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package remote

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"net"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

func TestSSHHandshakeCancellation(t *testing.T) {
	for _, useDeadline := range []bool{false, true} {
		name := "cancel"
		if useDeadline {
			name = "deadline"
		}
		t.Run(name, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { listener.Close() })
			accepted := make(chan net.Conn, 1)
			go func() {
				socket, err := listener.Accept()
				if err == nil {
					accepted <- socket
				}
			}()
			ctx, cancel := context.WithCancel(context.Background())
			if useDeadline {
				cancel()
				ctx, cancel = context.WithTimeout(context.Background(), 200*time.Millisecond)
			}
			defer cancel()
			result := make(chan error, 1)
			go func() {
				client, err := connectInternal(ctx, listener.Addr().String(), &ssh.ClientConfig{
					User: "test", HostKeyCallback: ssh.InsecureIgnoreHostKey(),
				}, nil)
				if client != nil {
					client.Close()
				}
				result <- err
			}()
			select {
			case socket := <-accepted:
				t.Cleanup(func() { socket.Close() })
			case <-time.After(2 * time.Second):
				t.Fatal("TCP connection was not established")
			}
			expected := context.DeadlineExceeded
			if !useDeadline {
				expected = context.Canceled
				cancel()
			}
			select {
			case err := <-result:
				if !errors.Is(err, expected) {
					t.Fatalf("got %v, want %v", err, expected)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("SSH handshake ignored cancellation")
			}
		})
	}
}

func TestSSHHandshakeSuccessSurvivesContextCancel(t *testing.T) {
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := ssh.NewSignerFromKey(key)
	if err != nil {
		t.Fatal(err)
	}
	config := &ssh.ServerConfig{NoClientAuth: true}
	config.AddHostKey(signer)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	serverDone := make(chan error, 1)
	go func() {
		socket, err := listener.Accept()
		if err != nil {
			serverDone <- err
			return
		}
		defer socket.Close()
		server, channels, requests, err := ssh.NewServerConn(socket, config)
		if err != nil {
			serverDone <- err
			return
		}
		defer server.Close()
		go func() {
			for channel := range channels {
				channel.Reject(ssh.UnknownChannelType, "test server")
			}
		}()
		for request := range requests {
			request.Reply(true, nil)
		}
		serverDone <- nil
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	client, err := connectInternal(ctx, listener.Addr().String(), &ssh.ClientConfig{
		User: "test", HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	cancel()
	result := make(chan error, 1)
	go func() {
		_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
		result <- err
	}()
	select {
	case err := <-result:
		if err != nil {
			t.Fatalf("established connection was cancelled: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("established connection stopped responding")
	}
	client.Close()
	select {
	case err := <-serverDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("test server did not exit")
	}
}
