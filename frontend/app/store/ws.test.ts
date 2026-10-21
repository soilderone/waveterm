// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { newWebSocket } from "@/util/wsutil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WSControl } from "./ws";

vi.mock("@/util/wsutil", () => ({ newWebSocket: vi.fn() }));

describe("WebSocket send queue", () => {
    let control: WSControl;
    let socket: {
        readyState: number;
        bufferedAmount: number;
        send: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
    };
    let receive: ReturnType<typeof vi.fn>;

    function request(id: string, timeout?: number, data?: unknown): WSRpcCommand {
        return { wscommand: "rpc", message: { command: "test", reqid: id, timeout, data } };
    }

    function open() {
        control.open = true;
        control.wsConn = socket as any;
        control.runMsgQueue();
    }

    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask"],
        });
        receive = vi.fn();
        socket = { readyState: 1, bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
        control = new WSControl("ws://test", "test", receive);
        vi.mocked(newWebSocket).mockReturnValue(socket as any);
    });

    afterEach(() => {
        control.shutdown();
        vi.runAllTicks();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("bounds offline messages and reports overflow asynchronously", () => {
        for (let i = 0; i < 1000; i++) control.pushMessage(request(String(i)));
        expect(control.msgQueue).toHaveLength(256);
        expect(receive).not.toHaveBeenCalled();
        vi.runAllTicks();
        expect(receive).toHaveBeenCalledTimes(744);
        expect(receive.mock.calls[0][0].data.error).toContain("queue is full");
    });

    it("bounds retained bytes as well as message count", () => {
        const payload = "x".repeat(2 * 1024 * 1024);
        for (let i = 0; i < 4; i++) control.pushMessage(request(String(i), undefined, payload));
        expect(control.msgQueue).toHaveLength(2);
        expect(control.queuedBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    });

    it("expires requests while disconnected and never replays them", () => {
        control.pushMessage(request("expired", 100));
        control.pushMessage(request("live", 1000));
        vi.advanceTimersByTime(100);
        expect(receive.mock.calls[0][0].data.resid).toBe("expired");
        open();
        expect(socket.send).toHaveBeenCalledTimes(1);
        expect(JSON.parse(socket.send.mock.calls[0][0]).message.reqid).toBe("live");
        expect(control.queuedBytes).toBe(0);
    });

    it("gives requests without a timeout a bounded queue lifetime", () => {
        control.pushMessage(request("default"));
        vi.advanceTimersByTime(30000);
        expect(control.msgQueue).toHaveLength(0);
        expect(control.queuedBytes).toBe(0);
        expect(receive.mock.calls[0][0].data.error).toContain("expired");
    });

    it("removes an unsent request when it is cancelled", () => {
        control.pushMessage(request("cancelled"));
        control.pushMessage({ wscommand: "rpc", message: { reqid: "cancelled", cancel: true } });
        open();
        expect(socket.send).not.toHaveBeenCalled();
        expect(control.msgQueue).toHaveLength(0);
        expect(control.queuedBytes).toBe(0);
    });

    it("flushes in bounded batches and preserves order for newly queued messages", () => {
        for (let i = 0; i < 200; i++) control.pushMessage(request(String(i)));
        open();
        expect(socket.send).toHaveBeenCalledTimes(64);
        control.pushMessage(request("200"));
        vi.advanceTimersByTime(40);
        expect(socket.send).toHaveBeenCalledTimes(201);
        expect(socket.send.mock.calls.map(([data]) => JSON.parse(data).message.reqid)).toEqual(
            Array.from({ length: 201 }, (_, i) => String(i))
        );
        expect(control.queuedBytes).toBe(0);
    });

    it("respects transport backpressure", () => {
        control.pushMessage(request("buffered"));
        socket.bufferedAmount = 2 * 1024 * 1024;
        open();
        vi.advanceTimersByTime(20);
        expect(socket.send).not.toHaveBeenCalled();
        socket.bufferedAmount = 0;
        vi.advanceTimersByTime(10);
        expect(socket.send).toHaveBeenCalledTimes(1);
    });

    it("reannounces routes before replaying pending RPCs", () => {
        control.pushMessage(request("queued"));
        control.open = true;
        control.wsConn = socket as any;
        control.pushMessage({ wscommand: "rpc", message: { command: "routeannounce", data: "tab:test" } });
        control.runMsgQueue();
        expect(JSON.parse(socket.send.mock.calls[0][0]).message.command).toBe("routeannounce");
        expect(JSON.parse(socket.send.mock.calls[1][0]).message.reqid).toBe("queued");
    });

    it("clears every timer and pending request on shutdown", () => {
        control.pushMessage(request("pending"));
        control.reconnect();
        control.shutdown();
        vi.runAllTicks();
        expect(control.msgQueue).toHaveLength(0);
        expect(control.queuedBytes).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(60000);
        expect(newWebSocket).not.toHaveBeenCalled();
    });

    it("does not open a second socket during an in-flight connection", () => {
        control.connectNow("first");
        control.connectNow("duplicate");
        expect(newWebSocket).toHaveBeenCalledTimes(1);
    });
});
