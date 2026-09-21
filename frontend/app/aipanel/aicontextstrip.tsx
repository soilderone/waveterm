// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToAccentVar, blockViewToName } from "@/app/block/blockutil";
import { atoms, getBlockMetaKeyAtom, refocusNode, WOS } from "@/store/global";
import { useT } from "@/util/i18n-hooks";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { WaveAIModel } from "./waveai-model";

const AIContextChip = memo(({ blockId, enabled }: { blockId: string; enabled: boolean }) => {
    const view = useAtomValue(getBlockMetaKeyAtom(blockId, "view"));
    const title = useAtomValue(getBlockMetaKeyAtom(blockId, "frame:title"));
    return (
        <button className="ai-context-chip" disabled={!enabled} onClick={() => refocusNode(blockId)} title={title || blockViewToName(view)}>
            <i style={{ backgroundColor: enabled ? blockViewToAccentVar(view) : "transparent" }} />
            <span>{title || blockViewToName(view)}</span>
        </button>
    );
});
AIContextChip.displayName = "AIContextChip";

export const AIContextStrip = memo(() => {
    const t = useT();
    const tabId = useAtomValue(atoms.staticTabId);
    const [tab] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));
    const enabled = useAtomValue(WaveAIModel.getInstance().widgetAccessAtom);
    return (
        <div className="ai-context-strip">
            <span>{t(enabled ? "shell.contextPanels" : "shell.contextOff")}</span>
            <div className="ai-context-chips">
                {tab?.blockids?.map((blockId) => <AIContextChip key={blockId} blockId={blockId} enabled={enabled} />)}
            </div>
        </div>
    );
});
AIContextStrip.displayName = "AIContextStrip";
