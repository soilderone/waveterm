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

export function getMimeTypeIcon(fullConfig: FullConfigType, mimeType: string): string {
    while (mimeType.length > 0) {
        const icon = fullConfig.mimetypes?.[mimeType]?.icon ?? null;
        if (isIconValid(icon)) {
            return `fa fa-solid fa-${icon} fa-fw`;
        }
        mimeType = mimeType.slice(0, -1);
    }
    return "fa fa-solid fa-file fa-fw";
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

export function compareTreeEntries(a: FileInfo, b: FileInfo, sort: TreeSortType): number {
    const dirCompare = Number(!!b.isdir) - Number(!!a.isdir);
    if (dirCompare != 0) {
        return dirCompare;
    }
    const dirMul = sort.desc ? -1 : 1;
    if (sort.field == "modtime") {
        return ((a.modtime ?? 0) - (b.modtime ?? 0)) * dirMul || a.name.localeCompare(b.name);
    }
    if (sort.field == "size") {
        return ((a.size ?? 0) - (b.size ?? 0)) * dirMul || a.name.localeCompare(b.name);
    }
    if (sort.field == "modestr") {
        return (a.modestr ?? "").localeCompare(b.modestr ?? "") * dirMul || a.name.localeCompare(b.name);
    }
    if (sort.field == "mimetype") {
        const typeCompare = cleanMimetype(a.mimetype ?? "").localeCompare(cleanMimetype(b.mimetype ?? ""));
        return typeCompare * dirMul || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name) * dirMul;
}

export function handleRename(
    model: PreviewModel,
    path: string,
    newPath: string,
    isDir: boolean,
    setErrorMsg: (msg: ErrorMsg) => void,
    refresh?: () => void
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
    refresh?: () => void
) {
    fireAndForget(async () => {
        const formattedPath = await model.formatRemoteUri(path, globalStore.get);
        try {
            await model.env.rpc.FileDeleteCommand(TabRpcClient, {
                path: formattedPath,
                recursive,
            });
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
                            onClick: () => handleFileDelete(model, path, true, setErrorMsg, refresh),
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
