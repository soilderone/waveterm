// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { waveAIHasSelection } from "@/app/aipanel/waveai-focus-utils";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { getSettingsKeyAtom, isDev } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { t } from "@/util/i18n";
import { WaveAIModel } from "./waveai-model";

export async function handleWaveAIContextMenu(e: React.MouseEvent, showCopy: boolean): Promise<void> {
    e.preventDefault();
    e.stopPropagation();

    const model = WaveAIModel.getInstance();
    const menu: ContextMenuItem[] = [];

    if (showCopy) {
        const hasSelection = waveAIHasSelection();
        if (hasSelection) {
            menu.push({
                role: "copy",
                label: t("menu.copy"),
            });
            menu.push({ type: "separator" });
        }
    }

    menu.push({
        label: t("ai.newChat"),
        click: () => {
            model.clearChat();
        },
    });

    menu.push({ type: "separator" });

    const rtInfo = await RpcApi.GetRTInfoCommand(TabRpcClient, {
        oref: model.orefContext,
    });

    const defaultTokens = model.inBuilder ? 24576 : 4096;
    const currentMaxTokens = rtInfo?.["waveai:maxoutputtokens"] ?? defaultTokens;
    // the "Pro" tiers only mean something for Wave's own cloud modes, not for a user's own API key
    const isCloudMode = globalStore.get(model.currentAIMode)?.startsWith("waveai") ?? false;

    const maxTokensSubmenu: ContextMenuItem[] = [];

    if (model.inBuilder) {
        maxTokensSubmenu.push(
            {
                label: t("ai.tokens24k"),
                type: "checkbox",
                checked: currentMaxTokens === 24576,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 24576 },
                    });
                },
            },
            {
                label: isCloudMode ? t("ai.tokens64kPro") : t("ai.tokens64k"),
                type: "checkbox",
                checked: currentMaxTokens === 65536,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 65536 },
                    });
                },
            }
        );
    } else {
        if (isDev()) {
            maxTokensSubmenu.push({
                label: t("ai.tokens1kDev"),
                type: "checkbox",
                checked: currentMaxTokens === 1024,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 1024 },
                    });
                },
            });
        }
        maxTokensSubmenu.push(
            {
                label: t("ai.tokens4k"),
                type: "checkbox",
                checked: currentMaxTokens === 4096,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 4096 },
                    });
                },
            },
            {
                label: isCloudMode ? t("ai.tokens16kPro") : t("ai.tokens16k"),
                type: "checkbox",
                checked: currentMaxTokens === 16384,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 16384 },
                    });
                },
            },
            {
                label: isCloudMode ? t("ai.tokens64kPro") : t("ai.tokens64k"),
                type: "checkbox",
                checked: currentMaxTokens === 65536,
                click: () => {
                    RpcApi.SetRTInfoCommand(TabRpcClient, {
                        oref: model.orefContext,
                        data: { "waveai:maxoutputtokens": 65536 },
                    });
                },
            }
        );
    }

    menu.push({
        label: t("ai.maxOutputTokens"),
        submenu: maxTokensSubmenu,
    });

    menu.push({ type: "separator" });

    if (!model.inBuilder && globalStore.get(getSettingsKeyAtom("waveai:hidegettingstarted"))) {
        menu.push({
            label: t("ai.showGettingStarted"),
            click: () => {
                RpcApi.SetConfigCommand(TabRpcClient, { "waveai:hidegettingstarted": null });
            },
        });
    }

    menu.push({
        label: t("ai.configureModes"),
        click: () => {
            RpcApi.RecordTEventCommand(
                TabRpcClient,
                {
                    event: "action:other",
                    props: {
                        "action:type": "waveai:configuremodes:contextmenu",
                    },
                },
                { noresponse: true }
            );
            model.openWaveAIConfig();
        },
    });

    if (model.canCloseWaveAIPanel()) {
        menu.push({ type: "separator" });

        menu.push({
            label: t("ai.hideWaveAI"),
            click: () => {
                model.closeWaveAIPanel();
            },
        });
    }

    ContextMenuModel.getInstance().showContextMenu(menu, e);
}
