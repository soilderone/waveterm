// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { atom, type PrimitiveAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessViewerViewModel } from "./processviewer";

vi.mock("@/app/element/tooltip", () => ({ Tooltip: () => null }));
vi.mock("@/app/store/contextmenu", () => ({ ContextMenuModel: {} }));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/util/i18n", () => ({ t: (key: string) => key }));
vi.mock("@/util/i18n-hooks", () => ({ useT: () => (key: string) => key }));
vi.mock("@/util/platformutil", () => ({ isMacOS: () => false }));
vi.mock("@/util/keyutil", () => ({ checkKeyPressed: () => false }));
vi.mock("@/util/util", () => ({ isBlank: (value: string) => !value, makeConnRoute: (value: string) => value }));

describe("process viewer polling lifecycle", () => {
    let model: ProcessViewerViewModel;
    let onScreen: PrimitiveAtom<boolean>;
    let fetch: ReturnType<typeof vi.fn>;

    function makeModel(visible = true) {
        onScreen = atom(visible);
        const connection = atom("local");
        const status = atom({ connected: true, status: "connected" });
        fetch = vi.fn().mockResolvedValue({ processes: [], totalcount: 0 });
        model = new ProcessViewerViewModel({
            blockId: "test",
            waveEnv: {
                atoms: { tabOnScreen: onScreen },
                getBlockMetaKeyAtom: () => connection,
                getConnStatusAtom: () => status,
                rpc: { RemoteProcessListCommand: fetch },
            },
        } as any);
    }

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        model?.dispose();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("starts no work for an offscreen tab and refreshes on return", async () => {
        makeModel(false);
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch).not.toHaveBeenCalled();
        globalStore.set(onScreen, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("stops requests when hidden and resumes without duplicate loops", async () => {
        makeModel();
        await vi.advanceTimersByTimeAsync(0);
        globalStore.set(onScreen, false);
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch).toHaveBeenCalledTimes(1);
        globalStore.set(onScreen, true);
        await vi.advanceTimersByTimeAsync(4000);
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("stops sampling when the document is hidden and removes its listener on dispose", async () => {
        const document = {
            visibilityState: "visible",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        vi.stubGlobal("document", document);
        makeModel();
        await vi.advanceTimersByTimeAsync(0);
        const listener = document.addEventListener.mock.calls[0][1];
        document.visibilityState = "hidden";
        listener();
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch).toHaveBeenCalledTimes(1);
        document.visibilityState = "visible";
        listener();
        await vi.advanceTimersByTimeAsync(0);
        expect(fetch).toHaveBeenCalledTimes(2);
        model.dispose();
        expect(document.removeEventListener).toHaveBeenCalledWith("visibilitychange", listener);
    });

    it("only retains widget order while paused, and stops that work when hidden", async () => {
        makeModel();
        await vi.advanceTimersByTimeAsync(0);
        model.setPaused(true);
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch.mock.calls.filter(([, data]) => !data.keepalive)).toHaveLength(1);
        const count = fetch.mock.calls.length;
        globalStore.set(onScreen, false);
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch).toHaveBeenCalledTimes(count);
        globalStore.set(onScreen, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(globalStore.get(model.pausedAtom)).toBe(true);
        expect(fetch.mock.lastCall[1].keepalive).toBe(true);
    });

    it("ignores an in-flight response after hiding", async () => {
        makeModel(false);
        let resolve: (value: any) => void;
        fetch.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
        globalStore.set(onScreen, true);
        globalStore.set(onScreen, false);
        resolve({ processes: [{ pid: 99 }], totalcount: 1 });
        await vi.advanceTimersByTimeAsync(0);
        expect(globalStore.get(model.dataAtom)).toBeNull();
    });

    it("loads the new connection once when a paused hidden viewer returns", async () => {
        makeModel();
        await vi.advanceTimersByTimeAsync(0);
        model.setPaused(true);
        globalStore.set(onScreen, false);
        model.forceRefreshOnConnectionChange();
        await vi.advanceTimersByTimeAsync(0);
        expect(globalStore.get(model.dataAtom)).toBeNull();
        expect(fetch.mock.calls.filter(([, data]) => !data.keepalive)).toHaveLength(1);
        globalStore.set(onScreen, true);
        await vi.advanceTimersByTimeAsync(0);
        expect(globalStore.get(model.dataAtom)).not.toBeNull();
        expect(globalStore.get(model.pausedAtom)).toBe(true);
        expect(fetch.mock.calls.filter(([, data]) => !data.keepalive)).toHaveLength(2);
    });

    it("unsubscribes on dispose", async () => {
        makeModel();
        await vi.advanceTimersByTimeAsync(0);
        model.dispose();
        globalStore.set(onScreen, false);
        globalStore.set(onScreen, true);
        await vi.advanceTimersByTimeAsync(20000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});
