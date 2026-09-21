// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { blockViewToAccentVar, blockViewToName } from "@/app/block/blockutil";
import { WorkspaceNavigation } from "@/app/tab/workspaceswitcher";
import { VTabBar } from "@/app/tab/vtabbar";
import type { TermViewModel } from "@/app/view/term/term-model";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { atoms, createBlock, getBlockComponentModel, getBlockMetaKeyAtom, getLocalHostDisplayNameAtom, globalStore, refocusNode } from "@/store/global";
import { WOS } from "@/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useT } from "@/util/i18n-hooks";
import { cn, fireAndForget, useAtomValueSafe } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useRef, useState } from "react";
import { WidgetNavigation } from "./widgets";
import { WorkspaceLayoutModel } from "./workspace-layout-model";
import { WorkspaceVitals } from "./workspace-vitals";
import { WorkspaceJump } from "./workspace-jump";
import { WorkspaceShellModel } from "./workspace-shell-model";

function pathLabel(path: string): string {
    return path?.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

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
        <button className={cn("shell-nav-item shell-block-nav", focused?.data?.blockId === blockId && "is-active")} style={{ "--nav-accent": blockViewToAccentVar(view) } as React.CSSProperties} onClick={selectBlock} title={connection || title || blockViewToName(view)} aria-current={focused?.data?.blockId === blockId ? "true" : undefined}>
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
    const localName = useAtomValue(getLocalHostDisplayNameAtom());
    const openTerminal = (connection?: string) => fireAndForget(() => createBlock({ meta: { view: "term", controller: "shell", ...(connection ? { connection } : {}) } }));
    return (
        <section className="shell-nav-section">
            <div className="shell-section-label">{t("shell.connections")}</div>
            <button className="shell-nav-item shell-connection" onClick={() => openTerminal()} title={t("shell.openTerminal")}>
                <i className="fa fa-laptop" />
                <span className="shell-nav-label">{t("shell.localMachine")}<small>{localName}</small></span>
            </button>
            {connections.filter((connection) => connection.connection && connection.connection !== "local").map((connection) => (
                <button key={connection.connection} className="shell-nav-item shell-connection" onClick={() => openTerminal(connection.connection)} title={connection.error || connection.connection}>
                    <i className="fa fa-server" />
                    <span className="shell-nav-label">{connection.connection}<small>{connection.status}</small></span>
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
    return <div className="shell-identity" title={name}><span className="shell-identity-avatar">{name.slice(0, 1).toUpperCase()}</span><span className="shell-identity-name">{name}<small>{t("shell.localMachine")}</small></span></div>;
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
            {verticalTabs && <section className="shell-nav-section shell-tabs-section"><div className="shell-section-label">{t("shell.tabs")}</div><VTabBar workspace={workspace} embedded /></section>}
            <section className="shell-nav-section">
                <div className="shell-section-label"><span>{t("shell.blocks")}</span><button className="shell-icon-button" onClick={openBlockLauncher} title={t("shell.newBlock")} aria-label={t("shell.newBlock")}><i className="fa fa-plus" /></button></div>
                {tab?.blockids?.map((blockId, index) => <BlockNavigationItem key={blockId} blockId={blockId} index={index} />)}
            </section>
            <ConnectionNavigation />
            <WidgetNavigation showWidgets={widgetsVisible} />
            <WorkspaceIdentity />
        </nav>
    );
});
WorkspaceSidebar.displayName = "WorkspaceSidebar";

export const WorkspaceHeading = memo(() => {
    const t = useT();
    const workspace = useAtomValue(atoms.workspace);
    const tabId = useAtomValue(atoms.staticTabId);
    const [tab] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));
    const layout = getLayoutModelForStaticTab();
    const magnified = useAtomValueSafe(layout?.magnifiedNodeIdAtom);
    const project = useAtomValue(WorkspaceShellModel.getInstance().projectAtom);
    const projectBlockId = project?.blockId;
    const projectPath = project?.path;
    const connection = project?.connection;
    const toggleFocus = () => {
        if (!layout) return;
        const nodeId = magnified || globalStore.get(layout.focusedNode)?.id;
        if (nodeId) layout.magnifyNodeToggle(nodeId);
    };
    return (
        <header className="shell-heading">
            <div className="shell-heading-copy">
                <div className="shell-breadcrumb">{t("shell.workspaces")}<span>/</span>{workspace?.name || t("shell.workspace")}</div>
                <div className="shell-project-title"><h1 title={projectPath}>{pathLabel(projectPath) || tab?.name || t("shell.workspace")}</h1>{projectBlockId && <span className="shell-project-tag" title={connection || t("shell.localMachine")}><i className="fa fa-laptop" />{connection || "local"}</span>}</div>
                <p>{t("shell.workspaceDescription")}</p>
            </div>
            <div className="shell-heading-actions">
                <button className={cn("shell-icon-button", magnified && "is-active")} onClick={toggleFocus} title={t("shell.focusBlock")} aria-label={t("shell.focusBlock")} aria-pressed={!!magnified}><i className={cn("fa", magnified ? "fa-compress" : "fa-expand")} /></button>
                <button className="shell-primary-button" onClick={openBlockLauncher} aria-label={t("shell.newBlock")}><i className="fa fa-plus" /><span>{t("shell.newBlock")}</span></button>
            </div>
        </header>
    );
});
WorkspaceHeading.displayName = "WorkspaceHeading";

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
        const primary = globalStore.get(layout.leafOrder).find((leaf) => globalStore.get(getBlockMetaKeyAtom(leaf.blockid, "view")) === "term");
        layout.applyWorkspacePreset(value, primary?.blockid);
    };
    const toggleTheme = () => {
        const light = document.documentElement.dataset.uitheme === "light";
        fireAndForget(() => RpcApi.SetConfigCommand(TabRpcClient, { "app:uitheme": light ? "dark" : "light" }));
    };
    return (
        <div className="shell-toolbar">
            <WorkspaceJump />
            <WorkspaceVitals />
            <div className="shell-layout-switcher" role="group" aria-label={t("shell.layout")}>
                {(["grid", "focus", "columns"] as const).map((value) => <button key={value} className={(value === "focus" ? !!magnified : !magnified && preset === value) ? "is-active" : ""} disabled={value === "focus" ? count === 0 : count < 2} aria-pressed={value === "focus" ? !!magnified : !magnified && preset === value} title={t(`shell.layout.${value}`)} aria-label={t(`shell.layout.${value}`)} onClick={() => setLayout(value)}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2" />{value === "grid" && <path d="M9 3v14m0-7h9" />}{value === "columns" && <path d="M7.3 3v14m5.4-14v14" />}{value === "focus" && <rect x="5" y="6" width="10" height="8" rx="1" />}</svg>
                </button>)}
            </div>
            <button className="shell-icon-button" onClick={toggleTheme} title={t("shell.toggleTheme")} aria-label={t("shell.toggleTheme")}><i className="fa fa-moon shell-theme-dark" /><i className="fa fa-sun shell-theme-light" /></button>
        </div>
    );
});
ShellToolbar.displayName = "ShellToolbar";

export const WorkspaceCommandBar = memo(() => {
    const t = useT();
    const [text, setText] = useState("");
    const [mode, setMode] = useState<"term" | "ai">("term");
    const composing = useRef(false);
    const layout = getLayoutModelForStaticTab();
    const focused = useAtomValueSafe(layout?.focusedNode);
    const blockId = focused?.data?.blockId;
    const view = useAtomValueSafe(blockId ? getBlockMetaKeyAtom(blockId, "view") : null);
    const project = useAtomValue(WorkspaceShellModel.getInstance().projectAtom);
    const targetBlockId = view === "term" ? blockId : project?.blockId;
    const canPaste = !!targetBlockId;
    const cwd = useAtomValueSafe(targetBlockId ? getBlockMetaKeyAtom(targetBlockId, "cmd:cwd") : null);
    const transfer = () => {
        if (!text.trim()) return;
        if (mode === "ai") {
            const model = WaveAIModel.getInstance();
            const existing = globalStore.get(model.inputAtom);
            globalStore.set(model.inputAtom, existing ? `${existing}\n${text}` : text);
            WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
        } else {
            const model = getBlockComponentModel(targetBlockId)?.viewModel as TermViewModel;
            if (!canPaste || !model?.termRef?.current?.terminal) return;
            model.termRef.current.terminal.paste(text);
            refocusNode(targetBlockId);
        }
        setText("");
    };
    return (
        <form className={cn("shell-command-bar", mode === "ai" && "is-ai")} onSubmit={(event) => { event.preventDefault(); if (!composing.current) transfer(); }}>
            <div className="shell-command-modes">
                <button type="button" className={cn(mode === "term" && "is-active")} onClick={() => setMode("term")} aria-pressed={mode === "term"}><i className="fa fa-terminal" /><span>Shell</span></button>
                <button type="button" className={cn(mode === "ai" && "is-active")} onClick={() => setMode("ai")} aria-pressed={mode === "ai"}><i className="fa fa-sparkles" /><span>AI</span></button>
            </div>
            {canPaste && mode === "term" && <button type="button" className="shell-command-target" title={cwd || t("shell.openTerminal")} onClick={() => refocusNode(targetBlockId)}><i className="fa fa-terminal" /><span>{pathLabel(cwd) || "Terminal"}</span></button>}
            <input value={text} onChange={(event) => setText(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => {
                if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
            }} placeholder={mode === "ai" ? t("shell.draftAi") : canPaste ? t("shell.pasteTerminal") : t("shell.selectTerminal")} aria-label={mode === "ai" ? t("shell.draftAi") : t("shell.pasteTerminal")} disabled={mode === "term" && !canPaste} />
            <button type="submit" className="shell-command-submit" disabled={!text.trim() || (mode === "term" && !canPaste)} title={mode === "ai" ? t("shell.draftAi") : t("shell.pasteTerminal")} aria-label={mode === "ai" ? t("shell.draftAi") : t("shell.pasteTerminal")}><i className="fa fa-arrow-turn-down fa-rotate-90" /></button>
        </form>
    );
});
WorkspaceCommandBar.displayName = "WorkspaceCommandBar";

export const WorkspaceStatus = memo(() => {
    const t = useT();
    const tabId = useAtomValue(atoms.staticTabId);
    const [tab] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));
    return <footer className="shell-status-bar"><span><i className="shell-status-dot is-connected" />{tab?.name || t("shell.workspace")}</span><span>{t("shell.blockCount", { count: tab?.blockids?.length ?? 0 })}</span><span className="shell-status-brand">Wave Terminal</span><span className="shell-status-palette" aria-hidden="true">{["--sage-accent", "--type-web", "--type-files", "--type-ai"].map((color) => <i key={color} style={{ backgroundColor: `var(${color})` }} />)}</span></footer>;
});
WorkspaceStatus.displayName = "WorkspaceStatus";
