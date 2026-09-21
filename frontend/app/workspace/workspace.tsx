// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AIPanel } from "@/app/aipanel/aipanel";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { CenteredDiv } from "@/app/element/quickelems";
import { ModalsRenderer } from "@/app/modals/modalsrenderer";
import { TabBar } from "@/app/tab/tabbar";
import { TabContent } from "@/app/tab/tabcontent";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { atoms, getApi, getSettingsKeyAtom } from "@/store/global";
import { useT } from "@/util/i18n-hooks";
import { useAtomValue } from "jotai";
import { memo, useEffect, useRef } from "react";
import {
    ImperativePanelGroupHandle,
    ImperativePanelHandle,
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";

import { WorkspaceSidebar } from "./workspace-shell";
import "./workspace.scss";

const WorkspaceElem = memo(() => {
    const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
    const t = useT();
    const tabId = useAtomValue(atoms.staticTabId);
    const ws = useAtomValue(atoms.workspace);
    const tabBarPosition = useAtomValue(getSettingsKeyAtom("app:tabbar")) ?? "top";
    const showLeftTabBar = tabBarPosition === "left";
    const aiPanelVisible = useAtomValue(workspaceLayoutModel.panelVisibleAtom);
    const windowWidth = window.innerWidth;
    const navigationInitialPct = workspaceLayoutModel.getNavigationInitialPercentage(windowWidth);
    const contentInitialPct = workspaceLayoutModel.getContentInitialPercentage(windowWidth);
    const aiInitialPct = workspaceLayoutModel.getAIInitialPercentage(windowWidth);
    const outerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const innerPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const aiPanelRef = useRef<ImperativePanelHandle>(null);
    const panelContainerRef = useRef<HTMLDivElement>(null);
    const aiPanelWrapperRef = useRef<HTMLDivElement>(null);
    const vtabPanelWrapperRef = useRef<HTMLDivElement>(null);

    // The navigation is always present; tab orientation only changes the section inside it.
    // Do NOT add showLeftTabBar as a dep here — re-registering refs on config changes would redundantly re-run commitLayouts.
    useEffect(() => {
        if (
            aiPanelRef.current &&
            outerPanelGroupRef.current &&
            innerPanelGroupRef.current &&
            panelContainerRef.current &&
            aiPanelWrapperRef.current
        ) {
            workspaceLayoutModel.registerRefs(
                aiPanelRef.current,
                outerPanelGroupRef.current,
                innerPanelGroupRef.current,
                panelContainerRef.current,
                aiPanelWrapperRef.current,
                vtabPanelWrapperRef.current ?? undefined
            );
        }
    }, []);

    useEffect(() => {
        const isVisible = workspaceLayoutModel.getAIPanelVisible();
        getApi().setWaveAIOpen(isVisible);
    }, []);

    useEffect(() => {
        window.addEventListener("resize", workspaceLayoutModel.handleWindowResize);
        return () => window.removeEventListener("resize", workspaceLayoutModel.handleWindowResize);
    }, []);

    useEffect(() => {
        const handleFocus = () => workspaceLayoutModel.syncVTabWidthFromMeta();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, []);

    return (
        <div className="workspace-shell">
            <TabBar key={ws.oid} workspace={ws} noTabs={showLeftTabBar} />
            <div ref={panelContainerRef} className="shell-body">
                <ErrorBoundary key={tabId}>
                    <PanelGroup
                        direction="horizontal"
                        onLayout={workspaceLayoutModel.handleOuterPanelLayout}
                        ref={outerPanelGroupRef}
                    >
                        <Panel order={0} defaultSize={navigationInitialPct} className="shell-navigation-panel">
                            <div ref={vtabPanelWrapperRef} className="h-full w-full">
                                <WorkspaceSidebar workspace={ws} verticalTabs={showLeftTabBar} />
                            </div>
                        </Panel>
                        <PanelResizeHandle className="shell-resize-handle" />
                        <Panel order={1} defaultSize={100 - navigationInitialPct}>
                            <PanelGroup
                                direction="horizontal"
                                onLayout={workspaceLayoutModel.handleInnerPanelLayout}
                                ref={innerPanelGroupRef}
                            >
                                <Panel order={0} defaultSize={contentInitialPct}>
                                    <main className="shell-main">
                                        <div className="shell-canvas">
                                            <div className="shell-tiles">
                                                {tabId === "" ? (
                                                    <CenteredDiv>{t("chrome.noActiveTab")}</CenteredDiv>
                                                ) : (
                                                    <TabContent key={tabId} tabId={tabId} noTopPadding />
                                                )}
                                            </div>
                                        </div>
                                    </main>
                                </Panel>
                                <PanelResizeHandle
                                    disabled={!aiPanelVisible}
                                    className={`shell-resize-handle ${aiPanelVisible ? "" : "is-hidden"}`}
                                />
                                <Panel ref={aiPanelRef} collapsible order={1} defaultSize={aiInitialPct}>
                                    <aside
                                        ref={aiPanelWrapperRef}
                                        className={`shell-ai-panel ${aiPanelVisible ? "" : "is-hidden"}`}
                                        aria-label="Wave AI"
                                    >
                                        {tabId !== "" && <AIPanel roundTopLeft={false} />}
                                    </aside>
                                </Panel>
                            </PanelGroup>
                        </Panel>
                    </PanelGroup>
                    <ModalsRenderer />
                </ErrorBoundary>
            </div>
        </div>
    );
});

WorkspaceElem.displayName = "WorkspaceElem";

export { WorkspaceElem as Workspace };
