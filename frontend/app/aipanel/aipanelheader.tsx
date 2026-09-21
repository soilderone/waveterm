// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { handleWaveAIContextMenu } from "@/app/aipanel/aipanel-contextmenu";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { useT } from "@/util/i18n-hooks";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { WaveAIModel } from "./waveai-model";

export const AIPanelHeader = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const widgetAccess = useAtomValue(model.widgetAccessAtom);
    const inBuilder = model.inBuilder;

    const handleKebabClick = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        handleWaveAIContextMenu(e, false);
    };

    return (
        <div
            className="shell-ai-header px-4 py-3 border-b border-border flex items-center justify-between gap-2 min-w-0"
            onContextMenu={handleContextMenu}
        >
            <h2 className="text-primary text-sm font-semibold flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                <i className="fa fa-sparkles text-typeai"></i>
                Wave AI
            </h2>

            <div className="flex items-center flex-shrink-0 whitespace-nowrap">
                {!inBuilder && (
                    <button
                        onClick={() => model.setWidgetAccess(!widgetAccess)}
                        className={`shell-context-toggle ${widgetAccess ? "is-active" : ""}`}
                        aria-pressed={widgetAccess}
                        title={t("ai.widgetAccessTitle", { state: widgetAccess ? t("ai.on") : t("ai.off") })}
                    >
                        {t("ai.contextShort")}
                        <span>{widgetAccess ? t("ai.on") : t("ai.off")}</span>
                    </button>
                )}

                {!inBuilder && <>
                    <button className="shell-icon-button" onClick={() => model.clearChat()} title={t("shell.newChat")} aria-label={t("shell.newChat")}><i className="fa fa-plus" /></button>
                    <button className="shell-icon-button" onClick={() => WorkspaceLayoutModel.getInstance().setAIPanelVisible(false)} title={t("shell.closeAi")} aria-label={t("shell.closeAi")}><i className="fa fa-xmark" /></button>
                </>}
                <button
                    onClick={handleKebabClick}
                    className="text-secondary hover:text-primary cursor-pointer transition-colors p-1 rounded flex-shrink-0 ml-2 focus:outline-none"
                    title={t("ai.moreOptions")}
                >
                    <i className="fa fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
    );
});

AIPanelHeader.displayName = "AIPanelHeader";
