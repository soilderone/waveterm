// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { t } from "@/util/i18n";
import { fireAndForget, isBlank } from "@/util/util";
import dayjs from "dayjs";
import React from "react";
import { type PreviewModel } from "./preview-model";

export const recursiveError = "recursive flag must be set for directory operations";
export const overwriteError = "set overwrite flag to delete the existing file";
export const mergeError = "set overwrite flag to delete the existing contents or set merge flag to merge the contents";

export const displaySuffixes = {
    B: "b",
    kB: "k",
    MB: "m",
    GB: "g",
    TB: "t",
    KiB: "k",
    MiB: "m",
    GiB: "g",
    TiB: "t",
};

export function getBestUnit(bytes: number, si = false, sigfig = 3): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
    if (bytes === 0) return "0B";

    const units = si ? ["kB", "MB", "GB", "TB"] : ["KiB", "MiB", "GiB", "TiB"];
    const divisor = si ? 1000 : 1024;

    const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(divisor)), units.length);
    const unit = idx === 0 ? "B" : units[idx - 1];
    const value = bytes / Math.pow(divisor, idx);

    return `${parseFloat(value.toPrecision(sigfig))}${displaySuffixes[unit] ?? unit}`;
}

function padDay(day: number) {
    return String(day).padStart(2, " ");
}

export function getLastModifiedTime(unixMillis: number): string {
    const file = dayjs(unixMillis);
    const now = dayjs();

    const day = padDay(file.date());
    const time = file.format("HH:mm");

    if (now.isSame(file, "year")) {
        return `${file.format("MMM")} ${day} ${time}`;
    }

    return `${file.format("YYYY-MM-DD")}`;
}

const iconRegex = /^[a-z0-9- ]+$/;

export function isIconValid(icon: string): boolean {
    if (isBlank(icon)) {
        return false;
    }
    return icon.match(iconRegex) != null;
}

const DefaultFileIcon = "fa fa-solid fa-file fa-fw";

// Resolution walks every prefix of the mimetype, so it is linear in the mimetype length and gets
// called once per row per render. Cache is keyed on the mimetypes config object so a config
// reload naturally invalidates it.
const mimeTypeIconCache = new WeakMap<Record<string, MimeTypeConfigType>, Map<string, string>>();

function resolveMimeTypeIcon(mimeTypes: Record<string, MimeTypeConfigType>, mimeType: string): string {
    for (let len = mimeType.length; len > 0; len--) {
        const icon = mimeTypes[mimeType.substring(0, len)]?.icon ?? null;
        if (isIconValid(icon)) {
            return `fa fa-solid fa-${icon} fa-fw`;
        }
    }
    return DefaultFileIcon;
}

export function getMimeTypeIcon(fullConfig: FullConfigType, mimeType: string): string {
    const mimeTypes = fullConfig?.mimetypes;
    if (mimeTypes == null) {
        return DefaultFileIcon;
    }
    let cache = mimeTypeIconCache.get(mimeTypes);
    if (cache == null) {
        cache = new Map<string, string>();
        mimeTypeIconCache.set(mimeTypes, cache);
    }
    const cached = cache.get(mimeType);
    if (cached != null) {
        return cached;
    }
    const icon = resolveMimeTypeIcon(mimeTypes, mimeType);
    cache.set(mimeType, icon);
    return icon;
}

export function getMimeTypeColor(fullConfig: FullConfigType, mimeType: string): string {
    return fullConfig.mimetypes?.[mimeType]?.color ?? "inherit";
}

export function getSortIcon(sortType: string | boolean): React.ReactNode {
    switch (sortType) {
        case "asc":
            return <i className="fa-solid fa-chevron-up dir-table-head-direction"></i>;
        case "desc":
            return <i className="fa-solid fa-chevron-down dir-table-head-direction"></i>;
        default:
            return null;
    }
}

export function cleanMimetype(input: string): string {
    const truncated = input.split(";")[0];
    return truncated.trim();
}

export type TreeSortType = {
    field: string;
    desc: boolean;
};

function compareNames(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) || a.localeCompare(b);
}

function getExtension(name: string): string {
    const idx = name.lastIndexOf(".");
    return idx > 0 ? name.substring(idx + 1).toLowerCase() : "";
}

export function compareTreeEntries(a: FileInfo, b: FileInfo, sort: TreeSortType): number {
    const dirCompare = Number(!!b.isdir) - Number(!!a.isdir);
    if (dirCompare != 0) {
        return dirCompare;
    }
    const dirMul = sort.desc ? -1 : 1;
    if (sort.field == "modtime") {
        return ((a.modtime ?? 0) - (b.modtime ?? 0)) * dirMul || compareNames(a.name, b.name);
    }
    if (sort.field == "size") {
        return ((a.size ?? 0) - (b.size ?? 0)) * dirMul || compareNames(a.name, b.name);
    }
    if (sort.field == "modestr") {
        return (a.modestr ?? "").localeCompare(b.modestr ?? "") * dirMul || compareNames(a.name, b.name);
    }
    if (sort.field == "mimetype") {
        // Plenty of unrelated files share a generic mimetype (text/plain, application/octet-stream),
        // so the extension keeps e.g. all .log files together within it.
        const typeCompare =
            cleanMimetype(a.mimetype ?? "").localeCompare(cleanMimetype(b.mimetype ?? "")) ||
            getExtension(a.name).localeCompare(getExtension(b.name));
        return typeCompare * dirMul || compareNames(a.name, b.name);
    }
    return compareNames(a.name, b.name) * dirMul;
}

export const TreeSortFields = ["name", "mimetype", "modtime", "size", "modestr"];

// Newest-first and largest-first are what people want from a date or size sort, so switching to
// one of those fields picks that direction instead of carrying over an ascending name sort.
export function getDefaultSortDesc(field: string): boolean {
    return field == "modtime" || field == "size";
}

export function getTreeSortLabel(field: string): string {
    switch (field) {
        case "mimetype":
            return t("previewMenu.sortType");
        case "modtime":
            return t("previewMenu.sortModtime");
        case "size":
            return t("previewMenu.sortSize");
        case "modestr":
            return t("previewMenu.sortPerm");
        default:
            return t("previewMenu.sortName");
    }
}

export function makeTreeSortMenuItems(model: PreviewModel): ContextMenuItem[] {
    const treeSort = globalStore.get(model.treeSort);
    const fieldItems: ContextMenuItem[] = TreeSortFields.map((field) => ({
        label: getTreeSortLabel(field),
        type: "checkbox",
        checked: treeSort.field == field,
        click: () => {
            if (treeSort.field == field) {
                return;
            }
            globalStore.set(model.treeSort, { field, desc: getDefaultSortDesc(field) });
        },
    }));
    return [
        ...fieldItems,
        { type: "separator" },
        {
            label: t("previewMenu.sortAscending"),
            type: "checkbox",
            checked: !treeSort.desc,
            click: () => globalStore.set(model.treeSort, { ...treeSort, desc: false }),
        },
        {
            label: t("previewMenu.sortDescending"),
            type: "checkbox",
            checked: treeSort.desc,
            click: () => globalStore.set(model.treeSort, { ...treeSort, desc: true }),
        },
    ];
}

export function handleRename(
    model: PreviewModel,
    path: string,
    newPath: string,
    isDir: boolean,
    setErrorMsg: (msg: ErrorMsg) => void,
    refresh?: () => void,
    onSuccess?: () => void
) {
    fireAndForget(async () => {
        try {
            let srcuri = await model.formatRemoteUri(path, globalStore.get);
            if (isDir) {
                srcuri += "/";
            }
            await model.env.rpc.FileMoveCommand(TabRpcClient, {
                srcuri,
                desturi: await model.formatRemoteUri(newPath, globalStore.get),
            });
            onSuccess?.();
        } catch (e) {
            const errorText = `${e}`;
            console.warn(`Rename failed: ${errorText}`);
            const errorMsg: ErrorMsg = {
                status: t("preview.renameFailed"),
                text: `${e}`,
            };
            setErrorMsg(errorMsg);
        }
        if (refresh) {
            refresh();
        } else {
            model.refreshCallback?.();
        }
    });
}

export function handleFileDelete(
    model: PreviewModel,
    path: string,
    recursive: boolean,
    setErrorMsg: (msg: ErrorMsg) => void,
    refresh?: () => void,
    onSuccess?: () => void
) {
    fireAndForget(async () => {
        const formattedPath = await model.formatRemoteUri(path, globalStore.get);
        try {
            await model.env.rpc.FileDeleteCommand(TabRpcClient, {
                path: formattedPath,
                recursive,
            });
            onSuccess?.();
        } catch (e) {
            const errorText = `${e}`;
            console.warn(`Delete failed: ${errorText}`);
            let errorMsg: ErrorMsg;
            if (errorText.includes(recursiveError) && !recursive) {
                errorMsg = {
                    status: t("preview.confirmDeleteDir"),
                    text: t("preview.confirmDeleteDirText"),
                    level: "warning",
                    buttons: [
                        {
                            text: t("common.deleteRecursively"),
                            onClick: () => handleFileDelete(model, path, true, setErrorMsg, refresh, onSuccess),
                        },
                    ],
                };
            } else {
                errorMsg = {
                    status: t("preview.deleteFailed"),
                    text: `${e}`,
                };
            }
            setErrorMsg(errorMsg);
        }
        if (refresh) {
            refresh();
        } else {
            model.refreshCallback?.();
        }
    });
}

export function makeDirectoryDefaultMenuItems(model: PreviewModel): ContextMenuItem[] {
    const defaultSort = globalStore.get(model.env.getSettingsKeyAtom("preview:defaultsort")) ?? "name";
    const showHiddenFiles = globalStore.get(model.showHiddenFiles) ?? true;
    return [
        {
            label: t("preview.dirSortOrder"),
            submenu: [
                {
                    label: t("previewMenu.sortName"),
                    type: "checkbox",
                    checked: defaultSort === "name",
                    click: () =>
                        fireAndForget(() =>
                            model.env.rpc.SetConfigCommand(TabRpcClient, { "preview:defaultsort": "name" })
                        ),
                },
                {
                    label: t("previewMenu.sortModtime"),
                    type: "checkbox",
                    checked: defaultSort === "modtime",
                    click: () =>
                        fireAndForget(() =>
                            model.env.rpc.SetConfigCommand(TabRpcClient, { "preview:defaultsort": "modtime" })
                        ),
                },
            ],
        },
        {
            label: t("preview.showHiddenFiles"),
            submenu: [
                {
                    label: t("menu.on"),
                    type: "checkbox",
                    checked: showHiddenFiles,
                    click: () => {
                        globalStore.set(model.showHiddenFiles, true);
                        fireAndForget(() =>
                            model.env.rpc.SetConfigCommand(TabRpcClient, { "preview:showhiddenfiles": true })
                        );
                    },
                },
                {
                    label: t("menu.off"),
                    type: "checkbox",
                    checked: !showHiddenFiles,
                    click: () => {
                        globalStore.set(model.showHiddenFiles, false);
                        fireAndForget(() =>
                            model.env.rpc.SetConfigCommand(TabRpcClient, { "preview:showhiddenfiles": false })
                        );
                    },
                },
            ],
        },
    ];
}
