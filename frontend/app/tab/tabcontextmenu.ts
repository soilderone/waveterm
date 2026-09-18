// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getOrefMetaKeyAtom, globalStore, recordTEvent } from "@/app/store/global";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { t } from "@/util/i18n";
import { fireAndForget } from "@/util/util";
import { makeORef } from "../store/wos";
import type { TabEnv } from "./tab";

const FlagColors: { key: string; value: string }[] = [
    { key: "tabMenu.colorGreen", value: "#58C142" },
    { key: "tabMenu.colorTeal", value: "#00FFDB" },
    { key: "tabMenu.colorBlue", value: "#429DFF" },
    { key: "tabMenu.colorPurple", value: "#BF55EC" },
    { key: "tabMenu.colorRed", value: "#FF453A" },
    { key: "tabMenu.colorOrange", value: "#FF9500" },
    { key: "tabMenu.colorYellow", value: "#FFE900" },
];

function makeColorDotIcon(color: string | null, size = 16): string {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
        return null;
    }
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
    if (color != null) {
        ctx.fillStyle = color;
        ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = color == null ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.35)";
    ctx.stroke();
    return canvas.toDataURL("image/png");
}

export function buildTabBarContextMenu(env: TabEnv): ContextMenuItem[] {
    const currentTabBar = globalStore.get(env.getSettingsKeyAtom("app:tabbar")) ?? "top";
    const tabBarSubmenu: ContextMenuItem[] = [
        {
            label: t("tabMenu.positionTop"),
            type: "checkbox",
            checked: currentTabBar === "top",
            click: () => fireAndForget(() => env.rpc.SetConfigCommand(TabRpcClient, { "app:tabbar": "top" })),
        },
        {
            label: t("tabMenu.positionLeft"),
            type: "checkbox",
            checked: currentTabBar === "left",
            click: () => fireAndForget(() => env.rpc.SetConfigCommand(TabRpcClient, { "app:tabbar": "left" })),
        },
    ];
    return [{ label: t("tabMenu.tabBarPosition"), type: "submenu", submenu: tabBarSubmenu }];
}

export function buildTabContextMenu(
    id: string,
    renameRef: React.RefObject<(() => void) | null>,
    onClose: (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null) => void,
    env: TabEnv
): ContextMenuItem[] {
    const menu: ContextMenuItem[] = [];
    menu.push(
        { label: t("tabMenu.renameTab"), click: () => renameRef.current?.() },
        {
            label: t("tabMenu.copyTabId"),
            click: () => fireAndForget(() => navigator.clipboard.writeText(id)),
        },
        { type: "separator" }
    );
    const tabORef = makeORef("tab", id);
    const currentFlagColor = globalStore.get(getOrefMetaKeyAtom(tabORef, "tab:flagcolor")) ?? null;
    const flagSubmenu: ContextMenuItem[] = [
        {
            label: currentFlagColor == null ? `${t("common.none")} ✓` : t("common.none"),
            icon: makeColorDotIcon(null),
            click: () =>
                fireAndForget(() =>
                    env.rpc.SetMetaCommand(TabRpcClient, { oref: tabORef, meta: { "tab:flagcolor": null } })
                ),
        },
        ...FlagColors.map((fc) => ({
            label: currentFlagColor === fc.value ? `${t(fc.key)} ✓` : t(fc.key),
            icon: makeColorDotIcon(fc.value),
            click: () =>
                fireAndForget(() =>
                    env.rpc.SetMetaCommand(TabRpcClient, { oref: tabORef, meta: { "tab:flagcolor": fc.value } })
                ),
        })),
    ];
    menu.push({ label: t("tabMenu.flagTab"), type: "submenu", submenu: flagSubmenu }, { type: "separator" });
    const fullConfig = globalStore.get(env.atoms.fullConfigAtom);
    const backgrounds = fullConfig?.backgrounds ?? {};
    const bgKeys = Object.keys(backgrounds).filter((k) => backgrounds[k] != null);
    bgKeys.sort((a, b) => {
        const aOrder = backgrounds[a]["display:order"] ?? 0;
        const bOrder = backgrounds[b]["display:order"] ?? 0;
        return aOrder - bOrder;
    });
    if (bgKeys.length > 0) {
        const submenu: ContextMenuItem[] = [];
        const oref = makeORef("tab", id);
        submenu.push({
            label: t("tabMenu.backgroundDefault"),
            click: () =>
                fireAndForget(async () => {
                    await env.rpc.SetMetaCommand(TabRpcClient, {
                        oref,
                        meta: { "bg:*": true, "tab:background": null },
                    });
                    env.rpc.ActivityCommand(TabRpcClient, { settabtheme: 1 }, { noresponse: true });
                    recordTEvent("action:settabtheme");
                }),
        });
        for (const bgKey of bgKeys) {
            const bg = backgrounds[bgKey];
            submenu.push({
                label: bg["display:name"] ?? bgKey,
                click: () =>
                    fireAndForget(async () => {
                        await env.rpc.SetMetaCommand(TabRpcClient, {
                            oref,
                            meta: { "bg:*": true, "tab:background": bgKey },
                        });
                        env.rpc.ActivityCommand(TabRpcClient, { settabtheme: 1 }, { noresponse: true });
                        recordTEvent("action:settabtheme");
                    }),
            });
        }
        menu.push({ label: t("tabMenu.backgrounds"), type: "submenu", submenu }, { type: "separator" });
    }
    menu.push(...buildTabBarContextMenu(env), { type: "separator" });
    menu.push({ label: t("tabMenu.closeTab"), click: () => onClose(null) });
    return menu;
}
