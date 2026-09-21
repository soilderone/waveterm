// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveAIModel } from "@/app/aipanel/waveai-model";
import { globalStore } from "@/app/store/jotaiStore";
import { isBuilderWindow } from "@/app/store/windowtype";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getLayoutModelForStaticTab } from "@/layout/lib/layoutModelHooks";
import { atoms, getApi, getOrefMetaKeyAtom, recordTEvent, refocusNode } from "@/store/global";
import debug from "debug";
import * as jotai from "jotai";
import { debounce } from "lodash-es";
import { ImperativePanelGroupHandle, ImperativePanelHandle } from "react-resizable-panels";

import { computeWorkspacePanelSizes } from "./workspace-panels";

const dlog = debug("wave:workspace");

const AIPanel_DefaultWidth = 368;
const AIPanel_DefaultWidthRatio = 0.24;
const AIPanel_MinWidth = 300;
const AIPanel_MaxWidthRatio = 0.66;

const VTabBar_DefaultWidth = 206;
const VTabBar_MinWidth = 170;
const VTabBar_MaxWidth = 280;

function clampVTabWidth(w: number): number {
    return Math.max(VTabBar_MinWidth, Math.min(w, VTabBar_MaxWidth));
}

function clampAIPanelWidth(w: number, windowWidth: number): number {
    const maxWidth = Math.floor(windowWidth * AIPanel_MaxWidthRatio);
    if (AIPanel_MinWidth > maxWidth) return AIPanel_MinWidth;
    return Math.max(AIPanel_MinWidth, Math.min(w, maxWidth));
}

class WorkspaceLayoutModel {
    private static instance: WorkspaceLayoutModel | null = null;

    aiPanelRef: ImperativePanelHandle | null;
    vtabPanelRef: ImperativePanelHandle | null;
    outerPanelGroupRef: ImperativePanelGroupHandle | null;
    innerPanelGroupRef: ImperativePanelGroupHandle | null;
    panelContainerRef: HTMLDivElement | null;
    aiPanelWrapperRef: HTMLDivElement | null;
    vtabPanelWrapperRef: HTMLDivElement | null;
    panelVisibleAtom: jotai.PrimitiveAtom<boolean>;
    vtabCollapsedAtom: jotai.PrimitiveAtom<boolean>;

    private inResize: boolean;
    private aiPanelVisible: boolean;
    private aiPanelWidth: number | null;
    private vtabWidth: number;
    private vtabVisible: boolean;
    private vtabCollapsed: boolean;
    private lastCommitKey: string = null;
    private transitionTimeoutRef: NodeJS.Timeout | null = null;
    private focusTimeoutRef: NodeJS.Timeout | null = null;
    private debouncedPersistAIWidth: () => void;
    private debouncedPersistVTabWidth: () => void;
    widgetsSidebarVisibleAtom: jotai.Atom<boolean>;

    private constructor() {
        this.aiPanelRef = null;
        this.vtabPanelRef = null;
        this.outerPanelGroupRef = null;
        this.innerPanelGroupRef = null;
        this.panelContainerRef = null;
        this.aiPanelWrapperRef = null;
        this.vtabPanelWrapperRef = null;
        this.inResize = false;
        this.aiPanelVisible = false;
        this.aiPanelWidth = null;
        this.vtabWidth = VTabBar_DefaultWidth;
        this.vtabVisible = false;
        this.vtabCollapsed = false;
        this.panelVisibleAtom = jotai.atom(false);
        this.vtabCollapsedAtom = jotai.atom(false);
        this.widgetsSidebarVisibleAtom = jotai.atom(
            (get) =>
                get(getOrefMetaKeyAtom(WOS.makeORef("workspace", this.getWorkspaceId()), "layout:widgetsvisible")) ??
                true
        );
        this.initializeFromMeta();

        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.handleOuterPanelLayout = this.handleOuterPanelLayout.bind(this);
        this.handleInnerPanelLayout = this.handleInnerPanelLayout.bind(this);

        this.debouncedPersistAIWidth = debounce(() => {
            if (!this.aiPanelVisible) return;
            const width = this.aiPanelWrapperRef?.offsetWidth;
            if (width == null || width <= 0) return;
            try {
                RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("tab", this.getTabId()),
                    meta: { "waveai:panelwidth": width },
                });
            } catch (e) {
                console.warn("Failed to persist AI panel width:", e);
            }
        }, 300);

        this.debouncedPersistVTabWidth = debounce(() => {
            if (!this.isVTabActive()) return;
            const width = this.vtabPanelWrapperRef?.offsetWidth;
            if (width == null || width <= 0) return;
            try {
                RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("workspace", this.getWorkspaceId()),
                    meta: { "layout:vtabbarwidth": width },
                });
            } catch (e) {
                console.warn("Failed to persist vtabbar width:", e);
            }
        }, 300);
    }

    static getInstance(): WorkspaceLayoutModel {
        if (!WorkspaceLayoutModel.instance) {
            WorkspaceLayoutModel.instance = new WorkspaceLayoutModel();
        }
        return WorkspaceLayoutModel.instance;
    }

    // ---- Meta / persistence helpers ----

    private getTabId(): string {
        return globalStore.get(atoms.staticTabId);
    }

    private getWorkspaceId(): string {
        return globalStore.get(atoms.workspace)?.oid ?? "";
    }

    private getPanelOpenAtom(): jotai.Atom<boolean> {
        return getOrefMetaKeyAtom(WOS.makeORef("tab", this.getTabId()), "waveai:panelopen");
    }

    private getPanelWidthAtom(): jotai.Atom<number> {
        return getOrefMetaKeyAtom(WOS.makeORef("tab", this.getTabId()), "waveai:panelwidth");
    }

    private getVTabBarWidthAtom(): jotai.Atom<number> {
        return getOrefMetaKeyAtom(WOS.makeORef("workspace", this.getWorkspaceId()), "layout:vtabbarwidth");
    }

    private getVTabBarCollapsedAtom(): jotai.Atom<boolean> {
        return getOrefMetaKeyAtom(WOS.makeORef("workspace", this.getWorkspaceId()), "layout:vtabbarcollapsed");
    }

    private isVTabActive(): boolean {
        return this.vtabVisible;
    }

    private initializeFromMeta(): void {
        try {
            const savedVisible = globalStore.get(this.getPanelOpenAtom());
            const savedAIWidth = globalStore.get(this.getPanelWidthAtom());
            const savedVTabWidth = globalStore.get(this.getVTabBarWidthAtom());
            const savedVTabCollapsed = globalStore.get(this.getVTabBarCollapsedAtom());
            if (savedVisible != null) {
                this.aiPanelVisible = savedVisible;
                globalStore.set(this.panelVisibleAtom, savedVisible);
            }
            if (savedAIWidth != null) {
                this.aiPanelWidth = savedAIWidth;
            }
            if (savedVTabWidth != null && savedVTabWidth > 0) {
                this.vtabWidth = savedVTabWidth;
            }
            if (savedVTabCollapsed != null) {
                this.vtabCollapsed = savedVTabCollapsed;
                globalStore.set(this.vtabCollapsedAtom, savedVTabCollapsed);
            }
            const showLeftTabBar = !isBuilderWindow();
            this.vtabVisible = showLeftTabBar;
        } catch (e) {
            console.warn("Failed to initialize from tab meta:", e);
        }
    }

    // ---- Resolved width getters (always clamped) ----

    private getResolvedAIWidth(windowWidth: number): number {
        let w = this.aiPanelWidth;
        if (w == null) {
            w = Math.max(AIPanel_DefaultWidth, windowWidth * AIPanel_DefaultWidthRatio);
            this.aiPanelWidth = w;
        }
        const available = Math.max(0, windowWidth - this.getResolvedVTabWidth() - 280);
        return Math.min(clampAIPanelWidth(w, windowWidth), available);
    }

    private getResolvedVTabWidth(): number {
        return clampVTabWidth(this.vtabWidth);
    }

    // ---- Core layout computation ----
    // All layout decisions flow through computeLayout.
    // It takes the current state (visibility flags + stored px widths)
    // and produces the two percentage arrays for the panel groups.

    private computeLayout(windowWidth: number): { outer: number[]; inner: number[] } {
        const vtabW = this.isVTabActive() ? this.getResolvedVTabWidth() : 0;
        const aiW = this.aiPanelVisible ? this.getResolvedAIWidth(windowWidth) : 0;
        // outer: [navigationPct, contentAndAIPct]
        // inner: [contentPct, aiPanelPct] relative to the remaining width
        return computeWorkspacePanelSizes(windowWidth, vtabW, aiW);
    }

    private commitLayouts(windowWidth: number): void {
        if (!this.outerPanelGroupRef || !this.innerPanelGroupRef) return;
        const { outer, inner } = this.computeLayout(windowWidth);
        // window resize fires for height changes too, but the layout only depends on the width --
        // without this every vertical drag frame ran two setLayout calls and re-rendered both
        // panel groups for an identical result.
        const commitKey = `${windowWidth}|${outer.join(",")}|${inner.join(",")}`;
        if (commitKey == this.lastCommitKey) return;
        this.lastCommitKey = commitKey;
        this.inResize = true;
        this.outerPanelGroupRef.setLayout(outer);
        this.innerPanelGroupRef.setLayout(inner);
        this.inResize = false;
        this.updateWrapperWidth();
    }

    // ---- Drag handlers ----
    // These convert the percentage-based callback from react-resizable-panels
    // back into pixel widths, update stored state, then re-commit.

    handleOuterPanelLayout(sizes: number[]): void {
        if (this.inResize || !this.panelContainerRef) return;
        const windowWidth = window.innerWidth;
        const newLeftGroupPx = (sizes[0] / 100) * windowWidth;

        // Navigation and AI now have separate handles, so resizing one preserves the other.
        this.vtabWidth = clampVTabWidth(newLeftGroupPx);
        this.debouncedPersistVTabWidth();
        this.commitLayouts(windowWidth);
    }

    handleInnerPanelLayout(sizes: number[]): void {
        if (this.inResize || !this.panelContainerRef || !this.aiPanelVisible) return;
        const windowWidth = window.innerWidth;
        const contentGroupW = windowWidth - this.getResolvedVTabWidth();
        this.aiPanelWidth = clampAIPanelWidth((sizes[1] / 100) * contentGroupW, windowWidth);
        this.debouncedPersistAIWidth();
        this.commitLayouts(windowWidth);
    }

    handleWindowResize(): void {
        this.commitLayouts(window.innerWidth);
    }

    // ---- Registration & sync ----

    syncVTabWidthFromMeta(): void {
        const savedVTabWidth = globalStore.get(this.getVTabBarWidthAtom());
        if (savedVTabWidth != null && savedVTabWidth > 0 && savedVTabWidth !== this.vtabWidth) {
            this.vtabWidth = savedVTabWidth;
            this.commitLayouts(window.innerWidth);
        }
    }

    registerRefs(
        aiPanelRef: ImperativePanelHandle,
        outerPanelGroupRef: ImperativePanelGroupHandle,
        innerPanelGroupRef: ImperativePanelGroupHandle,
        panelContainerRef: HTMLDivElement,
        aiPanelWrapperRef: HTMLDivElement,
        vtabPanelRef?: ImperativePanelHandle,
        vtabPanelWrapperRef?: HTMLDivElement,
        showLeftTabBar?: boolean
    ): void {
        this.aiPanelRef = aiPanelRef;
        this.vtabPanelRef = vtabPanelRef ?? null;
        this.outerPanelGroupRef = outerPanelGroupRef;
        this.innerPanelGroupRef = innerPanelGroupRef;
        this.panelContainerRef = panelContainerRef;
        this.aiPanelWrapperRef = aiPanelWrapperRef;
        this.vtabPanelWrapperRef = vtabPanelWrapperRef ?? null;
        this.vtabVisible = showLeftTabBar ?? false;
        // Fresh panel groups start from their defaultSize props, so the commit cache must not
        // suppress the first commit against them.
        this.lastCommitKey = null;
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);
    }

    private syncPanelCollapse(): void {
        if (this.aiPanelRef) {
            if (this.aiPanelVisible) {
                this.aiPanelRef.expand();
            } else {
                this.aiPanelRef.collapse();
            }
        }
        if (this.vtabPanelRef) {
            if (this.isVTabActive()) {
                this.vtabPanelRef.expand();
            } else {
                this.vtabPanelRef.collapse();
            }
        }
    }

    // ---- Transitions ----

    enableTransitions(duration: number): void {
        if (!this.panelContainerRef) return;
        const panels = this.panelContainerRef.querySelectorAll("[data-panel]");
        panels.forEach((panel: HTMLElement) => {
            panel.style.transition = duration > 0 ? "flex 0.2s ease-in-out" : "none";
        });
        if (this.transitionTimeoutRef) {
            clearTimeout(this.transitionTimeoutRef);
        }
        if (duration <= 0) return;
        this.transitionTimeoutRef = setTimeout(() => {
            if (!this.panelContainerRef) return;
            const panels = this.panelContainerRef.querySelectorAll("[data-panel]");
            panels.forEach((panel: HTMLElement) => {
                panel.style.transition = "none";
            });
        }, duration);
    }

    // ---- Wrapper width (AI panel inner content width) ----

    updateWrapperWidth(): void {
        if (!this.aiPanelWrapperRef) return;
        this.aiPanelWrapperRef.style.width = "100%";
    }

    // ---- Public getters ----

    getAIPanelVisible(): boolean {
        return this.aiPanelVisible;
    }

    getAIPanelWidth(): number {
        return this.getResolvedAIWidth(window.innerWidth);
    }

    // ---- Initial percentage helpers (used by workspace.tsx for defaultSize) ----

    getNavigationInitialPercentage(windowWidth: number): number {
        return this.computeLayout(windowWidth).outer[0];
    }

    getContentInitialPercentage(windowWidth: number): number {
        return 100 - this.getAIInitialPercentage(windowWidth);
    }

    getAIInitialPercentage(windowWidth: number): number {
        return this.computeLayout(windowWidth).inner[1];
    }

    // ---- Toggle visibility ----

    setAIPanelVisible(visible: boolean, opts?: { nofocus?: boolean }): void {
        if (this.focusTimeoutRef != null) {
            clearTimeout(this.focusTimeoutRef);
            this.focusTimeoutRef = null;
        }
        const wasVisible = this.aiPanelVisible;
        this.aiPanelVisible = visible;
        if (visible && !wasVisible) {
            recordTEvent("action:openwaveai");
        }
        globalStore.set(this.panelVisibleAtom, visible);
        getApi().setWaveAIOpen(visible);
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("tab", this.getTabId()),
            meta: { "waveai:panelopen": visible },
        });
        this.enableTransitions(0);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);

        if (visible) {
            if (!opts?.nofocus) {
                this.focusTimeoutRef = setTimeout(() => {
                    WaveAIModel.getInstance().focusInput();
                    this.focusTimeoutRef = null;
                }, 350);
            }
        } else {
            const layoutModel = getLayoutModelForStaticTab();
            const focusedNode = globalStore.get(layoutModel.focusedNode);
            if (focusedNode == null) {
                layoutModel.focusFirstNode();
                return;
            }
            const blockId = focusedNode?.data?.blockId;
            if (blockId != null) {
                refocusNode(blockId);
            }
        }
    }

    setVTabCollapsed(collapsed: boolean): void {
        if (this.vtabCollapsed === collapsed) return;
        this.vtabCollapsed = collapsed;
        globalStore.set(this.vtabCollapsedAtom, collapsed);
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("workspace", this.getWorkspaceId()),
            meta: { "layout:vtabbarcollapsed": collapsed },
        });
        this.enableTransitions(0);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);
    }

    setShowLeftTabBar(showLeftTabBar: boolean): void {
        if (this.vtabVisible === showLeftTabBar) return;
        this.vtabVisible = showLeftTabBar;
        if (showLeftTabBar && this.vtabCollapsed) {
            this.vtabCollapsed = false;
            globalStore.set(this.vtabCollapsedAtom, false);
            RpcApi.SetMetaCommand(TabRpcClient, {
                oref: WOS.makeORef("workspace", this.getWorkspaceId()),
                meta: { "layout:vtabbarcollapsed": false },
            });
        }
        this.enableTransitions(0);
        this.syncPanelCollapse();
        this.commitLayouts(window.innerWidth);
    }
}

export { WorkspaceLayoutModel };
