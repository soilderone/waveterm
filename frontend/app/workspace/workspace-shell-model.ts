// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, getBlockMetaKeyAtom, WOS } from "@/store/global";
import { atom, Atom } from "jotai";

export class WorkspaceShellModel {
    private static instance: WorkspaceShellModel;
    projectAtom: Atom<{ blockId: string; path: string; connection: string }>;

    private constructor() {
        this.projectAtom = atom((get) => {
            const tabId = get(atoms.staticTabId);
            const tab = get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)));
            const blockId = tab?.blockids?.find((id) => get(getBlockMetaKeyAtom(id, "view")) === "term");
            if (!blockId) return null;
            return {
                blockId,
                path: get(getBlockMetaKeyAtom(blockId, "cmd:cwd")),
                connection: get(getBlockMetaKeyAtom(blockId, "connection")),
            };
        });
    }

    static getInstance() {
        if (!this.instance) this.instance = new WorkspaceShellModel();
        return this.instance;
    }
}
