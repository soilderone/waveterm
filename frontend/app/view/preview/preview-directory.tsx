// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ContextMenuModel } from "@/app/store/contextmenu";
import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { checkKeyPressed, isCharacterKeyEvent } from "@/util/keyutil";
import { PLATFORM, PlatformMacOS } from "@/util/platformutil";
import { addOpenMenuItems } from "@/util/previewutil";
import { cn, fireAndForget, isBlank } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { useT } from "@/util/i18n-hooks";
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
    handleFileDelete,
    handleRename,
    makeDirectoryDefaultMenuItems,
    mergeError,
    overwriteError,
    type TreeSortType,
} from "./preview-directory-utils";
import { type PreviewModel } from "./preview-model";
import type { PreviewEnv } from "./previewenv";

const PageJumpSize = 20;

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
                <div className="flex rounded-[3px] py-1 px-2 bg-warning text-black" ref={warningBoxRef}>
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
                model.goHistory(newFileName);
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
                        status: "Cannot Read Directory",
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
                model.goHistory(selectedPath);
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

type FileTreeDirectoryProps = {
    model: PreviewModel;
    path: string;
    connection: string;
    showHiddenFiles: boolean;
    selectedPath: string;
    refreshVersion: number;
    sort: TreeSortType;
    onNavigateUp?: () => void;
    onContextAction?: (action: string, entry: FileInfo) => void;
    root?: boolean;
};

function FileTreeDirectory(props: FileTreeDirectoryProps) {
    const { path, connection, showHiddenFiles, refreshVersion, sort, onNavigateUp, root } = props;
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const [entries, setEntries] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryVersion, setRetryVersion] = useState(0);

    useEffect(() => {
        let active = true;
        let finished = false;
        let stream: AsyncGenerator<CommandRemoteListEntriesRtnData, void, boolean>;
        setLoading(true);
        setError("");
        fireAndForget(async () => {
            try {
                stream = env.rpc.FileListStreamCommand(
                    TabRpcClient,
                    { path: formatRemoteUri(path, connection) },
                    null
                );
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
                .sort((a, b) => compareTreeEntries(a, b, sort)),
        [entries, showHiddenFiles, sort]
    );

    return (
        <ul
            role={root ? "tree" : "group"}
            aria-label={root ? path : undefined}
            aria-busy={loading}
            className={cn("m-0 list-none p-0", !root && "ml-[13px] border-l border-white/10 pl-1")}
        >
            {root && onNavigateUp && (
                <li role="none">
                    <button
                        type="button"
                        data-tree-row=""
                        title={t("preview.parentDirectory")}
                        className="flex h-[26px] w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-[4px] pl-1 pr-2 text-left text-[13px] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-accent focus-visible:-outline-offset-2"
                        onClick={onNavigateUp}
                    >
                        <i
                            aria-hidden="true"
                            className="fa-solid w-3 shrink-0 text-[10px] opacity-70 invisible"
                        />
                        <i
                            aria-hidden="true"
                            className={cn(getMimeTypeIcon(fullConfig, "directory"), "shrink-0 text-xs")}
                            style={{ color: getMimeTypeColor(fullConfig, "directory") }}
                        />
                        <span className="truncate">..</span>
                    </button>
                </li>
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
                        className="mt-0.5 cursor-pointer rounded px-1.5 py-0.5 text-secondary transition-colors hover:bg-white/10 hover:text-primary focus-visible:outline focus-visible:outline-accent"
                        onClick={() => setRetryVersion((version) => version + 1)}
                    >
                        {t("preview.retry")}
                    </button>
                </li>
            )}
            {!loading && !error && visibleEntries.length == 0 && (
                <li role="none" className="px-2 py-1 text-xs text-secondary">
                    <span role="status">{entries.length ? t("preview.noVisibleFiles") : t("preview.emptyDirectory")}</span>
                </li>
            )}
            {visibleEntries.map((entry) => (
                <FileTreeEntry key={entry.path} {...props} entry={entry} />
            ))}
        </ul>
    );
}

function FileTreeEntry({ entry, ...props }: FileTreeDirectoryProps & { entry: FileInfo }) {
    const env = useWaveEnv<PreviewEnv>();
    const t = useT();
    const fullConfig = useAtomValue(env.atoms.fullConfigAtom);
    const [expanded, setExpanded] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);
    const labelId = React.useId();
    const selected = props.selectedPath == entry.path;
    const mimeType = entry.mimetype ?? "";
    const iconClass = getMimeTypeIcon(fullConfig, mimeType);
    const iconColor = getMimeTypeColor(fullConfig, mimeType);

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const menu: ContextMenuItem[] = [
                { label: t("common.newFile"), click: () => props.onContextAction?.("newfile", entry) },
                { label: t("common.newFolder"), click: () => props.onContextAction?.("newfolder", entry) },
                { label: t("common.rename"), click: () => props.onContextAction?.("rename", entry) },
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
                },
            ];
            addOpenMenuItems(menu, props.connection, entry);
            menu.push(
                { type: "separator" },
                { label: t("common.delete"), click: () => props.onContextAction?.("delete", entry) }
            );
            ContextMenuModel.getInstance().showContextMenu(menu, e);
        },
        [entry, props.onContextAction, props.connection]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
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
            ref={itemRef}
            role="treeitem"
            aria-labelledby={labelId}
            aria-expanded={entry.isdir ? expanded : undefined}
            aria-selected={selected}
        >
            <button
                id={labelId}
                type="button"
                data-tree-row=""
                title={entry.path}
                className={cn(
                    "flex h-[26px] w-full min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-[4px] pl-1 pr-2 text-left text-[13px] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-accent focus-visible:-outline-offset-2",
                    selected && "bg-accentbg text-primary"
                )}
                onKeyDown={handleKeyDown}
                onClick={() => {
                    if (entry.isdir) {
                        setExpanded((value) => !value);
                        return;
                    }
                    fireAndForget(() => props.model.openTreeFile(entry.path));
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
            {entry.isdir && expanded && <FileTreeDirectory {...props} path={entry.path} root={false} />}
        </li>
    );
}

export const FileTree = React.memo(function FileTree({
    model,
    rootPath,
    onNavigateUp,
}: {
    model: PreviewModel;
    rootPath: string;
    onNavigateUp?: () => void;
}) {
    const connection = useAtomValue(model.connectionImmediate);
    const selectedPath = useAtomValue(model.metaFilePath);
    const showHiddenFiles = useAtomValue(model.showHiddenFiles);
    const treeSort = useAtomValue(model.treeSort);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const setErrorMsg = useSetAtom(model.errorMsgAtom);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const activeIsDir = loadableFileInfo.state == "hasData" && loadableFileInfo.data?.isdir == true;

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

    const refreshTree = useCallback(() => setRefreshVersion((version) => version + 1), []);

    useEffect(() => {
        if (!activeIsDir) {
            return;
        }
        model.refreshCallback = refreshTree;
        return () => {
            if (model.refreshCallback === refreshTree) {
                model.refreshCallback = null;
            }
        };
    }, [activeIsDir, model, refreshTree]);

    const handleContextAction = useCallback(
        (action: string, entry: FileInfo) => {
            const parentDir = entry.isdir ? entry.path : entry.path.split("/").slice(0, -1).join("/");
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
                                    status: isFolder ? "Create Folder Failed" : "Create File Failed",
                                    text: String(e),
                                });
                            }
                            refreshTree();
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
                        handleRename(model, entry.path, parent + newName, entry.isdir, setErrorMsg, refreshTree);
                    },
                });
                return;
            }
            if (action == "delete") {
                handleFileDelete(model, entry.path, false, setErrorMsg, refreshTree);
            }
        },
        [connection, model, refreshTree, setEntryManagerProps, setErrorMsg]
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        const consumedKeys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "PageUp", "PageDown"];
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
                <div className="min-h-0 flex-1 overflow-auto p-1 scrollbar-hide-until-hover">
                    <FileTreeDirectory
                        key={`${connection}:${rootPath}`}
                        model={model}
                        path={rootPath}
                        connection={connection}
                        showHiddenFiles={showHiddenFiles}
                        selectedPath={selectedPath}
                        refreshVersion={refreshVersion}
                        sort={treeSort}
                        onNavigateUp={onNavigateUp}
                        onContextAction={handleContextAction}
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
