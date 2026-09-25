// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { handleWaveAIContextMenu } from "@/app/aipanel/aipanel-contextmenu";
import { useT } from "@/util/i18n-hooks";
import { memo } from "react";
import { AIAccessLevelDropdown } from "./aiaccesslevel";
import { WaveAIModel } from "./waveai-model";

export const AIPanelHeader = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const inBuilder = model.inBuilder;

    const handleKebabClick = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    return (
        <div
            className="py-1.5 pl-3 pr-1 @xs:pl-4 border-b border-border flex items-center justify-between gap-2 min-w-0"
            onContextMenu={handleContextMenu}
        >
            <h2 className="text-primary text-sm @xs:text-base font-semibold flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                <i className="fa fa-sparkles text-typeai"></i>
                Wave AI
            </h2>

            <div className="flex items-center flex-shrink-0 whitespace-nowrap">
                {!inBuilder && <AIAccessLevelDropdown />}
                <button
                    onClick={handleKebabClick}
                    className="text-secondary hover:text-primary cursor-pointer transition-colors p-1 rounded flex-shrink-0 ml-0.5 focus:outline-none"
                    title={t("ai.moreOptions")}
                >
                    <i className="fa fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
    );
});

AIPanelHeader.displayName = "AIPanelHeader";
