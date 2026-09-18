// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { CenteredDiv } from "@/app/element/quickelems";
import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { BlockHeaderSuggestionControl } from "@/app/suggestion/suggestion";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { cn, fireAndForget, isBlank, makeConnRoute } from "@/util/util";
import { useT } from "@/util/i18n-hooks";
import { formatRemoteUri } from "@/util/waveutil";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CSVView } from "./csvview";
import { FileTree } from "./preview-directory";
import { CodeEditPreview } from "./preview-edit";
import { ErrorOverlay } from "./preview-error-overlay";
import { MarkdownPreview } from "./preview-markdown";
import type { PreviewModel } from "./preview-model";
import { isPathInside } from "./preview-path";
import { StreamingPreview } from "./preview-streaming";
import type { PreviewEnv } from "./previewenv";

export type SpecializedViewProps = {
    model: PreviewModel;
    parentRef: React.RefObject<HTMLDivElement>;
};

const SpecializedViewMap: { [view: string]: ({ model }: SpecializedViewProps) => React.JSX.Element } = {
    streaming: StreamingPreview,
    markdown: MarkdownPreview,
    codeedit: CodeEditPreview,
    csv: CSVViewPreview,
};

function canPreview(mimeType: string): boolean {
    if (mimeType == null) {
        return false;
    }
    return mimeType.startsWith("text/markdown") || mimeType.startsWith("text/csv");
}

function CSVViewPreview({ model, parentRef }: SpecializedViewProps) {
    const fileContent = useAtomValue(model.fileContent);
    const fileName = useAtomValue(model.statFilePath);
    return <CSVView parentRef={parentRef} readonly={true} content={fileContent} filename={fileName} />;
}

const SpecializedView = memo(({ parentRef, model }: SpecializedViewProps) => {
    const specializedView = useAtomValue(model.specializedView);
    const mimeType = useAtomValue(model.fileMimeType);
    const setCanPreview = useSetAtom(model.canPreview);
    const path = useAtomValue(model.statFilePath);

    useEffect(() => {
        setCanPreview(canPreview(mimeType));
    }, [mimeType, setCanPreview]);

    if (specializedView.errorStr != null) {
        return <CenteredDiv>{specializedView.errorStr}</CenteredDiv>;
    }
    const SpecializedViewComponent = SpecializedViewMap[specializedView.specializedView];
    if (!SpecializedViewComponent) {
        return <CenteredDiv>Invalid Specialized View Component ({specializedView.specializedView})</CenteredDiv>;
    }
    return <SpecializedViewComponent key={path} model={model} parentRef={parentRef} />;
});

SpecializedView.displayName = "SpecializedView";

type PreviewTreeRoot = {
    connection: string;
    directory: FileInfo;
};

// The tree root tracks the block's current location so the header path and the tree can never
// disagree. Navigating to a directory re-roots the tree there; opening a file keeps the existing
// root as long as the file lives under it, which is what stops the tree from jumping around while
// clicking through files. A file outside the root clears it so the effect below can re-resolve.
export function getPreviewTreeRoot(
    current: PreviewTreeRoot,
    connection: string,
    fileInfo: Loadable<FileInfo>
): PreviewTreeRoot {
    if (current.connection != connection) {
        return { connection, directory: null };
    }
    if (fileInfo.state != "hasData" || fileInfo.data == null) {
        return current;
    }
    const info = fileInfo.data;
    if (info.isdir) {
        if (current.directory?.path == info.path) {
            return current;
        }
        return { connection, directory: info };
    }
    if (current.directory == null || isPathInside(info.path, current.directory.path)) {
        return current;
    }
    return { connection, directory: null };
}

const fetchSuggestions = async (
    env: PreviewEnv,
    model: PreviewModel,
    query: string,
    reqContext: SuggestionRequestContext
): Promise<FetchSuggestionsResponse> => {
    const conn = await globalStore.get(model.connection);
    let route = makeConnRoute(conn);
    if (isBlank(conn)) {
        route = null;
    }
    if (reqContext?.dispose) {
        env.rpc.DisposeSuggestionsCommand(TabRpcClient, reqContext.widgetid, { noresponse: true, route: route });
        return null;
    }
    const fileInfo = await globalStore.get(model.statFile);
    if (fileInfo == null) {
        return null;
    }
    const sdata = {
        suggestiontype: "file",
        "file:cwd": fileInfo.path,
        query: query,
        widgetid: reqContext.widgetid,
        reqnum: reqContext.reqnum,
        "file:connection": conn,
    };
    return await env.rpc.FetchSuggestionsCommand(TabRpcClient, sdata, {
        route: route,
    });
};

const TabDirtyDot = memo(({ model }: { model: PreviewModel }) => {
    const dirty = useAtomValue(model.newFileContent) != null;
    if (!dirty) {
        return null;
    }
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />;
});

TabDirtyDot.displayName = "TabDirtyDot";

function PreviewView({
    blockRef,
    contentRef,
    model,
}: {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: PreviewModel;
}) {
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const connStatus = useAtomValue(model.connStatus);
    const [errorMsg, setErrorMsg] = useAtom(model.errorMsgAtom);
    const connection = useAtomValue(model.connectionImmediate);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const fileInfo = loadableFileInfo.state == "hasData" ? loadableFileInfo.data : null;
    const metaFilePath = useAtomValue(model.metaFilePath);
    const openTabs = useAtomValue(model.openTabs);
    const setOpenTabs = useSetAtom(model.openTabs);
    // The right pane previews files only; browsing a directory is the tree's job.
    const showPreview = openTabs.length > 0 || (fileInfo != null && !fileInfo.isdir);
    const [treeCollapsed, setTreeCollapsed] = useState(false);
    const treePanelRef = useRef<ImperativePanelHandle>(null);
    const [treeRoot, setTreeRoot] = useState<PreviewTreeRoot>({ connection, directory: null });
    const root = getPreviewTreeRoot(treeRoot, connection, loadableFileInfo);

    // Navigating the block (rather than only re-rooting the tree) keeps the header path, the
    // history stack and the tree pointing at the same directory.
    const handleTreeUp = useCallback(() => {
        const parentPath = root.directory?.dir;
        if (parentPath == null || parentPath == root.directory?.path) {
            return;
        }
        fireAndForget(() => model.goHistory(parentPath));
    }, [root.directory?.dir, root.directory?.path, model]);

    useEffect(() => {
        if (root != treeRoot) {
            setTreeRoot(root);
            return;
        }
        if (root.directory || !fileInfo?.dir || connStatus?.status != "connected") {
            return;
        }
        let active = true;
        env.rpc
            .FileInfoCommand(TabRpcClient, { info: { path: formatRemoteUri(fileInfo.dir, connection) } })
            .then((directory) => {
                if (
                    active &&
                    directory?.isdir &&
                    globalStore.get(model.connectionImmediate) == connection &&
                    globalStore.get(model.metaFilePath) == metaFilePath
                ) {
                    setTreeRoot({ connection, directory });
                }
            })
            .catch((e) => {
                if (active) {
                    setErrorMsg((current) => current ?? { status: t("preview.cannotReadDir"), text: String(e) });
                }
            });
        return () => {
            active = false;
        };
    }, [root, treeRoot, fileInfo, connection, metaFilePath, connStatus?.status, env.rpc, model, setErrorMsg]);

    useEffect(() => {
        if (!fileInfo?.path || fileInfo.isdir) {
            return;
        }
        setOpenTabs((tabs) => (tabs.includes(fileInfo.path) ? tabs : [...tabs, fileInfo.path]));
    }, [fileInfo?.path, fileInfo?.isdir, setOpenTabs]);

    useEffect(() => {
        if (!fileInfo) {
            return;
        }
        setErrorMsg((current) => (current?.level == "warning" ? current : null));
    }, [connection, fileInfo, setErrorMsg]);

    if (connStatus?.status != "connected") {
        return null;
    }
    const handleSelect = (s: SuggestionType, queryStr: string): boolean => {
        if (s == null) {
            if (isBlank(queryStr)) {
                globalStore.set(model.openFileModal, false);
                return true;
            }
            model.handleOpenFile(queryStr);
            return true;
        }
        model.handleOpenFile(s["file:path"]);
        return true;
    };
    const handleTab = (s: SuggestionType): string => {
        if (s["file:mimetype"] == "directory") {
            return s["file:name"] + "/";
        } else {
            return s["file:name"];
        }
    };
    const fetchSuggestionsFn = async (query, ctx) => {
        return await fetchSuggestions(env, model, query, ctx);
    };

    const toggleTree = () => {
        const panel = treePanelRef.current;
        if (panel == null) {
            return;
        }
        if (panel.isCollapsed()) {
            panel.expand();
        } else {
            panel.collapse();
        }
    };

    const canNavigateUp = root.directory != null && root.directory.dir != root.directory.path;

    const treeElem = root.directory ? (
        <FileTree
            model={model}
            rootPath={root.directory.path}
            onNavigateUp={canNavigateUp ? handleTreeUp : null}
        />
    ) : null;

    const previewElem = (
        <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex h-8 shrink-0 select-none items-stretch border-b border-border bg-white/5">
                <div
                    role="tablist"
                    aria-label={t("preview.openFiles")}
                    className="flex min-w-0 flex-1 items-stretch overflow-x-auto scrollbar-hide-until-hover"
                >
                    {openTabs.map((tabPath) => {
                        const active = tabPath == metaFilePath;
                        const name = tabPath.split("/").pop() || tabPath;
                        return (
                            <div
                                key={tabPath}
                                role="tab"
                                aria-selected={active}
                                title={tabPath}
                                className={cn(
                                    "group flex h-full min-w-0 max-w-48 shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-r-border border-t border-t-transparent px-2.5 text-xs transition-colors",
                                    active
                                        ? "border-t-accent bg-background text-primary"
                                        : "text-secondary hover:bg-white/5 hover:text-primary"
                                )}
                                onClick={() => fireAndForget(() => model.openTreeFile(tabPath))}
                                onAuxClick={(e) => {
                                    if (e.button != 1) {
                                        return;
                                    }
                                    e.preventDefault();
                                    fireAndForget(() => model.closeFileTab(tabPath));
                                }}
                            >
                                <span className="truncate">{name}</span>
                                {active && <TabDirtyDot model={model} />}
                                <button
                                    type="button"
                                    title={t("preview.closeFile")}
                                    aria-label={t("preview.closeFileNamed", { name })}
                                    className={cn(
                                        "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded transition-opacity hover:bg-white/10 focus-visible:opacity-100",
                                        active ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fireAndForget(() => model.closeFileTab(tabPath));
                                    }}
                                >
                                    <i className="fa-solid fa-xmark text-[10px]" />
                                </button>
                            </div>
                        );
                    })}
                </div>
                {root.directory && (
                    <button
                        type="button"
                        title={treeCollapsed ? t("preview.showFileTree") : t("preview.hideFileTree")}
                        aria-label={treeCollapsed ? t("preview.showFileTree") : t("preview.hideFileTree")}
                        aria-expanded={!treeCollapsed}
                        className="mx-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center self-center rounded text-xs text-secondary transition-colors hover:bg-white/10 hover:text-primary"
                        onClick={toggleTree}
                    >
                        <i className={treeCollapsed ? "fa-solid fa-bars" : "fa-solid fa-columns"} />
                    </button>
                )}
            </div>
            <div ref={contentRef} className="min-h-0 flex-1 overflow-hidden">
                {fileInfo?.isdir ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-secondary">
                        <i aria-hidden="true" className="fa-solid fa-file text-4xl opacity-20" />
                        <div className="text-sm">{t("preview.selectFile")}</div>
                        <div className="text-xs opacity-60">{t("preview.clickFileHint")}</div>
                    </div>
                ) : (
                    <Suspense fallback={<CenteredDiv>{t("preview.loading")}</CenteredDiv>}>
                        <SpecializedView parentRef={contentRef} model={model} />
                    </Suspense>
                )}
            </div>
        </div>
    );

    return (
        <>
            <div
                key="fullpreview"
                className="relative flex h-full min-h-0 w-full overflow-hidden scrollbar-hide-until-hover"
            >
                {errorMsg && <ErrorOverlay errorMsg={errorMsg} resetOverlay={() => setErrorMsg(null)} />}
                {showPreview ? (
                    {/* The tree panel is conditional, so both panels need stable id/order --
                        without them the group registers panels in mount order and the resize
                        handle ends up driving the wrong one, which inverts the drag direction. */}
                    <PanelGroup direction="horizontal" className="h-full w-full">
                        {treeElem && (
                            <>
                                <Panel
                                    id="preview-tree"
                                    order={1}
                                    ref={treePanelRef}
                                    collapsible
                                    collapsedSize={0}
                                    defaultSize={22}
                                    minSize={12}
                                    maxSize={45}
                                    onCollapse={() => setTreeCollapsed(true)}
                                    onExpand={() => setTreeCollapsed(false)}
                                    className="overflow-hidden"
                                >
                                    {treeElem}
                                </Panel>
                                <PanelResizeHandle
                                    className={cn(
                                        "w-0.5 bg-border transition-colors",
                                        !treeCollapsed && "hover:bg-accent"
                                    )}
                                />
                            </>
                        )}
                        <Panel id="preview-content" order={2} minSize={30} className="overflow-hidden">
                            {previewElem}
                        </Panel>
                    </PanelGroup>
                ) : (
                    <div className="h-full w-full">{treeElem}</div>
                )}
            </div>
            <BlockHeaderSuggestionControl
                blockRef={blockRef}
                openAtom={model.openFileModal}
                onClose={() => model.updateOpenFileModalAndError(false)}
                onSelect={handleSelect}
                onTab={handleTab}
                fetchSuggestions={fetchSuggestionsFn}
                placeholderText={t("preview.openFilePlaceholder")}
            />
        </>
    );
}

export { PreviewView };
