// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToAccentVar, blockViewToName } from "@/app/block/blockutil";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { VTabBar } from "@/app/tab/vtabbar";
import { WorkspaceNavigation } from "@/app/tab/workspaceswitcher";
import { getLayoutModelForStaticTab } from "@/layout/index";
import {
    atoms,
    createBlock,
    getBlockMetaKeyAtom,
    getLocalHostDisplayNameAtom,
    globalStore,
    refocusNode,
    WOS,
} from "@/store/global";
import { useT } from "@/util/i18n-hooks";
import { cn, fireAndForget, useAtomValueSafe } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { WidgetNavigation } from "./widgets";
import { WorkspaceLayoutModel } from "./workspace-layout-model";
import { WorkspaceVitals } from "./workspace-vitals";

export function openBlockLauncher() {
    fireAndForget(() => createBlock({ meta: { view: "launcher" } }, false, true));
}

const BlockNavigationItem = memo(({ blockId, index }: { blockId: string; index: number }) => {
    const view = useAtomValue(getBlockMetaKeyAtom(blockId, "view"));
    const title = useAtomValue(getBlockMetaKeyAtom(blockId, "frame:title"));
    const connection = useAtomValue(getBlockMetaKeyAtom(blockId, "connection"));
    const focused = useAtomValueSafe(getLayoutModelForStaticTab()?.focusedNode);
    const selectBlock = () => {
        const layout = getLayoutModelForStaticTab();
        const node = layout?.getNodeByBlockId(blockId);
        const magnified = layout && globalStore.get(layout.magnifiedNodeIdAtom);
        if (magnified && node && magnified !== node.id) {
            layout.magnifyNodeToggle(node.id);
        }
        refocusNode(blockId);
    };
    return (
        <button
            className={cn("shell-nav-item shell-block-nav", focused?.data?.blockId === blockId && "is-active")}
            style={{ "--nav-accent": blockViewToAccentVar(view) } as React.CSSProperties}
            onClick={selectBlock}
            title={connection || title || blockViewToName(view)}
            aria-current={focused?.data?.blockId === blockId ? "true" : undefined}
        >
            <span className="shell-type-dot" style={{ backgroundColor: blockViewToAccentVar(view) }} />
            <span className="shell-nav-label">{title || blockViewToName(view)}</span>
            <span className="shell-nav-index">{String(index + 1).padStart(2, "0")}</span>
        </button>
    );
});
BlockNavigationItem.displayName = "BlockNavigationItem";

const ConnectionNavigation = memo(() => {
    const t = useT();
    const connections = useAtomValue(atoms.allConnStatus);
    // a "local machine" row here would just be a second New block button, and the identity row at
    // the bottom of the sidebar already names the host -- only remote connections earn a row
    const remotes = connections.filter((connection) => connection.connection && connection.connection !== "local");
    if (remotes.length === 0) {
        return null;
    }
    const openTerminal = (connection: string) =>
        fireAndForget(() => createBlock({ meta: { view: "term", controller: "shell", connection } }));
    return (
        <section className="shell-nav-section">
            <div className="shell-section-label">{t("shell.connections")}</div>
            {remotes.map((connection) => (
                <button
                    key={connection.connection}
                    className="shell-nav-item shell-connection"
                    onClick={() => openTerminal(connection.connection)}
                    title={connection.error || connection.connection}
                >
                    <i className="fa fa-server" />
                    <span className="shell-nav-label">
                        {connection.connection}
                        <small>{connection.status}</small>
                    </span>
                    <span className={cn("shell-status-dot", connection.connected && "is-connected")} />
                </button>
            ))}
        </section>
    );
});
ConnectionNavigation.displayName = "ConnectionNavigation";

const WorkspaceIdentity = memo(() => {
    const t = useT();
    const localName = useAtomValue(getLocalHostDisplayNameAtom());
    const name = localName || t("shell.localMachine");
    return (
        <div className="shell-identity" title={name}>
            <span className="shell-identity-avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="shell-identity-name">
                {name}
                <small>{t("shell.localMachine")}</small>
            </span>
        </div>
    );
});
WorkspaceIdentity.displayName = "WorkspaceIdentity";

export const WorkspaceSidebar = memo(({ workspace, verticalTabs }: { workspace: Workspace; verticalTabs: boolean }) => {
    const t = useT();
    const tabId = useAtomValue(atoms.staticTabId);
    const [tab] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));
    const widgetsVisible = useAtomValue(WorkspaceLayoutModel.getInstance().widgetsSidebarVisibleAtom);
    return (
        <nav className="shell-sidebar" aria-label={t("shell.navigation")}>
            <WorkspaceNavigation />
            {verticalTabs && (
                <section className="shell-nav-section shell-tabs-section">
                    <div className="shell-section-label">{t("shell.tabs")}</div>
                    <VTabBar workspace={workspace} embedded />
                </section>
            )}
            <section className="shell-nav-section">
                <div className="shell-section-label">
                    <span>{t("shell.blocks")}</span>
                    <button
                        className="shell-icon-button"
                        onClick={openBlockLauncher}
                        title={t("shell.newBlock")}
                        aria-label={t("shell.newBlock")}
                    >
                        <i className="fa fa-plus" />
                    </button>
                </div>
                {tab?.blockids?.map((blockId, index) => (
                    <BlockNavigationItem key={blockId} blockId={blockId} index={index} />
                ))}
            </section>
            <ConnectionNavigation />
            <WidgetNavigation showWidgets={widgetsVisible} />
            <WorkspaceIdentity />
        </nav>
    );
});
WorkspaceSidebar.displayName = "WorkspaceSidebar";

export const ShellToolbar = memo(() => {
    const t = useT();
    const layout = getLayoutModelForStaticTab();
    const preset = useAtomValueSafe(layout?.workspacePresetAtom);
    const magnified = useAtomValueSafe(layout?.magnifiedNodeIdAtom);
    const count = useAtomValueSafe(layout?.numLeafs) ?? 0;
    const setLayout = (value: "grid" | "columns" | "focus") => {
        if (!layout) return;
        if (value === "focus") {
            const id = magnified || globalStore.get(layout.focusedNode)?.id;
            if (id) layout.magnifyNodeToggle(id);
            return;
        }
        const primary = globalStore
            .get(layout.leafOrder)
            .find((leaf) => globalStore.get(getBlockMetaKeyAtom(leaf.blockid, "view")) === "term");
        layout.applyWorkspacePreset(value, primary?.blockid);
    };
    const toggleTheme = () => {
        const light = document.documentElement.dataset.uitheme === "light";
        fireAndForget(() => RpcApi.SetConfigCommand(TabRpcClient, { "app:uitheme": light ? "dark" : "light" }));
    };
    return (
        <div className="shell-toolbar">
            <WorkspaceVitals />
            <div className="shell-layout-switcher" role="group" aria-label={t("shell.layout")}>
                {(["grid", "focus", "columns"] as const).map((value) => (
                    <button
                        key={value}
                        className={
                            (value === "focus" ? !!magnified : !magnified && preset === value) ? "is-active" : ""
                        }
                        disabled={value === "focus" ? count === 0 : count < 2}
                        aria-pressed={value === "focus" ? !!magnified : !magnified && preset === value}
                        title={t(`shell.layout.${value}`)}
                        aria-label={t(`shell.layout.${value}`)}
                        onClick={() => setLayout(value)}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                        >
                            <rect x="2" y="3" width="16" height="14" rx="2" />
                            {value === "grid" && <path d="M9 3v14m0-7h9" />}
                            {value === "columns" && <path d="M7.3 3v14m5.4-14v14" />}
                            {value === "focus" && <rect x="5" y="6" width="10" height="8" rx="1" />}
                        </svg>
                    </button>
                ))}
            </div>
            <button
                className="shell-icon-button"
                onClick={toggleTheme}
                title={t("shell.toggleTheme")}
                aria-label={t("shell.toggleTheme")}
            >
                <i className="fa fa-moon shell-theme-dark" />
                <i className="fa fa-sun shell-theme-light" />
            </button>
        </div>
    );
});
ShellToolbar.displayName = "ShellToolbar";
