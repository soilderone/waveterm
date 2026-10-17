// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TermWrap } from "./termwrap";

const mocks = vi.hoisted(() => ({
    getRTInfo: vi.fn(),
    unsubscribe: vi.fn(),
    release: vi.fn(),
}));

vi.mock("@/app/store/badge", () => ({ setBadge: vi.fn() }));
vi.mock("@/app/store/wps", () => ({
    getFileSubject: () => ({ subscribe: () => ({ unsubscribe: mocks.unsubscribe }), release: mocks.release }),
}));
vi.mock("@/app/store/wshclientapi", () => ({ RpcApi: { GetRTInfoCommand: mocks.getRTInfo } }));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/store/global", () => ({
    getSettingsKeyAtom: vi.fn(),
    globalStore: { get: vi.fn(), set: vi.fn() },
    isDev: () => false,
    WOS: { makeORef: (_type: string, id: string) => `block:${id}` },
}));
vi.mock("@/store/services", () => ({}));
vi.mock("@/util/platformutil", () => ({}));
vi.mock("@/util/util", () => ({}));
vi.mock("./osc-handlers", () => ({}));
vi.mock("./termutil", () => ({}));
vi.mock("@xterm/xterm", () => ({ Terminal: vi.fn() }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn() }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: vi.fn() }));
vi.mock("@xterm/addon-serialize", () => ({ SerializeAddon: vi.fn() }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: vi.fn() }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: vi.fn() }));
vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: vi.fn() }));

function makeTermWrap(): TermWrap {
    // Exercise ownership and async teardown without creating a DOM/GPU terminal.
    return Object.assign(Object.create(TermWrap.prototype), {
        blockId: "test-block",
        disposed: false,
        loaded: false,
        cacheTimeoutId: null,
        cacheIdleId: null,
        pendingWrites: new Set<() => void>(),
        heldData: [],
        recentWrites: [],
        promptMarkers: [],
        toDispose: [],
        ptyOffset: 0,
        dataBytesProcessed: 0,
        handleResize_debounced: Object.assign(vi.fn(), { cancel: vi.fn() }),
        terminal: {
            dispose: vi.fn(),
            write: vi.fn(),
            onData: () => ({ dispose: vi.fn() }),
            onSelectionChange: () => ({ dispose: vi.fn() }),
        },
    });
}

describe("terminal teardown", () => {
    let requestIdle: ReturnType<typeof vi.fn>;
    let cancelIdle: ReturnType<typeof vi.fn>;
    let idleCallback: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        idleCallback = null;
        requestIdle = vi.fn((callback: () => void) => {
            idleCallback = callback;
            return 7;
        });
        cancelIdle = vi.fn();
        vi.stubGlobal("window", { requestIdleCallback: requestIdle, cancelIdleCallback: cancelIdle });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("cancels the cache timer when closed before the next idle request", () => {
        const term = makeTermWrap();
        term.runProcessIdleTimeout();
        term.runProcessIdleTimeout();
        expect(vi.getTimerCount()).toBe(1);

        term.dispose();
        vi.advanceTimersByTime(10000);

        expect(requestIdle).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        expect(term.handleResize_debounced.cancel).toHaveBeenCalledOnce();
    });

    it("cancels a queued idle callback and prevents stale callbacks from rescheduling", () => {
        const term = makeTermWrap();
        term.processAndCacheData = vi.fn();
        term.runProcessIdleTimeout();
        vi.advanceTimersByTime(5000);
        expect(requestIdle).toHaveBeenCalledOnce();

        term.dispose();
        idleCallback();
        term.runProcessIdleTimeout();

        expect(cancelIdle).toHaveBeenCalledWith(7);
        expect(term.processAndCacheData).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not load history or restart timers if closed during initialization", async () => {
        let resolveRTInfo: (value: unknown) => void;
        mocks.getRTInfo.mockReturnValue(new Promise((resolve) => {
            resolveRTInfo = resolve;
        }));
        const term = makeTermWrap();
        term.loadInitialTerminalData = vi.fn().mockResolvedValue(null);
        const initialization = term.initTerminal();

        term.dispose();
        term.dispose();
        resolveRTInfo({});
        await initialization;

        expect(term.loaded).toBe(false);
        expect(term.loadInitialTerminalData).not.toHaveBeenCalled();
        expect(mocks.unsubscribe).toHaveBeenCalledOnce();
        expect(mocks.release).toHaveBeenCalledOnce();
        expect(term.terminal.dispose).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not become loaded if closed while history is replaying", async () => {
        let resolveHistory: () => void;
        mocks.getRTInfo.mockResolvedValue({});
        const term = makeTermWrap();
        term.loadInitialTerminalData = vi.fn(() => new Promise<void>((resolve) => {
            resolveHistory = resolve;
        }));
        const initialization = term.initTerminal();
        await Promise.resolve();
        expect(term.loadInitialTerminalData).toHaveBeenCalledOnce();

        term.dispose();
        resolveHistory();
        await initialization;

        expect(term.loaded).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("settles pending writes on close without advancing the saved PTY offset", async () => {
        const term = makeTermWrap();
        let writeCallback: () => void;
        vi.mocked(term.terminal.write).mockImplementation((_data, callback) => {
            writeCallback = callback;
        });
        const write = term.doTerminalWrite(new Uint8Array([65]));

        term.dispose();
        await write;
        writeCallback();

        expect(term.pendingWrites.size).toBe(0);
        expect(term.ptyOffset).toBe(0);
        expect(term.dataBytesProcessed).toBe(0);
    });
});
