// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { globalStore } from "@/app/store/jotaiStore";
import type { TabModel } from "@/app/store/tab-model";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { getOverrideConfigAtom, refocusNode } from "@/store/global";
import * as WOS from "@/store/wos";
import { goHistory, goHistoryBack, goHistoryForward } from "@/util/historyutil";
import { checkKeyPressed } from "@/util/keyutil";
import { t } from "@/util/i18n";
import { addOpenMenuItems } from "@/util/previewutil";
import { base64ToString, fireAndForget, isBlank, jotaiLoadableValue, stringToBase64 } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import clsx from "clsx";
import { Atom, atom, Getter, PrimitiveAtom, WritableAtom } from "jotai";
import { loadable } from "jotai/utils";
import type * as MonacoTypes from "monaco-editor";
import { createRef } from "react";
import { PreviewView } from "./preview";
import {
    getDefaultSortDesc,
    makeDirectoryDefaultMenuItems,
    makeTreeSortMenuItems,
    type TreeSortType,
} from "./preview-directory-utils";
import { getParentPath, isPathInside, remapPath, resolveTypedPath } from "./preview-path";
import type { PreviewEnv } from "./previewenv";

// TODO drive this using config
function getBookmarks(): { label: string; path: string }[] {
    return [
        { label: t("preview.bookmarkHome"), path: "~" },
        { label: t("preview.bookmarkDesktop"), path: "~/Desktop" },
        { label: t("preview.bookmarkDownloads"), path: "~/Downloads" },
        { label: t("preview.bookmarkDocuments"), path: "~/Documents" },
        { label: t("preview.bookmarkRoot"), path: "/" },
    ];
}

const MaxFileSize = 1024 * 1024 * 10; // 10MB
const MaxCSVSize = 1024 * 1024 * 1; // 1MB

const textApplicationMimetypes = [
    "application/sql",
    "application/x-php",
    "application/x-pem-file",
    "application/x-httpd-php",
    "application/liquid",
    "application/graphql",
    "application/javascript",
    "application/typescript",
    "application/x-javascript",
    "application/x-typescript",
    "application/dart",
    "application/vnd.dart",
    "application/x-ruby",
    "application/sql",
    "application/wasm",
    "application/x-latex",
    "application/x-sh",
    "application/x-python",
    "application/x-awk",
];

function isTextFile(mimeType: string): boolean {
    if (mimeType == null) {
        return false;
    }
    return (
        mimeType.startsWith("text/") ||
        textApplicationMimetypes.includes(mimeType) ||
        (mimeType.startsWith("application/") &&
            (mimeType.includes("json") || mimeType.includes("yaml") || mimeType.includes("toml"))) ||
        mimeType.includes("xml")
    );
}

function isStreamingType(mimeType: string): boolean {
    if (mimeType == null) {
        return false;
    }
    return (
        mimeType.startsWith("application/pdf") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/") ||
        mimeType.startsWith("image/")
    );
}

function isMarkdownLike(mimeType: string): boolean {
    if (mimeType == null) {
        return false;
    }
    return mimeType.startsWith("text/markdown") || mimeType.startsWith("text/mdx");
}

function iconForFile(mimeType: string): string {
    if (mimeType == null) {
        mimeType = "unknown";
    }
    if (mimeType == "application/pdf") {
        return "file-pdf";
    } else if (mimeType.startsWith("image/")) {
        return "image";
    } else if (mimeType.startsWith("video/")) {
        return "film";
    } else if (mimeType.startsWith("audio/")) {
        return "headphones";
    } else if (isMarkdownLike(mimeType)) {
        return "file-lines";
    } else if (mimeType == "text/csv") {
        return "file-csv";
    } else if (
        mimeType.startsWith("text/") ||
        mimeType == "application/sql" ||
        (mimeType.startsWith("application/") &&
            (mimeType.includes("json") || mimeType.includes("yaml") || mimeType.includes("toml")))
    ) {
        return "file-code";
    } else {
        return "file";
    }
}

export class PreviewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    noPadding?: Atom<boolean>;
    blockAtom: Atom<Block>;
    viewIcon: Atom<string | IconButtonDecl>;
    viewName: Atom<string>;
    viewText: Atom<HeaderElem[]>;
    preIconButton: Atom<IconButtonDecl>;
    endIconButtons: Atom<IconButtonDecl[]>;
    hideViewName: Atom<boolean>;
    previewTextRef: React.RefObject<HTMLDivElement>;
    pathEditing: PrimitiveAtom<boolean>;
    pathEditValue: PrimitiveAtom<string>;
    pathInputRef: React.RefObject<HTMLInputElement>;
    editMode: Atom<boolean>;
    canPreview: PrimitiveAtom<boolean>;
    specializedView: Atom<Promise<{ specializedView?: string; errorStr?: string }>>;
    loadableSpecializedView: Atom<Loadable<{ specializedView?: string; errorStr?: string }>>;
    manageConnection: Atom<boolean>;
    connStatus: Atom<ConnStatus>;
    filterOutNowsh?: Atom<boolean>;

    metaFilePath: Atom<string>;
    statFilePath: Atom<Promise<string>>;
    loadableFileInfo: Atom<Loadable<FileInfo>>;
    connection: Atom<Promise<string>>;
    connectionImmediate: Atom<string>;
    statFile: Atom<Promise<FileInfo>>;
    fullFile: Atom<Promise<FileData>>;
    fileMimeType: Atom<Promise<string>>;
    fileMimeTypeLoadable: Atom<Loadable<string>>;
    fileContentSaved: PrimitiveAtom<string | null>;
    fileContent: WritableAtom<Promise<string>, [string], void>;
    newFileContent: PrimitiveAtom<string | null>;
    connectionError: PrimitiveAtom<string>;
    errorMsgAtom: PrimitiveAtom<ErrorMsg>;

    openFileModal: PrimitiveAtom<boolean>;
    openFileModalDelay: PrimitiveAtom<boolean>;
    openFileError: PrimitiveAtom<string>;
    openFileModalGiveFocusRef: React.RefObject<() => boolean>;

    markdownShowToc: PrimitiveAtom<boolean>;

    monacoRef: React.RefObject<MonacoTypes.editor.IStandaloneCodeEditor>;

    showHiddenFiles: PrimitiveAtom<boolean>;
    refreshVersion: PrimitiveAtom<number>;
    openTabs: PrimitiveAtom<string[]>;
    treeSort: PrimitiveAtom<TreeSortType>;
    directorySearchActive: PrimitiveAtom<boolean>;
    refreshCallback: () => void;
    directoryKeyDownHandler: (waveEvent: WaveKeyboardEvent) => boolean;
    codeEditKeyDownHandler: (waveEvent: WaveKeyboardEvent) => boolean;
    env: PreviewEnv;

    constructor({ blockId, nodeModel, tabModel, waveEnv }: ViewModelInitType) {
        this.viewType = "preview";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.env = waveEnv;
        let showHiddenFiles = globalStore.get(this.env.getSettingsKeyAtom("preview:showhiddenfiles")) ?? true;
        this.showHiddenFiles = atom<boolean>(showHiddenFiles);
        this.refreshVersion = atom(0);
        this.openTabs = atom<string[]>([]);
        const defaultSort = globalStore.get(this.env.getSettingsKeyAtom("preview:defaultsort")) ?? "name";
        this.treeSort = atom<TreeSortType>({ field: defaultSort, desc: getDefaultSortDesc(defaultSort) });
        this.directorySearchActive = atom(false);
        this.previewTextRef = createRef();
        this.pathEditing = atom(false);
        this.pathEditValue = atom("");
        this.pathInputRef = createRef();
        this.openFileModal = atom(false);
        this.openFileModalDelay = atom(false);
        this.openFileError = atom(null) as PrimitiveAtom<string>;
        this.openFileModalGiveFocusRef = createRef();
        this.manageConnection = atom(true);
        this.blockAtom = this.env.wos.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.markdownShowToc = atom(false);
        this.filterOutNowsh = atom(true);
        this.monacoRef = createRef();
        this.connectionError = atom("");
        this.errorMsgAtom = atom(null) as PrimitiveAtom<ErrorMsg | null>;
        this.viewIcon = atom((get) => {
            const blockData = get(this.blockAtom);
            if (blockData?.meta?.icon) {
                return blockData.meta.icon;
            }
            const connStatus = get(this.connStatus);
            if (connStatus?.status != "connected") {
                return null;
            }
            const mimeTypeLoadable = get(this.fileMimeTypeLoadable);
            const mimeType = jotaiLoadableValue(mimeTypeLoadable, "");
            if (mimeType == "directory") {
                return {
                    elemtype: "iconbutton",
                    icon: "folder-open",
                    longClick: (e: React.MouseEvent<any>) => {
                        const menuItems: ContextMenuItem[] = getBookmarks().map((bookmark) => ({
                            label: t("preview.goToBookmark", { label: bookmark.label, path: bookmark.path }),
                            click: () => this.goHistory(bookmark.path),
                        }));
                        ContextMenuModel.getInstance().showContextMenu(menuItems, e);
                    },
                };
            }
            return iconForFile(mimeType);
        });
        this.editMode = atom((get) => {
            const blockData = get(this.blockAtom);
            return blockData?.meta?.edit ?? false;
        });
        this.viewName = atom("Preview");
        this.hideViewName = atom(true);
        this.viewText = atom((get) => {
            let headerPath = get(this.metaFilePath);
            const connStatus = get(this.connStatus);
            if (connStatus?.status != "connected") {
                return [
                    {
                        elemtype: "text",
                        text: headerPath,
                        className: "preview-filename",
                    },
                ];
            }
            if (get(this.pathEditing)) {
                return [
                    {
                        elemtype: "div",
                        className: "preview-path-editor",
                        children: [
                            {
                                elemtype: "input",
                                value: get(this.pathEditValue),
                                ref: this.pathInputRef,
                                className: "preview-path-input",
                                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                                    globalStore.set(this.pathEditValue, e.target.value),
                                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => this.handlePathEditKeyDown(e),
                                onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
                                onBlur: () => this.cancelPathEdit(),
                            },
                        ],
                    },
                ] as HeaderElem[];
            }
            const loadableSV = get(this.loadableSpecializedView);
            const isCeView = loadableSV.state == "hasData" && loadableSV.data.specializedView == "codeedit";
            const loadableFileInfo = get(this.loadableFileInfo);
            let homeAbsPath: string = null;
            if (loadableFileInfo.state == "hasData") {
                headerPath = loadableFileInfo.data?.path;
                if (headerPath == "~") {
                    homeAbsPath = loadableFileInfo.data?.dir + "/" + loadableFileInfo.data?.name;
                }
            }
            if (!isBlank(headerPath) && headerPath != "/" && headerPath.endsWith("/")) {
                headerPath = headerPath.slice(0, -1);
            }
            const viewTextChildren: HeaderElem[] = [
                {
                    elemtype: "text",
                    text: headerPath,
                    ref: this.previewTextRef,
                    className: "preview-filename",
                    noGrow: homeAbsPath != null,
                    onClick: () => this.startPathEdit(),
                },
            ];
            if (homeAbsPath != null) {
                viewTextChildren.push({
                    elemtype: "text",
                    text: homeAbsPath,
                    className: "preview-abspath",
                    onClick: () => this.startPathEdit(),
                });
            }
            let saveClassName = "grey";
            if (get(this.newFileContent) !== null) {
                saveClassName = "green";
            }
            if (isCeView) {
                const fileInfo = globalStore.get(this.loadableFileInfo);
                if (fileInfo.state != "hasData") {
                    viewTextChildren.push({
                        elemtype: "textbutton",
                        text: "Loading ...",
                        className: clsx(`grey rounded-[4px] !py-[2px] !px-[10px] text-[11px] font-[500]`),
                        onClick: () => {},
                    });
                } else if (fileInfo.data.readonly) {
                    viewTextChildren.push({
                        elemtype: "textbutton",
                        text: "Read Only",
                        className: clsx(`yellow rounded-[4px] !py-[2px] !px-[10px] text-[11px] font-[500]`),
                        onClick: () => {},
                    });
                } else {
                    viewTextChildren.push({
                        elemtype: "textbutton",
                        text: "Save",
                        className: clsx(`${saveClassName} rounded-[4px] !py-[2px] !px-[10px] text-[11px] font-[500]`),
                        onClick: () => fireAndForget(this.handleFileSave.bind(this)),
                    });
                }
                if (get(this.canPreview)) {
                    viewTextChildren.push({
                        elemtype: "textbutton",
                        text: "Preview",
                        className: "grey rounded-[4px] !py-[2px] !px-[10px] text-[11px] font-[500]",
                        onClick: () => fireAndForget(() => this.setEditMode(false)),
                    });
                }
            } else if (get(this.canPreview)) {
                viewTextChildren.push({
                    elemtype: "textbutton",
                    text: "Edit",
                    className: "grey rounded-[4px] !py-[2px] !px-[10px] text-[11px] font-[500]",
                    onClick: () => fireAndForget(() => this.setEditMode(true)),
                });
            }
            return [
                {
                    elemtype: "div",
                    children: viewTextChildren,
                },
            ] as HeaderElem[];
        });
        this.preIconButton = atom((get) => {
            const connStatus = get(this.connStatus);
            if (connStatus?.status != "connected") {
                return null;
            }
            const mimeType = jotaiLoadableValue(get(this.fileMimeTypeLoadable), "");
            const metaPath = get(this.metaFilePath);
            if (mimeType == "directory" && metaPath == "/") {
                return null;
            }
            return {
                elemtype: "iconbutton",
                icon: "chevron-left",
                click: this.goParentDirectory.bind(this),
            };
        });
        this.endIconButtons = atom((get) => {
            const connStatus = get(this.connStatus);
            if (connStatus?.status != "connected") {
                return null;
            }
            const mimeType = jotaiLoadableValue(get(this.fileMimeTypeLoadable), "");
            const loadableSV = get(this.loadableSpecializedView);
            const isCeView = loadableSV.state == "hasData" && loadableSV.data.specializedView == "codeedit";
            // Kept for every file type (and while the file is missing or loading): it is the only way
            // to pull disk changes into the file tree, which sits beside whatever file is open.
            // The hidden-files toggle lives in the tree's filter bar (preview-directory.tsx).
            const refreshButton: IconButtonDecl = {
                elemtype: "iconbutton",
                icon: "arrows-rotate",
                title: t("common.refresh"),
                click: () => this.refresh(),
            };
            if (!isCeView && isMarkdownLike(mimeType)) {
                return [
                    {
                        elemtype: "iconbutton",
                        icon: "book",
                        title: "Table of Contents",
                        click: () => this.markdownShowTocToggle(),
                    },
                    refreshButton,
                ] as IconButtonDecl[];
            }
            return [refreshButton];
        });
        this.metaFilePath = atom<string>((get) => {
            const file = get(this.blockAtom)?.meta?.file;
            if (isBlank(file)) {
                return "~";
            }
            return file;
        });
        this.statFilePath = atom<Promise<string>>(async (get) => {
            const fileInfo = await get(this.statFile);
            return fileInfo?.path;
        });
        this.connection = atom<Promise<string>>(async (get) => {
            const connName = get(this.blockAtom)?.meta?.connection;
            try {
                await this.env.rpc.ConnEnsureCommand(TabRpcClient, { connname: connName }, { timeout: 60000 });
                globalStore.set(this.connectionError, "");
            } catch (e) {
                globalStore.set(this.connectionError, e as string);
            }
            return connName;
        });
        this.connectionImmediate = atom<string>((get) => {
            return get(this.blockAtom)?.meta?.connection;
        });
        this.statFile = atom<Promise<FileInfo>>(async (get) => {
            const fileName = get(this.metaFilePath);
            const path = await this.formatRemoteUri(fileName, get);
            if (fileName == null) {
                return null;
            }
            try {
                const statFile = await this.env.rpc.FileInfoCommand(TabRpcClient, {
                    info: {
                        path,
                    },
                });
                return statFile;
            } catch (e) {
                const errorStatus: ErrorMsg = {
                    status: t("preview.fileReadFailed"),
                    text: `${e}`,
                };
                globalStore.set(this.errorMsgAtom, errorStatus);
            }
        });
        this.fileMimeType = atom<Promise<string>>(async (get) => {
            const fileInfo = await get(this.statFile);
            return fileInfo?.mimetype;
        });
        this.fileMimeTypeLoadable = loadable(this.fileMimeType);
        this.newFileContent = atom(null) as PrimitiveAtom<string | null>;
        this.goParentDirectory = this.goParentDirectory.bind(this);

        const fullFileAtom = atom<Promise<FileData>>(async (get) => {
            get(this.refreshVersion); // Subscribe to refreshVersion to trigger re-fetch
            const fileName = get(this.metaFilePath);
            const path = await this.formatRemoteUri(fileName, get);
            if (fileName == null) {
                return null;
            }
            try {
                const file = await this.env.rpc.FileReadCommand(TabRpcClient, {
                    info: {
                        path,
                    },
                });
                return file;
            } catch (e) {
                const errorStatus: ErrorMsg = {
                    status: t("preview.fileReadFailed"),
                    text: `${e}`,
                };
                globalStore.set(this.errorMsgAtom, errorStatus);
            }
        });

        this.fileContentSaved = atom(null) as PrimitiveAtom<string | null>;
        const fileContentAtom = atom(
            async (get) => {
                const newContent = get(this.newFileContent);
                if (newContent != null) {
                    return newContent;
                }
                const savedContent = get(this.fileContentSaved);
                if (savedContent != null) {
                    return savedContent;
                }
                const fullFile = await get(fullFileAtom);
                return base64ToString(fullFile?.data64);
            },
            (_, set, update: string) => {
                set(this.fileContentSaved, update);
            }
        );

        this.fullFile = fullFileAtom;
        this.fileContent = fileContentAtom;

        this.specializedView = atom<Promise<{ specializedView?: string; errorStr?: string }>>(async (get) => {
            return this.getSpecializedView(get);
        });
        this.loadableSpecializedView = loadable(this.specializedView);
        this.canPreview = atom(false);
        this.loadableFileInfo = loadable(this.statFile);
        this.connStatus = atom((get) => {
            const blockData = get(this.blockAtom);
            const connName = blockData?.meta?.connection;
            const connAtom = this.env.getConnStatusAtom(connName);
            return get(connAtom);
        });

        this.noPadding = atom(true);
    }

    // Views that don't register a refreshCallback (images, PDFs, ...) still need the button to
    // refresh the tree, which folds refreshVersion into every directory it lists.
    refresh() {
        if (this.refreshCallback) {
            this.refreshCallback();
            return;
        }
        globalStore.set(this.refreshVersion, (v) => v + 1);
    }

    markdownShowTocToggle() {
        globalStore.set(this.markdownShowToc, !globalStore.get(this.markdownShowToc));
    }

    get viewComponent(): ViewComponent {
        return PreviewView;
    }

    async getSpecializedView(getFn: Getter): Promise<{ specializedView?: string; errorStr?: string }> {
        const mimeType = await getFn(this.fileMimeType);
        const fileInfo = await getFn(this.statFile);
        const fileName = fileInfo?.name;
        const connErr = getFn(this.connectionError);
        const editMode = getFn(this.editMode);
        const genErr = getFn(this.errorMsgAtom);

        if (!fileInfo) {
            return { errorStr: t("preview.loadError", { text: genErr?.text }) };
        }
        if (connErr != "") {
            return { errorStr: t("preview.connectionError", { text: connErr }) };
        }
        if (fileInfo?.notfound) {
            return { specializedView: "codeedit" };
        }
        if (mimeType == null) {
            return { errorStr: t("preview.unableMimetype", { path: fileInfo.path }) };
        }
        if (isStreamingType(mimeType)) {
            return { specializedView: "streaming" };
        }
        if (!fileInfo) {
            const fileNameStr = fileName ? " " + JSON.stringify(fileName) : "";
            return { errorStr: t("preview.fileNotFound", { name: fileNameStr }) };
        }
        if (fileInfo.size > MaxFileSize) {
            return { errorStr: t("preview.fileTooLarge") };
        }
        if (mimeType == "text/csv" && fileInfo.size > MaxCSVSize) {
            return { errorStr: t("preview.csvTooLarge") };
        }
        if (mimeType == "directory") {
            return { specializedView: "directory" };
        }
        if (mimeType == "text/csv") {
            if (editMode) {
                return { specializedView: "codeedit" };
            }
            return { specializedView: "csv" };
        }
        if (isMarkdownLike(mimeType)) {
            if (editMode) {
                return { specializedView: "codeedit" };
            }
            return { specializedView: "markdown" };
        }
        if (isTextFile(mimeType) || fileInfo.size == 0) {
            return { specializedView: "codeedit" };
        }
        return { errorStr: t("preview.previewUnavailable", { mime: mimeType }) };
    }

    startPathEdit() {
        const fileInfo = jotaiLoadableValue(globalStore.get(this.loadableFileInfo), null);
        globalStore.set(this.pathEditValue, fileInfo?.path ?? globalStore.get(this.metaFilePath) ?? "");
        globalStore.set(this.pathEditing, true);
        requestAnimationFrame(() => {
            this.pathInputRef.current?.focus();
            this.pathInputRef.current?.select();
        });
    }

    cancelPathEdit() {
        globalStore.set(this.pathEditing, false);
    }

    handlePathEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        // Enter/Escape also confirm or cancel an IME composition (e.g. a Chinese folder name)
        if (e.nativeEvent.isComposing) {
            return;
        }
        if (e.key == "Enter") {
            e.preventDefault();
            fireAndForget(() => this.submitPathEdit());
            return;
        }
        if (e.key == "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.cancelPathEdit();
            refocusNode(this.blockId);
        }
    }

    // The target is stat'ed before navigating: goHistory to a missing path would land in the editor
    // as a new, unsaved file, which is not what jumping to a mistyped path should do.
    async submitPathEdit() {
        const fileInfo = jotaiLoadableValue(globalStore.get(this.loadableFileInfo), null);
        const baseDir = fileInfo?.isdir ? fileInfo.path : fileInfo?.dir;
        const target = resolveTypedPath(globalStore.get(this.pathEditValue), baseDir);
        if (target == null || target == fileInfo?.path) {
            this.cancelPathEdit();
            return;
        }
        let targetInfo: FileInfo;
        try {
            targetInfo = await this.env.rpc.FileInfoCommand(TabRpcClient, {
                info: { path: await this.formatRemoteUri(target, globalStore.get) },
            });
        } catch (e) {
            globalStore.set(this.errorMsgAtom, { status: t("preview.cannotOpenFile"), text: String(e) });
            return;
        }
        if (targetInfo == null || targetInfo.notfound) {
            globalStore.set(this.errorMsgAtom, {
                status: t("preview.pathNotFound"),
                text: t("preview.pathNotFoundText", { path: target }),
            });
            return;
        }
        this.cancelPathEdit();
        await this.openTreeFile(targetInfo.path ?? target);
        refocusNode(this.blockId);
    }

    updateOpenFileModalAndError(isOpen, errorMsg = null) {
        globalStore.set(this.openFileModal, isOpen);
        globalStore.set(this.openFileError, errorMsg);
        if (isOpen) {
            globalStore.set(this.openFileModalDelay, true);
        } else {
            const delayVal = globalStore.get(this.openFileModalDelay);
            if (delayVal) {
                setTimeout(() => {
                    globalStore.set(this.openFileModalDelay, false);
                }, 200);
            }
        }
    }

    toggleOpenFileModal() {
        const modalOpen = globalStore.get(this.openFileModal);
        const delayVal = globalStore.get(this.openFileModalDelay);
        if (!modalOpen && delayVal) {
            return;
        }
        this.updateOpenFileModalAndError(!modalOpen);
    }

    async openTreeFile(newPath: string, force = false) {
        if (isBlank(newPath) || newPath == globalStore.get(this.metaFilePath)) {
            return;
        }
        if (!force && globalStore.get(this.newFileContent) != null) {
            globalStore.set(this.errorMsgAtom, {
                status: t("preview.unsavedChanges"),
                text: t("preview.unsavedOpenText"),
                level: "warning",
                buttons: [
                    {
                        text: t("preview.discardAndOpen"),
                        onClick: () => fireAndForget(() => this.openTreeFile(newPath, true)),
                    },
                ],
            });
            return;
        }
        try {
            if (force) {
                await this.handleFileRevert();
            }
            await this.goHistory(newPath);
        } catch (e) {
            globalStore.set(this.errorMsgAtom, { status: t("preview.cannotOpenFile"), text: String(e) });
        }
    }

    // A rename/delete can hit the file the block is showing, an open tab, or a directory that
    // contains either of those, so both cases have to look at whole subtrees rather than one path.
    handlePathRenamed(oldPath: string, newPath: string) {
        globalStore.set(this.openTabs, (tabs) => [
            ...new Set(tabs.map((tabPath) => remapPath(tabPath, oldPath, newPath))),
        ]);
        const activePath = globalStore.get(this.metaFilePath);
        if (!isPathInside(activePath, oldPath)) {
            return;
        }
        globalStore.set(this.newFileContent, null);
        fireAndForget(() => this.goHistory(remapPath(activePath, oldPath, newPath)));
    }

    handlePathRemoved(path: string) {
        const remainingTabs = globalStore.get(this.openTabs).filter((tabPath) => !isPathInside(tabPath, path));
        globalStore.set(this.openTabs, remainingTabs);
        const activePath = globalStore.get(this.metaFilePath);
        if (!isPathInside(activePath, path)) {
            return;
        }
        globalStore.set(this.newFileContent, null);
        const fallback = remainingTabs[remainingTabs.length - 1] ?? getParentPath(path);
        if (fallback == null) {
            return;
        }
        fireAndForget(() => this.goHistory(fallback));
    }

    async closeFileTab(path: string, force = false) {
        const tabs = globalStore.get(this.openTabs);
        const tabIndex = tabs.indexOf(path);
        if (tabIndex < 0) {
            return;
        }
        const isActive = globalStore.get(this.metaFilePath) == path;
        if (isActive && !force && globalStore.get(this.newFileContent) != null) {
            globalStore.set(this.errorMsgAtom, {
                status: t("preview.unsavedChanges"),
                text: t("preview.unsavedCloseText"),
                level: "warning",
                buttons: [
                    {
                        text: t("preview.discardAndClose"),
                        onClick: () => fireAndForget(() => this.closeFileTab(path, true)),
                    },
                ],
            });
            return;
        }
        const newTabs = tabs.filter((tabPath) => tabPath != path);
        globalStore.set(this.openTabs, newTabs);
        if (!isActive) {
            return;
        }
        const nextPath = newTabs[Math.min(tabIndex, newTabs.length - 1)];
        if (nextPath != null) {
            await this.goHistory(nextPath);
            return;
        }
        const statFile = await globalStore.get(this.statFile);
        if (statFile?.dir != null) {
            await this.goHistory(statFile.dir);
        }
    }

    async goHistory(newPath: string) {
        let fileName = globalStore.get(this.metaFilePath);
        if (fileName == null) {
            fileName = "";
        }
        const blockMeta = globalStore.get(this.blockAtom)?.meta;
        const updateMeta = goHistory("file", fileName, newPath, blockMeta);
        if (updateMeta == null) {
            return;
        }
        const blockOref = WOS.makeORef("block", this.blockId);
        await this.env.services.object.UpdateObjectMeta(blockOref, updateMeta);

        // Clear the saved file buffers
        globalStore.set(this.fileContentSaved, null);
        globalStore.set(this.newFileContent, null);
    }

    async goParentDirectory({ fileInfo = null }: { fileInfo?: FileInfo | null }) {
        // optional parameter needed for recursive case
        const defaultFileInfo = await globalStore.get(this.statFile);
        if (fileInfo === null) {
            fileInfo = defaultFileInfo;
        }
        if (fileInfo == null) {
            this.updateOpenFileModalAndError(false);
            return true;
        }
        try {
            this.updateOpenFileModalAndError(false);
            await this.goHistory(fileInfo.dir);
            refocusNode(this.blockId);
        } catch (e) {
            globalStore.set(this.openFileError, e.message);
            console.error("Error opening file", fileInfo.dir, e);
        }
    }

    async goHistoryBack() {
        const blockMeta = globalStore.get(this.blockAtom)?.meta;
        const curPath = globalStore.get(this.metaFilePath);
        const updateMeta = goHistoryBack("file", curPath, blockMeta, true);
        if (updateMeta == null) {
            return;
        }
        updateMeta.edit = false;
        const blockOref = WOS.makeORef("block", this.blockId);
        await this.env.services.object.UpdateObjectMeta(blockOref, updateMeta);
    }

    async goHistoryForward() {
        const blockMeta = globalStore.get(this.blockAtom)?.meta;
        const curPath = globalStore.get(this.metaFilePath);
        const updateMeta = goHistoryForward("file", curPath, blockMeta);
        if (updateMeta == null) {
            return;
        }
        updateMeta.edit = false;
        const blockOref = WOS.makeORef("block", this.blockId);
        await this.env.services.object.UpdateObjectMeta(blockOref, updateMeta);
    }

    async setEditMode(edit: boolean) {
        const blockMeta = globalStore.get(this.blockAtom)?.meta;
        const blockOref = WOS.makeORef("block", this.blockId);
        await this.env.services.object.UpdateObjectMeta(blockOref, { ...blockMeta, edit });
    }

    async handleFileSave() {
        const filePath = await globalStore.get(this.statFilePath);
        if (filePath == null) {
            return;
        }
        const newFileContent = globalStore.get(this.newFileContent);
        if (newFileContent == null) {
            console.log("not saving file, newFileContent is null");
            return;
        }
        try {
            await this.env.rpc.FileWriteCommand(TabRpcClient, {
                info: {
                    path: await this.formatRemoteUri(filePath, globalStore.get),
                },
                data64: stringToBase64(newFileContent),
            });
            globalStore.set(this.fileContent, newFileContent);
            globalStore.set(this.newFileContent, null);
            console.log("saved file", filePath);
        } catch (e) {
            const errorStatus: ErrorMsg = {
                status: t("preview.saveFailed"),
                text: `${e}`,
            };
            globalStore.set(this.errorMsgAtom, errorStatus);
        }
    }

    async handleFileRevert() {
        const fileContent = await globalStore.get(this.fileContent);
        this.monacoRef.current?.setValue(fileContent);
        globalStore.set(this.newFileContent, null);
    }

    async handleOpenFile(filePath: string) {
        const fileInfo = await globalStore.get(this.statFile);
        this.updateOpenFileModalAndError(false);
        if (fileInfo == null) {
            return true;
        }
        try {
            this.goHistory(filePath);
            refocusNode(this.blockId);
        } catch (e) {
            globalStore.set(this.openFileError, e.message);
            console.error("Error opening file", filePath, e);
        }
    }

    isSpecializedView(sv: string): boolean {
        const loadableSV = globalStore.get(this.loadableSpecializedView);
        return loadableSV.state == "hasData" && loadableSV.data.specializedView == sv;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const defaultFontSize = globalStore.get(this.env.getSettingsKeyAtom("editor:fontsize")) ?? 12;
        const blockData = globalStore.get(this.blockAtom);
        const overrideFontSize = blockData?.meta?.["editor:fontsize"];
        const menuItems: ContextMenuItem[] = [];
        menuItems.push({
            label: t("previewMenu.copyFullPath"),
            click: () =>
                fireAndForget(async () => {
                    const filePath = await globalStore.get(this.statFilePath);
                    if (filePath == null) {
                        return;
                    }
                    const conn = await globalStore.get(this.connection);
                    if (conn) {
                        // remote path
                        await navigator.clipboard.writeText(formatRemoteUri(filePath, conn));
                    } else {
                        // local path
                        await navigator.clipboard.writeText(filePath);
                    }
                }),
        });
        menuItems.push({
            label: t("common.copyFileName"),
            click: () =>
                fireAndForget(async () => {
                    const fileInfo = await globalStore.get(this.statFile);
                    if (fileInfo == null || fileInfo.name == null) {
                        return;
                    }
                    await navigator.clipboard.writeText(fileInfo.name);
                }),
        });
        menuItems.push({ type: "separator" });
        const finfo = jotaiLoadableValue(globalStore.get(this.loadableFileInfo), null);
        addOpenMenuItems(menuItems, globalStore.get(this.connectionImmediate), finfo);
        const loadableSV = globalStore.get(this.loadableSpecializedView);
        const wordWrapAtom = getOverrideConfigAtom(this.blockId, "editor:wordwrap");
        const wordWrap = globalStore.get(wordWrapAtom) ?? false;
        menuItems.push({ type: "separator" });
        if (loadableSV.state == "hasData" && loadableSV.data.specializedView == "codeedit") {
            const fontSizeSubMenu: ContextMenuItem[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
                (fontSize: number) => {
                    return {
                        label: fontSize.toString() + "px",
                        type: "checkbox",
                        checked: overrideFontSize == fontSize,
                        click: () => {
                            this.env.rpc.SetMetaCommand(TabRpcClient, {
                                oref: WOS.makeORef("block", this.blockId),
                                meta: { "editor:fontsize": fontSize },
                            });
                        },
                    };
                }
            );
            fontSizeSubMenu.unshift({
                label: t("previewMenu.defaultPx", { size: defaultFontSize }),
                type: "checkbox",
                checked: overrideFontSize == null,
                click: () => {
                    this.env.rpc.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { "editor:fontsize": null },
                    });
                },
            });
            menuItems.push({
                label: t("previewMenu.editorFontSize"),
                submenu: fontSizeSubMenu,
            });
            if (globalStore.get(this.newFileContent) != null) {
                menuItems.push({ type: "separator" });
                menuItems.push({
                    label: t("previewMenu.saveFile"),
                    click: () => fireAndForget(this.handleFileSave.bind(this)),
                });
                menuItems.push({
                    label: t("previewMenu.revertFile"),
                    click: () => fireAndForget(this.handleFileRevert.bind(this)),
                });
            }
            menuItems.push({ type: "separator" });
            menuItems.push({
                label: t("previewMenu.wordWrap"),
                type: "checkbox",
                checked: wordWrap,
                click: () =>
                    fireAndForget(async () => {
                        const blockOref = WOS.makeORef("block", this.blockId);
                        await this.env.services.object.UpdateObjectMeta(blockOref, {
                            "editor:wordwrap": !wordWrap,
                        });
                    }),
            });
        }
        if (loadableSV.state == "hasData" && loadableSV.data.specializedView == "directory") {
            menuItems.push({ type: "separator" });
            menuItems.push({
                label: t("previewMenu.sortOrder"),
                submenu: makeTreeSortMenuItems(this),
            });
            menuItems.push({ type: "separator" });
            menuItems.push({ label: t("previewMenu.defaultSettings"), enabled: false });
            menuItems.push(...makeDirectoryDefaultMenuItems(this));
        }
        return menuItems;
    }

    giveFocus(): boolean {
        if (globalStore.get(this.pathEditing) && this.pathInputRef.current) {
            this.pathInputRef.current.focus();
            return true;
        }
        const openModalOpen = globalStore.get(this.openFileModal);
        if (openModalOpen) {
            this.openFileModalGiveFocusRef.current?.();
            return true;
        }
        if (this.monacoRef.current) {
            this.monacoRef.current.focus();
            return true;
        }
        return false;
    }

    keyDownHandler(e: WaveKeyboardEvent): boolean {
        if (checkKeyPressed(e, "Cmd:ArrowLeft")) {
            fireAndForget(this.goHistoryBack.bind(this));
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowRight")) {
            fireAndForget(this.goHistoryForward.bind(this));
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowUp")) {
            // handle up directory
            fireAndForget(() => this.goParentDirectory({}));
            return true;
        }
        if (checkKeyPressed(e, "Cmd:o")) {
            this.toggleOpenFileModal();
            return true;
        }
        const canPreview = globalStore.get(this.canPreview);
        if (canPreview) {
            if (checkKeyPressed(e, "Cmd:e")) {
                const editMode = globalStore.get(this.editMode);
                fireAndForget(() => this.setEditMode(!editMode));
                return true;
            }
        }
        if (this.directoryKeyDownHandler) {
            const handled = this.directoryKeyDownHandler(e);
            if (handled) {
                return true;
            }
        }
        if (this.codeEditKeyDownHandler) {
            const handled = this.codeEditKeyDownHandler(e);
            if (handled) {
                return true;
            }
        }
        return false;
    }

    async formatRemoteUri(path: string, get: Getter): Promise<string> {
        return formatRemoteUri(path, await get(this.connection));
    }
}
