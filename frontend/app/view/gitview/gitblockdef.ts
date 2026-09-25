// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { getLayoutModelForStaticTab } from "@/layout/index";
import * as WOS from "@/store/wos";
import { isBlank } from "@/util/util";

// A git block opened from the widget rail follows the focused block (its connection, and the
// directory a terminal is sitting in) so it lands on the repo the user is working in. A widget
// that sets its own "file" keeps it.
export function withFocusedBlockRepo(blockDef: BlockDef): BlockDef {
    if (!isBlank(blockDef?.meta?.file)) {
        return blockDef;
    }
    const layoutModel = getLayoutModelForStaticTab();
    const focusedNode = layoutModel?.focusedNode != null ? globalStore.get(layoutModel.focusedNode) : null;
    const blockId = focusedNode?.data?.blockId;
    if (blockId == null) {
        return blockDef;
    }
    const focusedMeta = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)))?.meta;
    if (focusedMeta == null) {
        return blockDef;
    }
    const meta: MetaType = { ...blockDef?.meta };
    if (!isBlank(focusedMeta.connection)) {
        meta.connection = focusedMeta.connection;
    }
    if (focusedMeta.view == "term" && !isBlank(focusedMeta["cmd:cwd"])) {
        meta.file = focusedMeta["cmd:cwd"];
    } else if ((focusedMeta.view == "git" || focusedMeta.view == "preview") && !isBlank(focusedMeta.file)) {
        meta.file = focusedMeta.file;
    }
    return { ...blockDef, meta };
}
