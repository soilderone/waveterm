// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ContextMenuModel } from "@/app/store/contextmenu";
import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useT } from "@/util/i18n-hooks";
import { checkKeyPressed, isCharacterKeyEvent } from "@/util/keyutil";
import { PLATFORM, PlatformMacOS } from "@/util/platformutil";
import { addOpenMenuItems } from "@/util/previewutil";
import { cn, fireAndForget, isBlank, isLocalConnName } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { offset, useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import {
    Header,
    Row,
    RowData,
    Table,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { PrimitiveAtom, atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { quote as shellQuote } from "shell-quote";
import { debounce } from "throttle-debounce";
import "./directorypreview.scss";
import { EntryManagerOverlay, EntryManagerOverlayProps, EntryManagerType } from "./entry-manager";
import {
    cleanMimetype,
    compareTreeEntries,
    getBestUnit,
    getLastModifiedTime,
    getMimeTypeColor,
    getMimeTypeIcon,
    getSortIcon,
    getTreeSortLabel,
    handleFileDelete,
    handleRename,
    makeDirectoryDefaultMenuItems,
    makeTreeSortMenuItems,
    mergeError,
    overwriteError,
    type TreeSortType,
} from "./preview-directory-utils";
import { type PreviewModel } from "./preview-model";
import {
    canMovePathsInto,
    getBaseName,
    getParentPath,
    isPathInside,
    joinPath,
    pruneNestedPaths,
} from "./preview-path";
import type { PreviewEnv } from "./previewenv";

const PageJumpSize = 20;

// The tree is not virtualized, so a directory with thousands of entries would otherwise build
// thousands of rows on expand. Entries past this count are held back behind a "show more" row.
const TreeRenderChunkSize = 300;

// Same drag type the old listing used, so the AI panel keeps accepting files dragged out of the tree.
const TreeDragType = "FILE_ITEM";

// How long a drag has to rest on a collapsed folder before it opens, so a file can be dropped deeper.
const DragExpandDelayMs = 600;

const EmptySelection: TreeSelection = { paths: new Set(), anchor: null };

interface DirectoryTableHeaderCellProps {
    header: Header<FileInfo, unknown>;
}

function DirectoryTableHeaderCell({ header }: DirectoryTableHeaderCellProps) {
    return (
        <div
            className="dir-table-head-cell"
            key={header.id}
            style={{ width: `calc(var(--header-${header.id}-size) * 1px)` }}
        >
            <div className="dir-table-head-cell-content" onClick={() => header.column.toggleSorting()}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                {getSortIcon(header.column.getIsSorted())}
            </div>
            <div className="dir-table-head-resize-box">
                <div
                    className="dir-table-head-resize"
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                />
            </div>
        </div>
    );
}

declare module "@tanstack/react-table" {
    interface TableMeta<TData extends RowData> {
        updateName: (path: string, isDir: boolean) => void;
        newFile: () => void;
        newDirectory: () => void;
    }
}

interface DirectoryTableProps {
    model: PreviewModel;
    data: FileInfo[];
    search: string;
    focusIndex: number;
    setFocusIndex: (_: number) => void;
    setSearch: (_: string) => void;
    setSelectedPath: (_: string) => void;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    entryManagerOverlayPropsAtom: PrimitiveAtom<EntryManagerOverlayProps>;
    newFile: () => void;
    newDirectory: () => void;
}

const columnHelper = createColumnHelper<FileInfo>();

function DirectoryTable({
    model,
    data,
    search,
    focusIndex,
    setFocusIndex,
    setSearch,
    setSelectedPath,
    setRefreshVersion,
    entryManagerOverlayPropsAtom,
    newFile,
    newDirectory,
}: DirectoryTableProps) {
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const defaultSort = useAtomValue(env.getSettingsKeyAtom("preview:defaultsort")) ?? "name";
    const setErrorMsg = useSetAtom(model.errorMsgAtom);
    const getIconFromMimeType = useCallback(
        (mimeType: string): string => getMimeTypeIcon(fullConfig, mimeType),
        [fullConfig]
    );
    const getIconColor = useCallback(
        (mimeType: string): string => getMimeTypeColor(fullConfig, mimeType),
        [fullConfig]
    );
    const columns = useMemo(
        () => [
            columnHelper.accessor("mimetype", {
                cell: (info) => (
                    <i
                        className={getIconFromMimeType(info.getValue() ?? "")}
                        style={{ color: getIconColor(info.getValue() ?? "") }}
                    ></i>
                ),
                header: () => <span></span>,
                id: "logo",
                size: 25,
                enableSorting: false,
            }),
            columnHelper.accessor("name", {
                cell: (info) => <span className="dir-table-name ellipsis">{info.getValue()}</span>,
                header: () => <span className="dir-table-head-name">{t("preview.tableName")}</span>,
                sortingFn: "alphanumeric",
                size: 200,
                minSize: 90,
            }),
            columnHelper.accessor("modestr", {
                cell: (info) => <span className="dir-table-modestr">{info.getValue()}</span>,
                header: () => <span>{t("preview.tablePerm")}</span>,
                size: 91,
                minSize: 90,
                sortingFn: "alphanumeric",
            }),
            columnHelper.accessor("modtime", {
                cell: (info) => <span className="dir-table-lastmod">{getLastModifiedTime(info.getValue())}</span>,
                header: () => <span>{t("preview.tableLastModified")}</span>,
                size: 91,
                minSize: 65,
                sortingFn: "datetime",
            }),
            columnHelper.accessor("size", {
                cell: (info) => <span className="dir-table-size">{getBestUnit(info.getValue())}</span>,
                header: () => <span className="dir-table-head-size">{t("preview.tableSize")}</span>,
                size: 55,
                minSize: 50,
                sortingFn: "auto",
            }),
            columnHelper.accessor("mimetype", {
                cell: (info) => <span className="dir-table-type ellipsis">{cleanMimetype(info.getValue() ?? "")}</span>,
                header: () => <span className="dir-table-head-type">{t("preview.tableType")}</span>,
                size: 97,
                minSize: 97,
                sortingFn: "alphanumeric",
            }),
            columnHelper.accessor("path", {}),
        ],
        [fullConfig, t]
    );

    const setEntryManagerProps = useSetAtom(entryManagerOverlayPropsAtom);

    const updateName = useCallback(
        (path: string, isDir: boolean) => {
            const fileName = path.split("/").at(-1);
            setEntryManagerProps({
                entryManagerType: EntryManagerType.EditName,
                startingValue: fileName,
                onSave: (newName: string) => {
                    let newPath: string;
                    if (newName !== fileName) {
                        const lastInstance = path.lastIndexOf(fileName);
                        newPath = path.substring(0, lastInstance) + newName;
                        console.log(`replacing ${fileName} with ${newName}: ${path}`);
                        handleRename(model, path, newPath, isDir, setErrorMsg);
                    }
                    setEntryManagerProps(undefined);
                },
            });
        },
        [model, setErrorMsg]
    );

    const initialSorting = defaultSort === "modtime" ? [{ id: "modtime", desc: true }] : [{ id: "name", desc: false }];

    const table = useReactTable({
        data,
        columns,
        columnResizeMode: "onChange",
        getSortedRowModel: getSortedRowModel(),
        getCoreRowModel: getCoreRowModel(),

        initialState: {
            sorting: initialSorting,
            columnVisibility: {
                path: false,
            },
        },
        enableMultiSort: false,
        enableSortingRemoval: false,
        meta: {
            updateName,
            newFile,
            newDirectory,
        },
    });
    const sortingState = table.getState().sorting;
    useEffect(() => {
        const allRows = table.getRowModel()?.flatRows || [];
        setSelectedPath((allRows[focusIndex]?.getValue("path") as string) ?? null);
    }, [focusIndex, data, setSelectedPath, sortingState]);

    const columnSizeVars = useMemo(() => {
        const headers = table.getFlatHeaders();
        const colSizes: { [key: string]: number } = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i]!;
            colSizes[`--header-${header.id}-size`] = header.getSize();
            colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
        }
        return colSizes;
    }, [table.getState().columnSizingInfo]);

    const osRef = useRef<OverlayScrollbarsComponentRef>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [scrollHeight, setScrollHeight] = useState(0);

    const onScroll = useCallback(
        debounce(2, () => {
            setScrollHeight(osRef.current.osInstance().elements().viewport.scrollTop);
        }),
        []
    );

    const TableComponent = table.getState().columnSizingInfo.isResizingColumn ? MemoizedTableBody : TableBody;

    return (
        <OverlayScrollbarsComponent
            options={{ scrollbars: { autoHide: "leave" } }}
            events={{ scroll: onScroll }}
            className="dir-table"
            style={{ ...columnSizeVars }}
            ref={osRef}
            data-scroll-height={scrollHeight}
        >
            <div className="dir-table-head">
                {table.getHeaderGroups().map((headerGroup) => (
                    <div className="dir-table-head-row" key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <DirectoryTableHeaderCell key={header.id} header={header} />
                        ))}
                    </div>
                ))}
            </div>
            <TableComponent
                bodyRef={bodyRef}
                model={model}
                data={data}
                table={table}
                search={search}
                focusIndex={focusIndex}
                setFocusIndex={setFocusIndex}
                setSearch={setSearch}
                setSelectedPath={setSelectedPath}
                setRefreshVersion={setRefreshVersion}
                osRef={osRef.current}
            />
        </OverlayScrollbarsComponent>
    );
}

interface TableBodyProps {
    bodyRef: React.RefObject<HTMLDivElement>;
    model: PreviewModel;
    data: Array<FileInfo>;
    table: Table<FileInfo>;
    search: string;
    focusIndex: number;
    setFocusIndex: (_: number) => void;
    setSearch: (_: string) => void;
    setSelectedPath: (_: string) => void;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    osRef: OverlayScrollbarsComponentRef;
}

function TableBody({
    bodyRef,
    model,
    table,
    search,
    focusIndex,
    setFocusIndex,
    setSearch,
    setRefreshVersion,
    osRef,
}: TableBodyProps) {
    const t = useT();
    const searchActive = useAtomValue(model.directorySearchActive);
    const dummyLineRef = useRef<HTMLDivElement>(null);
    const warningBoxRef = useRef<HTMLDivElement>(null);
    const conn = useAtomValue(model.connection);
    const setErrorMsg = useSetAtom(model.errorMsgAtom);

    useEffect(() => {
        if (focusIndex === null || !bodyRef.current || !osRef) {
            return;
        }

        const rowElement = bodyRef.current.querySelector(`[data-rowindex="${focusIndex}"]`) as HTMLDivElement;
        if (!rowElement) {
            return;
        }

        const viewport = osRef.osInstance().elements().viewport;
        const viewportHeight = viewport.offsetHeight;
        const rowRect = rowElement.getBoundingClientRect();
        const parentRect = viewport.getBoundingClientRect();
        const viewportScrollTop = viewport.scrollTop;
        const rowTopRelativeToViewport = rowRect.top - parentRect.top + viewport.scrollTop;
        const rowBottomRelativeToViewport = rowRect.bottom - parentRect.top + viewport.scrollTop;

        if (rowTopRelativeToViewport - 30 < viewportScrollTop) {
            // Row is above the visible area
            let topVal = rowTopRelativeToViewport - 30;
            if (topVal < 0) {
                topVal = 0;
            }
            viewport.scrollTo({ top: topVal });
        } else if (rowBottomRelativeToViewport + 5 > viewportScrollTop + viewportHeight) {
            // Row is below the visible area
            const topVal = rowBottomRelativeToViewport - viewportHeight + 5;
            viewport.scrollTo({ top: topVal });
        }
    }, [focusIndex]);

    const handleFileContextMenu = useCallback(
        async (e: any, finfo: FileInfo) => {
            e.preventDefault();
            e.stopPropagation();
            if (finfo == null) {
                return;
            }
            const fileName = finfo.path.split("/").pop();
            const menu: ContextMenuItem[] = [
                {
                    label: t("common.newFile"),
                    click: () => {
                        table.options.meta.newFile();
                    },
                },
                {
                    label: t("common.newFolder"),
                    click: () => {
                        table.options.meta.newDirectory();
                    },
                },
                {
                    label: t("common.rename"),
                    click: () => {
                        table.options.meta.updateName(finfo.path, finfo.isdir);
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: t("common.copyFileName"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(fileName)),
                },
                {
                    label: t("common.copyFullFileName"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(finfo.path)),
                },
                {
                    label: t("common.copyFileNameShellQuoted"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(shellQuote([fileName]))),
                },
                {
                    label: t("common.copyFullFileNameShellQuoted"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(shellQuote([finfo.path]))),
                },
            ];
            addOpenMenuItems(menu, conn, finfo);
            menu.push(
                {
                    type: "separator",
                },
                {
                    label: t("previewMenu.defaultSettings"),
                    submenu: makeDirectoryDefaultMenuItems(model),
                },
                {
                    type: "separator",
                },
                {
                    label: t("common.delete"),
                    click: () => handleFileDelete(model, finfo.path, false, setErrorMsg),
                }
            );
            ContextMenuModel.getInstance().showContextMenu(menu, e);
        },
        [setRefreshVersion, conn]
    );

    const allRows = table.getRowModel().flatRows;
    const dotdotRow = allRows.find((row) => row.getValue("name") === "..");
    const otherRows = allRows.filter((row) => row.getValue("name") !== "..");

    return (
        <div className="dir-table-body" ref={bodyRef}>
            {(searchActive || search !== "") && (
                <div className="flex rounded-[3px] py-1 px-2 bg-warning text-onaccent" ref={warningBoxRef}>
                    <span>{search === "" ? "Type to search (Esc to cancel)" : `Searching for "${search}"`}</span>
                    <div
                        className="ml-auto bg-transparent flex justify-center items-center flex-col p-0.5 rounded-md hover:bg-hoverbg focus:bg-hoverbg focus-within:bg-hoverbg cursor-pointer"
                        onClick={() => {
                            setSearch("");
                            globalStore.set(model.directorySearchActive, false);
                        }}
                    >
                        <i className="fa-solid fa-xmark" />
                        <input
                            type="text"
                            value={search}
                            onChange={() => {}}
                            className="w-0 h-0 opacity-0 p-0 border-none pointer-events-none"
                        />
                    </div>
                </div>
            )}
            <div className="dir-table-body-scroll-box">
                <div className="dummy dir-table-body-row" ref={dummyLineRef}>
                    <div className="dir-table-body-cell">dummy-data</div>
                </div>
                {dotdotRow && (
                    <TableRow
                        model={model}
                        row={dotdotRow}
                        focusIndex={focusIndex}
                        setFocusIndex={setFocusIndex}
                        setSearch={setSearch}
                        idx={0}
                        handleFileContextMenu={handleFileContextMenu}
                        key="dotdot"
                    />
                )}
                {otherRows.map((row, idx) => (
                    <TableRow
                        model={model}
                        row={row}
                        focusIndex={focusIndex}
                        setFocusIndex={setFocusIndex}
                        setSearch={setSearch}
                        idx={dotdotRow ? idx + 1 : idx}
                        handleFileContextMenu={handleFileContextMenu}
                        key={idx}
                    />
                ))}
            </div>
        </div>
    );
}

type TableRowProps = {
    model: PreviewModel;
    row: Row<FileInfo>;
    focusIndex: number;
    setFocusIndex: (_: number) => void;
    setSearch: (_: string) => void;
    idx: number;
    handleFileContextMenu: (e: any, finfo: FileInfo) => Promise<void>;
};

function TableRow({ model, row, focusIndex, setFocusIndex, setSearch, idx, handleFileContextMenu }: TableRowProps) {
    const dirPath = useAtomValue(model.statFilePath);
    const connection = useAtomValue(model.connection);

    const dragItem: DraggedFile = {
        relName: row.getValue("name") as string,
        absParent: dirPath,
        uri: formatRemoteUri(row.getValue("path") as string, connection),
        isDir: row.original.isdir,
    };
    const [_, drag] = useDrag(
        () => ({
            type: "FILE_ITEM",
            canDrag: true,
            item: () => dragItem,
        }),
        [dragItem]
    );

    const dragRef = useCallback(
        (node: HTMLDivElement | null) => {
            drag(node);
        },
        [drag]
    );

    return (
        <div
            className={clsx("dir-table-body-row", { focused: focusIndex === idx })}
            data-rowindex={idx}
            onDoubleClick={() => {
                const newFileName = row.getValue("path") as string;
                fireAndForget(() => model.openTreeFile(newFileName));
                setSearch("");
                globalStore.set(model.directorySearchActive, false);
            }}
            onClick={() => setFocusIndex(idx)}
            onContextMenu={(e) => handleFileContextMenu(e, row.original)}
            ref={dragRef}
        >
            {row.getVisibleCells().map((cell) => (
                <div
                    className={clsx("dir-table-body-cell", "col-" + cell.column.id)}
                    key={cell.id}
                    style={{ width: `calc(var(--col-${cell.column.id}-size) * 1px)` }}
                >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
            ))}
        </div>
    );
}

const MemoizedTableBody = React.memo(
    TableBody,
    (prev, next) => prev.table.options.data == next.table.options.data
) as typeof TableBody;

interface DirectoryPreviewProps {
    model: PreviewModel;
}

function DirectoryPreview({ model }: DirectoryPreviewProps) {
    const t = useT();
    const env = useWaveEnv<PreviewEnv>();
    const [searchText, setSearchText] = useState("");
    const [focusIndex, setFocusIndex] = useState(0);
    const [unfilteredData, setUnfilteredData] = useState<FileInfo[]>([]);
    const showHiddenFiles = useAtomValue(model.showHiddenFiles);
    const [selectedPath, setSelectedPath] = useState("");
    const [refreshVersion, setRefreshVersion] = useAtom(model.refreshVersion);
    const conn = useAtomValue(model.connection);
    const blockData = useAtomValue(model.blockAtom);
    const finfo = useAtomValue(model.statFile);
    const dirPath = finfo?.path;
    const setErrorMsg = useSetAtom(model.errorMsgAtom);

    useEffect(() => {
        model.refreshCallback = () => {
            setRefreshVersion((refreshVersion) => refreshVersion + 1);
        };
        return () => {
            model.refreshCallback = null;
        };
    }, [setRefreshVersion]);

    useEffect(
        () =>
            fireAndForget(async () => {
                const entries: FileInfo[] = [];
                try {
                    const remotePath = await model.formatRemoteUri(dirPath, globalStore.get);
                    const stream = env.rpc.FileListStreamCommand(TabRpcClient, { path: remotePath }, null);
                    for await (const chunk of stream) {
                        if (chunk?.fileinfo) {
                            entries.push(...chunk.fileinfo);
                        }
                    }
                    if (finfo?.dir && finfo?.path !== finfo?.dir) {
                        entries.unshift({
                            name: "..",
                            path: finfo.dir,
                            isdir: true,
                            modtime: new Date().getTime(),
                            mimetype: "directory",
                        });
                    }
                } catch (e) {
                    console.error("Directory Read Error", e);
                    setErrorMsg({
                        status: t("preview.cannotReadDir"),
                        text: `${e}`,
                    });
                }
                setUnfilteredData(entries);
            }),
        [conn, dirPath, refreshVersion]
    );

    const filteredData = useMemo(
        () =>
            unfilteredData?.filter((fileInfo) => {
                if (fileInfo.name == null) {
                    console.log("fileInfo.name is null", fileInfo);
                    return false;
                }
                if (!showHiddenFiles && fileInfo.name.startsWith(".") && fileInfo.name != "..") {
                    return false;
                }
                return fileInfo.name.toLowerCase().includes(searchText);
            }) ?? [],
        [unfilteredData, showHiddenFiles, searchText]
    );

    useEffect(() => {
        model.directoryKeyDownHandler = (waveEvent: WaveKeyboardEvent): boolean => {
            if (checkKeyPressed(waveEvent, "Cmd:f")) {
                globalStore.set(model.directorySearchActive, true);
                return true;
            }
            if (checkKeyPressed(waveEvent, "Escape")) {
                setSearchText("");
                globalStore.set(model.directorySearchActive, false);
                return;
            }
            if (checkKeyPressed(waveEvent, "ArrowUp")) {
                setFocusIndex((idx) => Math.max(idx - 1, 0));
                return true;
            }
            if (checkKeyPressed(waveEvent, "ArrowDown")) {
                setFocusIndex((idx) => Math.min(idx + 1, filteredData.length - 1));
                return true;
            }
            if (checkKeyPressed(waveEvent, "PageUp")) {
                setFocusIndex((idx) => Math.max(idx - PageJumpSize, 0));
                return true;
            }
            if (checkKeyPressed(waveEvent, "PageDown")) {
                setFocusIndex((idx) => Math.min(idx + PageJumpSize, filteredData.length - 1));
                return true;
            }
            if (checkKeyPressed(waveEvent, "Enter")) {
                if (filteredData.length == 0) {
                    return;
                }
                fireAndForget(() => model.openTreeFile(selectedPath));
                setSearchText("");
                globalStore.set(model.directorySearchActive, false);
                return true;
            }
            if (checkKeyPressed(waveEvent, "Backspace")) {
                if (searchText.length == 0) {
                    return true;
                }
                setSearchText((current) => current.slice(0, -1));
                return true;
            }
            if (
                checkKeyPressed(waveEvent, "Space") &&
                searchText == "" &&
                PLATFORM == PlatformMacOS &&
                !blockData?.meta?.connection
            ) {
                env.electron.onQuicklook(selectedPath);
                return true;
            }
            if (isCharacterKeyEvent(waveEvent)) {
                setSearchText((current) => current + waveEvent.key);
                return true;
            }
            return false;
        };
        return () => {
            model.directoryKeyDownHandler = null;
        };
    }, [filteredData, selectedPath, searchText]);

    useEffect(() => {
        if (filteredData.length != 0 && focusIndex > filteredData.length - 1) {
            setFocusIndex(filteredData.length - 1);
        }
    }, [filteredData]);

    const entryManagerPropsAtom = useState(
        atom<EntryManagerOverlayProps>(null) as PrimitiveAtom<EntryManagerOverlayProps>
    )[0];
    const [entryManagerProps, setEntryManagerProps] = useAtom(entryManagerPropsAtom);

    const { refs, floatingStyles, context } = useFloating({
        open: !!entryManagerProps,
        onOpenChange: () => setEntryManagerProps(undefined),
        middleware: [offset(({ rects }) => -rects.reference.height / 2 - rects.floating.height / 2)],
    });

    const handleDropCopy = useCallback(
        async (data: CommandFileCopyData, isDir: boolean) => {
            try {
                await env.rpc.FileCopyCommand(TabRpcClient, data, { timeout: data.opts.timeout });
            } catch (e) {
                console.warn("Copy failed:", e);
                const copyError = `${e}`;
                const allowRetry = copyError.includes(overwriteError) || copyError.includes(mergeError);
                let errorMsg: ErrorMsg;
                if (allowRetry) {
                    errorMsg = {
                        status: "Confirm Overwrite File(s)",
                        text: "This copy operation will overwrite an existing file. Would you like to continue?",
                        level: "warning",
                        buttons: [
                            {
                                text: "Delete Then Copy",
                                onClick: async () => {
                                    data.opts.overwrite = true;
                                    await handleDropCopy(data, isDir);
                                },
                            },
                            {
                                text: "Sync",
                                onClick: async () => {
                                    data.opts.merge = true;
                                    await handleDropCopy(data, isDir);
                                },
                            },
                        ],
                    };
                } else {
                    errorMsg = {
                        status: "Copy Failed",
                        text: copyError,
                        level: "error",
                    };
                }
                setErrorMsg(errorMsg);
            }
            model.refreshCallback();
        },
        [model.refreshCallback]
    );

    const [, drop] = useDrop(
        () => ({
            accept: "FILE_ITEM", //a name of file drop type
            canDrop: (_, monitor) => {
                const dragItem = monitor.getItem<DraggedFile>();
                // drop if not current dir is the parent directory of the dragged item
                // requires absolute path
                if (monitor.isOver({ shallow: false }) && dragItem.absParent !== dirPath) {
                    return true;
                }
                return false;
            },
            drop: async (draggedFile: DraggedFile, monitor) => {
                if (!monitor.didDrop()) {
                    const timeoutYear = 31536000000; // one year
                    const opts: FileCopyOpts = {
                        timeout: timeoutYear,
                    };
                    const desturi = await model.formatRemoteUri(dirPath, globalStore.get);
                    const data: CommandFileCopyData = {
                        srcuri: draggedFile.uri,
                        desturi,
                        opts,
                    };
                    await handleDropCopy(data, draggedFile.isDir);
                }
            },
            // TODO: mabe add a hover option?
        }),
        [dirPath, model.formatRemoteUri, model.refreshCallback]
    );

    useEffect(() => {
        drop(refs.reference);
    }, [refs.reference]);

    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

    const newFile = useCallback(() => {
        setEntryManagerProps({
            entryManagerType: EntryManagerType.NewFile,
            onSave: (newName: string) => {
                console.log(`newFile: ${newName}`);
                fireAndForget(async () => {
                    await env.rpc.FileCreateCommand(
                        TabRpcClient,
                        {
                            info: {
                                path: await model.formatRemoteUri(`${dirPath}/${newName}`, globalStore.get),
                            },
                        },
                        null
                    );
                    model.refreshCallback();
                });
                setEntryManagerProps(undefined);
            },
        });
    }, [dirPath]);
    const newDirectory = useCallback(() => {
        setEntryManagerProps({
            entryManagerType: EntryManagerType.NewDirectory,
            onSave: (newName: string) => {
                console.log(`newDirectory: ${newName}`);
                fireAndForget(async () => {
                    await env.rpc.FileMkdirCommand(TabRpcClient, {
                        info: {
                            path: await model.formatRemoteUri(`${dirPath}/${newName}`, globalStore.get),
                        },
                    });
                    model.refreshCallback();
                });
                setEntryManagerProps(undefined);
            },
        });
    }, [dirPath]);

    const handleFileContextMenu = useCallback(
        (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const menu: ContextMenuItem[] = [
                {
                    label: t("common.newFile"),
                    click: () => {
                        newFile();
                    },
                },
                {
                    label: t("common.newFolder"),
                    click: () => {
                        newDirectory();
                    },
                },
                {
                    type: "separator",
                },
            ];
            addOpenMenuItems(menu, conn, finfo);

            ContextMenuModel.getInstance().showContextMenu(menu, e);
        },
        [setRefreshVersion, conn, newFile, newDirectory, dirPath]
    );

    return (
        <Fragment>
            <div
                ref={refs.setReference}
                className="dir-table-container"
                onChangeCapture={(e) => {
                    const event = e as React.ChangeEvent<HTMLInputElement>;
                    if (!entryManagerProps) {
                        setSearchText(event.target.value.toLowerCase());
                    }
                }}
                {...getReferenceProps()}
                onContextMenu={(e) => handleFileContextMenu(e)}
                onClick={() => setEntryManagerProps(undefined)}
            >
                <DirectoryTable
                    model={model}
                    data={filteredData}
                    search={searchText}
                    focusIndex={focusIndex}
                    setFocusIndex={setFocusIndex}
                    setSearch={setSearchText}
                    setSelectedPath={setSelectedPath}
                    setRefreshVersion={setRefreshVersion}
                    entryManagerOverlayPropsAtom={entryManagerPropsAtom}
                    newFile={newFile}
                    newDirectory={newDirectory}
                />
            </div>
            {entryManagerProps && (
                <EntryManagerOverlay
                    {...entryManagerProps}
                    forwardRef={refs.setFloating}
                    style={floatingStyles}
                    getReferenceProps={getFloatingProps}
                    onCancel={() => setEntryManagerProps(undefined)}
                />
            )}
        </Fragment>
    );
}

type TreeVersionState = {
    all: number;
    dirs: Record<string, number>;
};

type TreeSelection = {
    paths: Set<string>;
    // where a shift-click range starts; the last row clicked without shift
    anchor: string;
};

type TreeItemRef = {
    path: string;
    isdir: boolean;
};

type PathRename = {
    from: string;
    to: string;
};

// Still a DraggedFile, which is what the AI panel reads, with the whole selection riding along.
type TreeDragItem = DraggedFile & {
    connection: string;
    blockId: string;
    items: TreeItemRef[];
    // lets the tree a drag started in refresh itself when it is dropped into another block's tree
    onMoved: (renames: PathRename[]) => void;
};

function isSameConnection(a: string, b: string): boolean {
    return a == b || (isLocalConnName(a) && isLocalConnName(b));
}

// Everything the whole subtree needs that is not per-node. Grouped into one referentially stable
// object so FileTreeDirectory/FileTreeEntry can be memoized -- selection and refresh are delivered
// through atoms instead of props so changing them only re-renders the nodes that actually care.
type FileTreeSharedProps = {
    model: PreviewModel;
    connection: string;
    showHiddenFiles: boolean;
    // lowercased; narrows only the root directory's entries (see the filter bar in FileTree)
    rootFilter: string;
    sort: TreeSortType;
    versionAtom: PrimitiveAtom<TreeVersionState>;
    selectionAtom: PrimitiveAtom<TreeSelection>;
    onContextAction: (action: string, entry: FileInfo) => void;
    // true when the click only changed the selection (shift / cmd), so the row must not open
    onRowClick: (e: React.MouseEvent, entry: FileInfo) => boolean;
    getSelectedItems: (entry: FileInfo) => TreeItemRef[];
    canDropInto: (item: TreeDragItem, targetDir: string) => boolean;
    dropInto: (item: TreeDragItem, targetDir: string) => void;
    onItemsMoved: (renames: PathRename[]) => void;
    onDeleteItems: (items: TreeItemRef[]) => void;
};

type FileTreeDirectoryProps = {
    shared: FileTreeSharedProps;
    path: string;
    parentPath?: string;
    onNavigateUp?: () => void;
    root?: boolean;
};

const TreeParentRow = React.memo(function TreeParentRow({
    shared,
    parentPath,
    onNavigateUp,
}: {
    shared: FileTreeSharedProps;
    parentPath: string;
    onNavigateUp: () => void;
}) {
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const [{ dropActive }, drop] = useDrop(
        () => ({
            accept: TreeDragType,
            canDrop: (item: TreeDragItem, monitor) =>
                parentPath != null && monitor.isOver({ shallow: true }) && shared.canDropInto(item, parentPath),
            drop: (item: TreeDragItem, monitor) => {
                if (!monitor.didDrop()) {
                    shared.dropInto(item, parentPath);
                }
            },
            collect: (monitor) => ({ dropActive: monitor.isOver({ shallow: true }) && monitor.canDrop() }),
        }),
        [parentPath, shared]
    );
    const dropRef = useCallback(
        (node: HTMLLIElement | null) => {
            drop(node);
        },
        [drop]
    );

    return (
        <li role="none" ref={dropRef}>
            <button
                type="button"
                data-tree-row=""
                title={t("preview.parentDirectory")}
                className={cn(
                    "flex h-[26px] w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-[4px] pl-1 pr-2 text-left text-[13px] transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-accent focus-visible:-outline-offset-2",
                    dropActive && "bg-accent/10 outline outline-accent/60 -outline-offset-1"
                )}
                onClick={onNavigateUp}
            >
                <i aria-hidden="true" className="fa-solid w-3 shrink-0 text-[10px] opacity-70 invisible" />
                <i
                    aria-hidden="true"
                    className={cn(getMimeTypeIcon(fullConfig, "directory"), "shrink-0 text-xs")}
                    style={{ color: getMimeTypeColor(fullConfig, "directory") }}
                />
                <span className="truncate">..</span>
            </button>
        </li>
    );
});

TreeParentRow.displayName = "TreeParentRow";

const FileTreeDirectory = React.memo(function FileTreeDirectory({
    shared,
    path,
    parentPath,
    onNavigateUp,
    root,
}: FileTreeDirectoryProps) {
    const { connection, showHiddenFiles, rootFilter, sort } = shared;
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const [entries, setEntries] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryVersion, setRetryVersion] = useState(0);
    const [renderLimit, setRenderLimit] = useState(TreeRenderChunkSize);
    // model.refreshVersion is owned by whichever preview is mounted (the listing view for a
    // directory), so folding it in here lets the block's Refresh button drive both without the
    // two views fighting over model.refreshCallback.
    const dirVersionAtom = useMemo(
        () =>
            atom((get) => {
                const version = get(shared.versionAtom);
                return version.all + (version.dirs[path] ?? 0) + get(shared.model.refreshVersion);
            }),
        [shared.versionAtom, shared.model, path]
    );
    const refreshVersion = useAtomValue(dirVersionAtom);

    useEffect(() => {
        let active = true;
        let finished = false;
        let stream: AsyncGenerator<CommandRemoteListEntriesRtnData, void, boolean>;
        setLoading(true);
        setError("");
        setRenderLimit(TreeRenderChunkSize);
        fireAndForget(async () => {
            try {
                stream = env.rpc.FileListStreamCommand(TabRpcClient, { path: formatRemoteUri(path, connection) }, null);
                const nextEntries = new Map<string, FileInfo>();
                while (active) {
                    const chunk = await stream.next();
                    if (!active) {
                        return;
                    }
                    if (chunk.done) {
                        finished = true;
                        break;
                    }
                    const chunkValue = chunk.value as CommandRemoteListEntriesRtnData;
                    for (const entry of chunkValue?.fileinfo ?? []) {
                        if (!entry?.name || !entry.path || entry.name == "." || entry.name == "..") {
                            continue;
                        }
                        nextEntries.set(entry.path, entry);
                    }
                }
                if (active) {
                    setEntries(Array.from(nextEntries.values()));
                }
            } catch (e) {
                if (active) {
                    setError(String(e));
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        });
        return () => {
            active = false;
            if (stream && !finished) {
                fireAndForget(async () => {
                    await stream.next(true);
                });
            }
        };
    }, [env.rpc, path, connection, refreshVersion, retryVersion]);

    const visibleEntries = useMemo(
        () =>
            entries
                .filter((entry) => showHiddenFiles || !entry.name.startsWith("."))
                .filter((entry) => !root || isBlank(rootFilter) || entry.name.toLowerCase().includes(rootFilter))
                .sort((a, b) => compareTreeEntries(a, b, sort)),
        [entries, showHiddenFiles, root, rootFilter, sort]
    );
    const shownEntries = renderLimit < visibleEntries.length ? visibleEntries.slice(0, renderLimit) : visibleEntries;
    const hiddenCount = visibleEntries.length - shownEntries.length;

    return (
        <ul
            role={root ? "tree" : "group"}
            aria-label={root ? path : undefined}
            aria-busy={loading}
            className={cn("m-0 list-none p-0", !root && "ml-[13px] border-l border-border pl-1")}
        >
            {root && onNavigateUp && (
                <TreeParentRow shared={shared} parentPath={parentPath} onNavigateUp={onNavigateUp} />
            )}
            {loading && (
                <li role="none" className="flex items-center gap-1.5 px-2 py-1 text-xs text-secondary">
                    <i aria-hidden="true" className="fa-solid fa-spinner fa-spin" />
                    <span role="status">{t("preview.loading")}</span>
                </li>
            )}
            {error && (
                <li role="none" className="px-2 py-1 text-xs">
                    <div role="alert" className="break-words text-warning">
                        {error}
                    </div>
                    <button
                        type="button"
                        className="mt-0.5 cursor-pointer rounded px-1.5 py-0.5 text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline focus-visible:outline-accent"
                        onClick={() => setRetryVersion((version) => version + 1)}
                    >
                        {t("preview.retry")}
                    </button>
                </li>
            )}
            {!loading && !error && visibleEntries.length == 0 && (
                <li role="none" className="px-2 py-1 text-xs text-secondary">
                    <span role="status">
                        {entries.length ? t("preview.noVisibleFiles") : t("preview.emptyDirectory")}
                    </span>
                </li>
            )}
            {shownEntries.map((entry) => (
                <FileTreeEntry key={entry.path} shared={shared} entry={entry} />
            ))}
            {hiddenCount > 0 && (
                <li role="none">
                    <button
                        type="button"
                        data-tree-row=""
                        className="flex h-[26px] w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-[4px] pl-1 pr-2 text-left text-[13px] text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline focus-visible:outline-accent focus-visible:-outline-offset-2"
                        onClick={() => setRenderLimit((limit) => limit + TreeRenderChunkSize)}
                    >
                        <i aria-hidden="true" className="fa-solid fa-ellipsis w-3 shrink-0 text-[10px] opacity-70" />
                        <span className="truncate">{t("preview.treeShowMore", { count: hiddenCount })}</span>
                    </button>
                </li>
            )}
        </ul>
    );
});

FileTreeDirectory.displayName = "FileTreeDirectory";

const FileTreeEntry = React.memo(function FileTreeEntry({
    shared,
    entry,
}: {
    shared: FileTreeSharedProps;
    entry: FileInfo;
}) {
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const [expanded, setExpanded] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);
    const labelId = React.useId();
    const activeAtom = useMemo(
        () => atom((get) => get(shared.model.metaFilePath) == entry.path),
        [shared.model, entry.path]
    );
    const active = useAtomValue(activeAtom);
    const selectedAtom = useMemo(
        () => atom((get) => get(shared.selectionAtom).paths.has(entry.path)),
        [shared.selectionAtom, entry.path]
    );
    const selected = useAtomValue(selectedAtom);
    // Per-entry derived atoms rather than one shared subscription: jotai bails out when the
    // computed boolean is unchanged, so opening a file only re-renders the handful of rows whose
    // selected/ancestor state actually flipped instead of the entire tree.
    const revealAtom = useMemo(
        () =>
            atom((get) => {
                if (!entry.isdir) {
                    return false;
                }
                const activePath = get(shared.model.metaFilePath);
                return activePath != entry.path && isPathInside(activePath, entry.path);
            }),
        [shared.model, entry.path, entry.isdir]
    );
    const shouldReveal = useAtomValue(revealAtom);
    const mimeType = entry.mimetype ?? "";
    const iconClass = getMimeTypeIcon(fullConfig, mimeType);
    const iconColor = getMimeTypeColor(fullConfig, mimeType);

    const [{ isDragging }, drag] = useDrag(
        () => ({
            type: TreeDragType,
            item: (): TreeDragItem => ({
                relName: entry.name,
                absParent: getParentPath(entry.path),
                uri: formatRemoteUri(entry.path, shared.connection),
                isDir: !!entry.isdir,
                connection: shared.connection,
                blockId: shared.model.blockId,
                items: shared.getSelectedItems(entry),
                onMoved: shared.onItemsMoved,
            }),
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [entry, shared]
    );
    // Only folders are drop targets, and a folder's target is its whole <li> (row plus expanded
    // children). A drag over a file therefore lands on the innermost folder around it, and the
    // shallow isOver check keeps every enclosing folder from also accepting the same drop.
    const [{ isDropOver, canDropHere }, drop] = useDrop(
        () => ({
            accept: TreeDragType,
            canDrop: (item: TreeDragItem, monitor) =>
                entry.isdir && monitor.isOver({ shallow: true }) && shared.canDropInto(item, entry.path),
            drop: (item: TreeDragItem, monitor) => {
                if (!monitor.didDrop()) {
                    shared.dropInto(item, entry.path);
                }
            },
            collect: (monitor) => ({
                isDropOver: monitor.isOver({ shallow: true }),
                canDropHere: monitor.canDrop(),
            }),
        }),
        [entry.path, entry.isdir, shared]
    );
    const setItemRef = useCallback(
        (node: HTMLLIElement | null) => {
            itemRef.current = node;
            drop(entry.isdir ? node : null);
        },
        [drop, entry.isdir]
    );
    const setRowRef = useCallback(
        (node: HTMLButtonElement | null) => {
            drag(node);
        },
        [drag]
    );
    const dragHovering = isDropOver && !isDragging;

    useEffect(() => {
        if (!entry.isdir || expanded || !dragHovering) {
            return;
        }
        const timer = setTimeout(() => setExpanded(true), DragExpandDelayMs);
        return () => clearTimeout(timer);
    }, [dragHovering, expanded, entry.isdir]);

    // Only ever expands, so a directory the user deliberately collapsed stays collapsed.
    useEffect(() => {
        if (shouldReveal) {
            setExpanded(true);
        }
    }, [shouldReveal]);

    useEffect(() => {
        if (!active) {
            return;
        }
        itemRef.current
            ?.querySelector<HTMLElement>("button[data-tree-row]")
            ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [active]);

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const selectedItems = shared.getSelectedItems(entry);
            if (selectedItems.length > 1) {
                const paths = selectedItems.map((item) => item.path);
                const deleteCount = pruneNestedPaths(selectedItems).length;
                const multiMenu: ContextMenuItem[] = [
                    {
                        label: t("preview.copyFullPaths"),
                        click: () => fireAndForget(() => navigator.clipboard.writeText(paths.join("\n"))),
                    },
                    {
                        label: t("preview.copyFullPathsShellQuoted"),
                        click: () => fireAndForget(() => navigator.clipboard.writeText(shellQuote(paths))),
                    },
                    { type: "separator" },
                    {
                        label: t("preview.deleteItems", { count: deleteCount }),
                        click: () => shared.onDeleteItems(selectedItems),
                    },
                ];
                ContextMenuModel.getInstance().showContextMenu(multiMenu, e);
                return;
            }
            const menu: ContextMenuItem[] = [];
            if (entry.isdir) {
                menu.push(
                    {
                        label: t("preview.openDirectoryHere"),
                        click: () => shared.onContextAction("opendir", entry),
                    },
                    { type: "separator" }
                );
            }
            menu.push(
                { label: t("common.newFile"), click: () => shared.onContextAction("newfile", entry) },
                { label: t("common.newFolder"), click: () => shared.onContextAction("newfolder", entry) },
                { label: t("common.rename"), click: () => shared.onContextAction("rename", entry) },
                { type: "separator" },
                {
                    label: t("common.copyFileName"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(entry.name)),
                },
                {
                    label: t("common.copyFullFileName"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(entry.path)),
                },
                {
                    label: t("common.copyFullFileNameShellQuoted"),
                    click: () => fireAndForget(() => navigator.clipboard.writeText(shellQuote([entry.path]))),
                }
            );
            addOpenMenuItems(menu, shared.connection, entry);
            menu.push(
                { type: "separator" },
                { label: t("common.delete"), click: () => shared.onContextAction("delete", entry) }
            );
            ContextMenuModel.getInstance().showContextMenu(menu, e);
        },
        [entry, shared, t]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        // Finder's Quick Look: space previews the file in place instead of pressing the row
        if (event.key == " " && !entry.isdir && PLATFORM == PlatformMacOS && isLocalConnName(shared.connection)) {
            event.preventDefault();
            env.electron.onQuicklook(entry.path);
            return;
        }
        if (event.key == "ArrowRight") {
            event.preventDefault();
            if (entry.isdir) {
                if (expanded) {
                    itemRef.current?.querySelector<HTMLButtonElement>("ul button[data-tree-row]")?.focus();
                } else {
                    setExpanded(true);
                }
            }
        } else if (event.key == "ArrowLeft") {
            event.preventDefault();
            if (entry.isdir && expanded) {
                setExpanded(false);
            } else {
                itemRef.current?.parentElement
                    ?.closest('[role="treeitem"]')
                    ?.querySelector<HTMLButtonElement>("button[data-tree-row]")
                    ?.focus();
            }
        }
    };

    return (
        <li
            ref={setItemRef}
            role="treeitem"
            aria-labelledby={labelId}
            aria-expanded={entry.isdir ? expanded : undefined}
            aria-selected={selected}
            className={cn(
                isDropOver && canDropHere && "rounded-[6px] bg-accent/10 outline outline-accent/60 -outline-offset-1"
            )}
        >
            <button
                id={labelId}
                ref={setRowRef}
                type="button"
                data-tree-row=""
                data-tree-path={entry.path}
                data-tree-isdir={entry.isdir ? "true" : "false"}
                title={entry.path}
                className={cn(
                    "flex h-[26px] w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-[6px] pl-1 pr-2 text-left text-[13px] transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-accent focus-visible:-outline-offset-2",
                    selected && "bg-accentbg text-primary",
                    !selected && entry.name.startsWith(".") && "opacity-60",
                    isDragging && "opacity-50"
                )}
                onKeyDown={handleKeyDown}
                onClick={(e) => {
                    if (shared.onRowClick(e, entry)) {
                        return;
                    }
                    if (entry.isdir) {
                        setExpanded((value) => !value);
                        return;
                    }
                    fireAndForget(() => shared.model.openTreeFile(entry.path));
                }}
                onContextMenu={handleContextMenu}
            >
                <i
                    aria-hidden="true"
                    className={cn(
                        "fa-solid w-3 shrink-0 text-[10px] opacity-70",
                        entry.isdir ? (expanded ? "fa-chevron-down" : "fa-chevron-right") : "invisible"
                    )}
                />
                <i aria-hidden="true" className={cn(iconClass, "shrink-0 text-xs")} style={{ color: iconColor }} />
                <span className="truncate">{entry.name}</span>
            </button>
            {entry.isdir && expanded && <FileTreeDirectory shared={shared} path={entry.path} />}
        </li>
    );
});

FileTreeEntry.displayName = "FileTreeEntry";

const TreeSortButton = React.memo(function TreeSortButton({ model }: { model: PreviewModel }) {
    const t = useT();
    const treeSort = useAtomValue(model.treeSort);
    const label = getTreeSortLabel(treeSort.field);
    const title = t("preview.sortBy", { field: label });
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            className="flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium text-secondary transition-colors hover:bg-hover hover:text-primary"
            onClick={(e) => ContextMenuModel.getInstance().showContextMenu(makeTreeSortMenuItems(model), e)}
        >
            <i
                aria-hidden="true"
                className={cn(
                    "fa-solid text-[10px]",
                    treeSort.desc ? "fa-arrow-down-wide-short" : "fa-arrow-down-short-wide"
                )}
            />
            <span className="hidden @min-[260px]:inline">{label}</span>
        </button>
    );
});

TreeSortButton.displayName = "TreeSortButton";

export const FileTree = React.memo(function FileTree({
    model,
    rootPath,
    parentPath,
    onNavigateUp,
}: {
    model: PreviewModel;
    rootPath: string;
    parentPath?: string;
    onNavigateUp?: () => void;
}) {
    const t = useT();
    const connection = useAtomValue(model.connectionImmediate);
    const showHiddenFiles = useAtomValue(model.showHiddenFiles);
    const treeSort = useAtomValue(model.treeSort);
    const setErrorMsg = useSetAtom(model.errorMsgAtom);
    const [versionAtom] = useState(() => atom<TreeVersionState>({ all: 0, dirs: {} }));
    const setVersion = useSetAtom(versionAtom);
    const [selectionAtom] = useState(() => atom<TreeSelection>(EmptySelection));
    const activePath = useAtomValue(model.metaFilePath);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [filterText, setFilterText] = useState("");
    const rootFilter = filterText.trim().toLowerCase();
    useEffect(() => {
        setFilterText("");
    }, [rootPath]);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    // getPreviewTreeRoot makes the root the active directory, so "the block sits on a directory"
    // and "the block sits on the root" are the same thing -- checked that way rather than by
    // comparing path strings, which normalize differently depending on how the user navigated.
    const rootIsActive = loadableFileInfo.state == "hasData" && loadableFileInfo.data?.isdir == true;

    const [entryManagerPropsAtom] = useState(
        atom<EntryManagerOverlayProps>(null) as PrimitiveAtom<EntryManagerOverlayProps>
    );
    const [entryManagerProps, setEntryManagerProps] = useAtom(entryManagerPropsAtom);
    const { refs, floatingStyles, context } = useFloating({
        open: !!entryManagerProps,
        onOpenChange: () => setEntryManagerProps(undefined),
        middleware: [offset(({ rects }) => -rects.reference.height / 2 - rects.floating.height / 2)],
    });
    const dismiss = useDismiss(context);
    const { getFloatingProps } = useInteractions([dismiss]);

    // Nothing else is mounted while the block sits on a directory, so the tree owns the block's
    // Refresh button then. It bumps model.refreshVersion like every other preview does, which the
    // per-directory version atoms already fold in.
    const refreshTree = useCallback(() => globalStore.set(model.refreshVersion, (version) => version + 1), [model]);

    useEffect(() => {
        if (!rootIsActive) {
            return;
        }
        model.refreshCallback = refreshTree;
        return () => {
            if (model.refreshCallback === refreshTree) {
                model.refreshCallback = null;
            }
        };
    }, [rootIsActive, model, refreshTree]);

    const refreshDir = useCallback(
        (dirPath: string) =>
            setVersion((version) => ({
                ...version,
                dirs: { ...version.dirs, [dirPath]: (version.dirs[dirPath] ?? 0) + 1 },
            })),
        [setVersion]
    );

    // Whatever the block opens -- from the tree, a tab or the header path -- becomes the selection,
    // just as a plain click on its row would make it.
    useEffect(() => {
        if (isBlank(activePath) || activePath == rootPath) {
            globalStore.set(selectionAtom, EmptySelection);
            return;
        }
        globalStore.set(selectionAtom, { paths: new Set([activePath]), anchor: activePath });
    }, [activePath, rootPath, selectionAtom]);

    // Rows are read back from the DOM so ranges and batches follow exactly what is on screen: the
    // current sort, the filter, and only folders that are expanded.
    const getTreeRows = useCallback((): TreeItemRef[] => {
        const rows = scrollRef.current?.querySelectorAll<HTMLElement>("[data-tree-path]");
        if (rows == null) {
            return [];
        }
        return Array.from(rows, (row) => ({ path: row.dataset.treePath, isdir: row.dataset.treeIsdir == "true" }));
    }, []);

    const handleRowClick = useCallback(
        (e: React.MouseEvent, entry: FileInfo): boolean => {
            const toggleKey = PLATFORM == PlatformMacOS ? e.metaKey : e.ctrlKey;
            const selection = globalStore.get(selectionAtom);
            if (e.shiftKey) {
                const paths = getTreeRows().map((row) => row.path);
                const targetIdx = paths.indexOf(entry.path);
                if (targetIdx >= 0) {
                    let anchorIdx = paths.indexOf(selection.anchor);
                    if (anchorIdx < 0) {
                        anchorIdx = targetIdx;
                    }
                    const startIdx = Math.min(anchorIdx, targetIdx);
                    const endIdx = Math.max(anchorIdx, targetIdx);
                    const nextPaths = new Set(toggleKey ? selection.paths : null);
                    for (const path of paths.slice(startIdx, endIdx + 1)) {
                        nextPaths.add(path);
                    }
                    globalStore.set(selectionAtom, { paths: nextPaths, anchor: paths[anchorIdx] });
                    return true;
                }
            }
            if (toggleKey) {
                const nextPaths = new Set(selection.paths);
                if (nextPaths.has(entry.path)) {
                    nextPaths.delete(entry.path);
                } else {
                    nextPaths.add(entry.path);
                }
                globalStore.set(selectionAtom, { paths: nextPaths, anchor: entry.path });
                return true;
            }
            globalStore.set(selectionAtom, { paths: new Set([entry.path]), anchor: entry.path });
            return false;
        },
        [getTreeRows, selectionAtom]
    );

    // Acting on a row outside the selection (dragging it, right-clicking it) makes it the selection
    // first, the way Finder does, so a batch never silently includes rows that were not highlighted.
    const getSelectedItems = useCallback(
        (entry: FileInfo): TreeItemRef[] => {
            const entryItem: TreeItemRef = { path: entry.path, isdir: !!entry.isdir };
            const selection = globalStore.get(selectionAtom);
            if (!selection.paths.has(entry.path)) {
                globalStore.set(selectionAtom, { paths: new Set([entry.path]), anchor: entry.path });
                return [entryItem];
            }
            const items = getTreeRows().filter((row) => selection.paths.has(row.path));
            return items.length > 0 ? items : [entryItem];
        },
        [getTreeRows, selectionAtom]
    );

    const canDropInto = useCallback(
        (item: TreeDragItem, targetDir: string): boolean => {
            if (item?.items == null || !isSameConnection(item.connection, connection)) {
                return false;
            }
            return canMovePathsInto(item.items.map((treeItem) => treeItem.path), targetDir);
        },
        [connection]
    );

    const handleItemsMoved = useCallback(
        (renames: PathRename[]) => {
            for (const dirPath of new Set(renames.map((rename) => getParentPath(rename.from)))) {
                refreshDir(dirPath);
            }
            for (const rename of renames) {
                model.handlePathRenamed(rename.from, rename.to);
            }
        },
        [model, refreshDir]
    );

    // A move never overwrites: the backend refuses when the destination name is taken, and that
    // item is reported while the rest of the batch still goes through.
    const dropInto = useCallback(
        (item: TreeDragItem, targetDir: string) => {
            fireAndForget(async () => {
                const renames: PathRename[] = [];
                const failures: string[] = [];
                for (const treeItem of pruneNestedPaths(item.items)) {
                    if (getParentPath(treeItem.path) == targetDir) {
                        continue;
                    }
                    const destPath = joinPath(targetDir, getBaseName(treeItem.path));
                    let srcuri = formatRemoteUri(treeItem.path, connection);
                    if (treeItem.isdir) {
                        srcuri += "/";
                    }
                    try {
                        await model.env.rpc.FileMoveCommand(TabRpcClient, {
                            srcuri,
                            desturi: formatRemoteUri(destPath, connection),
                        });
                        renames.push({ from: treeItem.path, to: destPath });
                    } catch (e) {
                        failures.push(`${getBaseName(treeItem.path)}: ${e}`);
                    }
                }
                refreshDir(targetDir);
                handleItemsMoved(renames);
                if (item.blockId != model.blockId) {
                    item.onMoved?.(renames);
                }
                if (renames.length > 0) {
                    globalStore.set(selectionAtom, {
                        paths: new Set(renames.map((rename) => rename.to)),
                        anchor: renames[0].to,
                    });
                }
                if (failures.length > 0) {
                    setErrorMsg({ status: t("preview.moveFailed"), text: failures.join("; ") });
                }
            });
        },
        [connection, model, refreshDir, handleItemsMoved, selectionAtom, setErrorMsg, t]
    );

    const deleteItems = useCallback(
        (items: TreeItemRef[]) => {
            const targets = pruneNestedPaths(items);
            if (targets.length == 0) {
                return;
            }
            const runDelete = async () => {
                const failures: string[] = [];
                for (const target of targets) {
                    try {
                        await model.env.rpc.FileDeleteCommand(TabRpcClient, {
                            path: formatRemoteUri(target.path, connection),
                            recursive: target.isdir,
                        });
                        model.handlePathRemoved(target.path);
                    } catch (e) {
                        failures.push(`${getBaseName(target.path)}: ${e}`);
                    }
                }
                for (const dirPath of new Set(targets.map((target) => getParentPath(target.path)))) {
                    refreshDir(dirPath);
                }
                if (failures.length > 0) {
                    setErrorMsg({ status: t("preview.deleteFailed"), text: failures.join("; ") });
                }
            };
            setErrorMsg({
                status: t("preview.confirmDeleteItems", { count: targets.length }),
                text: t("preview.confirmDeleteItemsText", {
                    names: targets.map((target) => getBaseName(target.path)).join(", "),
                }),
                level: "warning",
                buttons: [{ text: t("common.delete"), onClick: () => fireAndForget(runDelete) }],
            });
        },
        [connection, model, refreshDir, setErrorMsg, t]
    );

    const [{ rootDropActive }, rootDrop] = useDrop(
        () => ({
            accept: TreeDragType,
            canDrop: (item: TreeDragItem, monitor) => monitor.isOver({ shallow: true }) && canDropInto(item, rootPath),
            drop: (item: TreeDragItem, monitor) => {
                if (!monitor.didDrop()) {
                    dropInto(item, rootPath);
                }
            },
            collect: (monitor) => ({ rootDropActive: monitor.isOver({ shallow: true }) && monitor.canDrop() }),
        }),
        [rootPath, canDropInto, dropInto]
    );
    const setScrollRef = useCallback(
        (node: HTMLDivElement | null) => {
            scrollRef.current = node;
            rootDrop(node);
        },
        [rootDrop]
    );

    const handleContextAction = useCallback(
        (action: string, entry: FileInfo) => {
            const entryDir = getParentPath(entry.path) ?? entry.path;
            const parentDir = entry.isdir ? entry.path : entryDir;
            if (action == "opendir") {
                fireAndForget(() => model.goHistory(entry.path));
                return;
            }
            if (action == "newfile" || action == "newfolder") {
                const isFolder = action == "newfolder";
                setEntryManagerProps({
                    entryManagerType: isFolder ? EntryManagerType.NewDirectory : EntryManagerType.NewFile,
                    onSave: (newName) => {
                        setEntryManagerProps(undefined);
                        if (isBlank(newName)) {
                            return;
                        }
                        fireAndForget(async () => {
                            const path = await formatRemoteUri(`${parentDir}/${newName}`, connection);
                            try {
                                if (isFolder) {
                                    await model.env.rpc.FileMkdirCommand(TabRpcClient, { info: { path } });
                                } else {
                                    await model.env.rpc.FileCreateCommand(TabRpcClient, { info: { path } }, null);
                                }
                            } catch (e) {
                                setErrorMsg({
                                    status: isFolder ? t("preview.createFolderFailed") : t("preview.createFileFailed"),
                                    text: String(e),
                                });
                            }
                            refreshDir(parentDir);
                        });
                    },
                });
                return;
            }
            if (action == "rename") {
                setEntryManagerProps({
                    entryManagerType: EntryManagerType.EditName,
                    startingValue: entry.name,
                    onSave: (newName) => {
                        setEntryManagerProps(undefined);
                        if (isBlank(newName) || newName == entry.name) {
                            return;
                        }
                        const parent = entry.path.substring(0, entry.path.lastIndexOf(entry.name));
                        const newPath = parent + newName;
                        handleRename(
                            model,
                            entry.path,
                            newPath,
                            entry.isdir,
                            setErrorMsg,
                            () => refreshDir(entryDir),
                            () => model.handlePathRenamed(entry.path, newPath)
                        );
                    },
                });
                return;
            }
            if (action == "delete") {
                handleFileDelete(
                    model,
                    entry.path,
                    false,
                    setErrorMsg,
                    () => refreshDir(entryDir),
                    () => model.handlePathRemoved(entry.path)
                );
            }
        },
        [connection, model, refreshDir, setEntryManagerProps, setErrorMsg, t]
    );

    const shared = useMemo<FileTreeSharedProps>(
        () => ({
            model,
            connection,
            showHiddenFiles,
            rootFilter,
            sort: treeSort,
            versionAtom,
            selectionAtom,
            onContextAction: handleContextAction,
            onRowClick: handleRowClick,
            getSelectedItems,
            canDropInto,
            dropInto,
            onItemsMoved: handleItemsMoved,
            onDeleteItems: deleteItems,
        }),
        [
            model,
            connection,
            showHiddenFiles,
            rootFilter,
            treeSort,
            versionAtom,
            selectionAtom,
            handleContextAction,
            handleRowClick,
            getSelectedItems,
            canDropInto,
            dropInto,
            handleItemsMoved,
            deleteItems,
        ]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        const consumedKeys = [
            "ArrowDown",
            "ArrowUp",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "Enter",
            " ",
            "PageUp",
            "PageDown",
        ];
        if (!consumedKeys.includes(event.key)) {
            return;
        }
        event.stopPropagation();
        const handledNavKeys = ["ArrowDown", "ArrowUp", "Home", "End"];
        if (!handledNavKeys.includes(event.key)) {
            return;
        }
        const button = (event.target as HTMLElement).closest?.("button[data-tree-row]") as HTMLButtonElement;
        if (!button) {
            return;
        }
        const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-tree-row]"));
        const index = rows.indexOf(button);
        let nextIndex: number;
        if (event.key == "ArrowDown") {
            nextIndex = Math.min(index + 1, rows.length - 1);
        } else if (event.key == "ArrowUp") {
            nextIndex = Math.max(index - 1, 0);
        } else if (event.key == "Home") {
            nextIndex = 0;
        } else {
            nextIndex = rows.length - 1;
        }
        event.preventDefault();
        rows[nextIndex]?.focus();
    };

    if (!rootPath) {
        return null;
    }

    return (
        <>
            <div
                ref={refs.setReference}
                data-file-tree=""
                className="flex h-full min-h-0 min-w-0 flex-col"
                onKeyDown={handleKeyDown}
                onClick={() => entryManagerProps && setEntryManagerProps(undefined)}
            >
                {rootIsActive ? (
                    // The block header already names the directory, so this row filters it instead
                    // of repeating the path, and hosts the hidden-files toggle the header used to.
                    <div className="@container flex h-[30px] w-full shrink-0 items-center gap-2 border-b-[0.5px] border-borderstrong pl-3 pr-1.5 text-xs text-secondary">
                        <i aria-hidden="true" className="fa-solid fa-magnifying-glass shrink-0 text-[10px] opacity-70" />
                        <input
                            type="text"
                            value={filterText}
                            placeholder={t("preview.filterPlaceholder")}
                            aria-label={t("preview.filterPlaceholder")}
                            className="min-w-0 flex-1 bg-transparent text-primary outline-none placeholder:text-muted"
                            onChange={(e) => setFilterText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key == "Escape" && filterText != "") {
                                    e.stopPropagation();
                                    setFilterText("");
                                }
                            }}
                        />
                        <TreeSortButton model={model} />
                        {PLATFORM == PlatformMacOS && isLocalConnName(connection) && (
                            <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted @min-[300px]:inline-flex">
                                <kbd className="rounded-[4px] bg-raise px-1 py-px font-sans text-[10px] shadow-[inset_0_0_0_0.5px_var(--sage-line-strong)]">
                                    space
                                </kbd>
                                {t("preview.quickLook")}
                            </span>
                        )}
                        <button
                            type="button"
                            title={showHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files"}
                            className={cn(
                                "flex h-5 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium transition-colors",
                                showHiddenFiles ? "bg-accent/15 text-accent" : "text-secondary hover:bg-hover"
                            )}
                            onClick={() => globalStore.set(model.showHiddenFiles, (prev) => !prev)}
                        >
                            <i
                                aria-hidden="true"
                                className={cn("fa-solid text-[10px]", showHiddenFiles ? "fa-eye" : "fa-eye-slash")}
                            />
                            {t("preview.hiddenFiles")}
                        </button>
                    </div>
                ) : (
                    <div className="@container flex h-7 w-full shrink-0 items-center gap-1 border-b border-border pr-1.5">
                        <button
                            type="button"
                            title={rootPath}
                            className="flex h-full min-w-0 flex-1 cursor-pointer select-none items-center gap-1.5 px-2 text-left text-xs font-medium text-secondary transition-colors hover:bg-hover"
                            onClick={() => fireAndForget(() => model.goHistory(rootPath))}
                        >
                            <i aria-hidden="true" className="fa-solid fa-folder-open shrink-0 text-[10px] opacity-70" />
                            <span className="truncate">{getBaseName(rootPath)}</span>
                        </button>
                        <TreeSortButton model={model} />
                    </div>
                )}
                <div
                    ref={setScrollRef}
                    className={cn(
                        "min-h-0 flex-1 overflow-auto p-1 scrollbar-hide-until-hover",
                        rootDropActive && "bg-accent/5 outline outline-accent/40 -outline-offset-2"
                    )}
                >
                    <FileTreeDirectory
                        key={`${connection}:${rootPath}`}
                        shared={shared}
                        path={rootPath}
                        parentPath={parentPath}
                        onNavigateUp={onNavigateUp}
                        root
                    />
                </div>
            </div>
            {entryManagerProps && (
                <EntryManagerOverlay
                    {...entryManagerProps}
                    forwardRef={refs.setFloating}
                    style={floatingStyles}
                    getReferenceProps={getFloatingProps}
                    onCancel={() => setEntryManagerProps(undefined)}
                />
            )}
        </>
    );
});

FileTree.displayName = "FileTree";

export { DirectoryPreview };
