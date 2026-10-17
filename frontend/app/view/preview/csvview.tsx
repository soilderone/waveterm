// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import Papa from "papaparse";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import "./csvview.scss";

const MAX_DATA_SIZE = 10 * 1024 * 1024; // 10MB in bytes

type CSVRow = {
    [key: string]: string | number;
};

interface CSVViewProps {
    parentRef: React.RefObject<HTMLDivElement>;
    content: string;
    filename: string;
    readonly: boolean;
}

interface State {
    tbodyHeight: number;
    rowHeight: number;
}

const columnHelper = createColumnHelper<any>();

// TODO remove parentRef dependency -- use own height
const CSVView = ({ parentRef, content }: CSVViewProps) => {
    const headerRef = useRef<HTMLTableRowElement | null>(null);
    const probeRef = useRef<HTMLTableRowElement | null>(null);
    const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

    const [state, setState] = useState<State>({
        tbodyHeight: 0,
        rowHeight: 28,
    });
    const [activeCell, setActiveCell] = useState({ row: 0, column: 0 });
    const pendingFocusRef = useRef(false);

    const [tableLoaded, setTableLoaded] = useState(false);

    const [parentHeight, setParentHeight] = useState(0);
    useLayoutEffect(() => {
        const parent = parentRef.current;
        if (parent == null) {
            return;
        }
        setParentHeight(parent.clientHeight);
        const observer = new ResizeObserver(([entry]) => setParentHeight(entry.contentRect.height));
        observer.observe(parent);
        return () => observer.disconnect();
    }, [parentRef]);

    // Parse the CSV data
    const parsedData = useMemo<CSVRow[]>(() => {
        if (!content) return [];

        // Trim the content and then check for headers based on the first row's content.
        const trimmedContent = content.trim();
        const firstLineEnd = trimmedContent.indexOf("\n");
        const firstRow = firstLineEnd < 0 ? trimmedContent : trimmedContent.slice(0, firstLineEnd);

        // This checks if the first row starts with a letter or a quote
        const hasHeaders = !!firstRow.match(/^[a-zA-Z"]/);

        const results = Papa.parse(trimmedContent, { header: hasHeaders });

        // Check for non-header CSVs
        if (!hasHeaders && Array.isArray(results.data) && Array.isArray(results.data[0])) {
            const dataArray = results.data as string[][]; // Asserting the type
            const headers = Array.from({ length: dataArray[0].length }, (_, i) => `Column ${i + 1}`);
            results.data = dataArray.map((row) => {
                const newRow: CSVRow = {};
                row.forEach((value, index) => {
                    newRow[headers[index]] = value;
                });
                return newRow;
            });
        }

        return results.data.map((row) => {
            return Object.fromEntries(
                Object.entries(row as CSVRow).map(([key, value]) => {
                    if (typeof value === "string") {
                        const numberValue = parseFloat(value);
                        if (!isNaN(numberValue) && String(numberValue) === value) {
                            return [key, numberValue];
                        }
                    }
                    return [key, value];
                })
            ) as CSVRow;
        });
    }, [content]);

    // Column Definitions
    const columns = useMemo(() => {
        if (parsedData.length === 0) {
            return [];
        }
        const headers = Object.keys(parsedData[0]);
        return headers.map((header) =>
            columnHelper.accessor(header, {
                header: () => header,
                cell: (info) => info.renderValue(),
            })
        );
    }, [parsedData]);

    useEffect(() => {
        if (probeRef.current && headerRef.current && parsedData.length && parentRef.current) {
            const rowHeight = probeRef.current.offsetHeight || 28;
            const fullTBodyHeight = rowHeight * parsedData.length;
            const headerHeight = headerRef.current.offsetHeight;
            const maxHeightLessHeader = parentHeight - headerHeight;
            const tbodyHeight = Math.max(0, Math.min(maxHeightLessHeader, fullTBodyHeight) - 3); // 3 for the borders

            setState({ tbodyHeight, rowHeight });
        }
    }, [parentHeight, parsedData]);

    // Makes sure rows are rendered before setting the renderer as loaded
    useEffect(() => {
        let tid: NodeJS.Timeout;

        if (tbodyRef.current != null) {
            tid = setTimeout(() => {
                setTableLoaded(true);
            }, 50); // Delay a bit to make sure the rows are rendered
        }

        return () => clearTimeout(tid);
    }, [parsedData]);

    const table = useReactTable({
        manualPagination: true,
        data: parsedData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    const rows = table.getRowModel().rows;
    const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tbodyRef.current,
        estimateSize: () => state.rowHeight,
        getItemKey,
        overscan: 8,
    });
    const virtualRows = virtualizer.getVirtualItems();
    const paddingTop = virtualRows[0]?.start ?? 0;
    const paddingBottom = Math.max(0, virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0));

    useEffect(() => {
        virtualizer.measure();
    }, [virtualizer, state.rowHeight]);

    useEffect(() => {
        setActiveCell({ row: 0, column: 0 });
        virtualizer.scrollToOffset(0);
    }, [content, virtualizer]);

    useLayoutEffect(() => {
        if (!pendingFocusRef.current) {
            return;
        }
        const cell = tbodyRef.current?.querySelector<HTMLElement>(
            `[data-row-index="${activeCell.row}"][data-column-index="${activeCell.column}"]`
        );
        if (cell != null) {
            cell.focus({ preventScroll: true });
            pendingFocusRef.current = false;
        }
    }, [activeCell, virtualRows]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>("td[data-row-index]");
        if (cell == null || rows.length === 0) {
            return;
        }
        let row = Number(cell.dataset.rowIndex);
        let column = Number(cell.dataset.columnIndex);
        const pageSize = Math.max(1, Math.floor(state.tbodyHeight / state.rowHeight));
        switch (event.key) {
            case "ArrowDown":
                row++;
                break;
            case "ArrowUp":
                row--;
                break;
            case "ArrowRight":
                column++;
                break;
            case "ArrowLeft":
                column--;
                break;
            case "PageDown":
                row += pageSize;
                break;
            case "PageUp":
                row -= pageSize;
                break;
            case "Home":
                column = 0;
                if (event.ctrlKey || event.metaKey) {
                    row = 0;
                }
                break;
            case "End":
                column = columns.length - 1;
                if (event.ctrlKey || event.metaKey) {
                    row = rows.length - 1;
                }
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        row = Math.max(0, Math.min(rows.length - 1, row));
        column = Math.max(0, Math.min(columns.length - 1, column));
        pendingFocusRef.current = true;
        virtualizer.scrollToIndex(row, { align: "auto" });
        setActiveCell({ row, column });
    };

    return (
        <div className={clsx("csv-view ellipsis", { show: tableLoaded })} style={{ height: "auto" }}>
            <table className="probe">
                <tbody>
                    <tr ref={probeRef}>
                        <td>dummy data</td>
                    </tr>
                </tbody>
            </table>
            <table
                onKeyDown={handleKeyDown}
                aria-rowcount={rows.length + 1}
                style={{ width: table.getTotalSize(), minWidth: "100%" }}
            >
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} ref={headerRef} id={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    colSpan={header.colSpan}
                                    id={header.id}
                                    tabIndex={0}
                                    style={{ flex: `1 0 ${header.getSize()}px` }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            header.column.getToggleSortingHandler()?.(event);
                                        }
                                    }}
                                >
                                    {header.isPlaceholder ? null : (
                                        <div
                                            {...{
                                                className: header.column.getCanSort()
                                                    ? "inner cursor-pointer select-none ellipsis"
                                                    : "",
                                                onClick: header.column.getToggleSortingHandler(),
                                            }}
                                        >
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getIsSorted() === "asc" ? (
                                                <i className="sort-icon fa-sharp fa-solid fa-sort-up"></i>
                                            ) : header.column.getIsSorted() === "desc" ? (
                                                <i className="sort-icon fa-sharp fa-solid fa-sort-down"></i>
                                            ) : null}
                                        </div>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody style={{ height: `${state.tbodyHeight}px` }} ref={tbodyRef}>
                    {paddingTop > 0 && (
                        <tr aria-hidden="true" className="csv-spacer" style={{ height: paddingTop }}>
                            <td colSpan={columns.length} />
                        </tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        const index = virtualRow.index;
                        return (
                            <tr
                                key={row.id}
                                id={row.id}
                                aria-rowindex={index + 2}
                                style={{ height: state.rowHeight }}
                            >
                                {row.getVisibleCells().map((cell, columnIndex) => (
                                    <td
                                        className="ellipsis"
                                        key={cell.id}
                                        id={cell.id}
                                        data-row-index={index}
                                        data-column-index={columnIndex}
                                        style={{ flex: `1 0 ${cell.column.getSize()}px` }}
                                        tabIndex={activeCell.row === index && activeCell.column === columnIndex ? 0 : -1}
                                        onFocus={() => setActiveCell({ row: index, column: columnIndex })}
                                        onClick={(event) => event.currentTarget.focus()}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    {paddingBottom > 0 && (
                        <tr aria-hidden="true" className="csv-spacer" style={{ height: paddingBottom }}>
                            <td colSpan={columns.length} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export { CSVView };
