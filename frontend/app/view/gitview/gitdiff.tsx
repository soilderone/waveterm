// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { loadMonaco } from "@/app/monaco/monaco-env";
import { DiffViewer } from "@/app/view/codeeditor/diffviewer";
import { useT } from "@/util/i18n-hooks";
import { cn } from "@/util/util";
import { useAtomValue } from "jotai";
import * as monaco from "monaco-editor";
import { memo } from "react";
import type { GitDiffSlot, GitViewModel } from "./gitview-model";

// DiffViewer's models live under a synthetic URI (".orig" / ".mod"), so Monaco cannot infer the
// language from the file name on its own.
function guessLanguage(filePath: string): string {
    loadMonaco();
    const base = (filePath.split("/").pop() ?? "").toLowerCase();
    let best: string = null;
    let bestLen = 0;
    for (const lang of monaco.languages.getLanguages()) {
        if (lang.filenames?.some((name) => name.toLowerCase() === base)) {
            return lang.id;
        }
        for (const ext of lang.extensions ?? []) {
            const lowerExt = ext.toLowerCase();
            if (base.endsWith(lowerExt) && lowerExt.length > bestLen) {
                best = lang.id;
                bestLen = lowerExt.length;
            }
        }
    }
    return best ?? "plaintext";
}

export function statusColorClass(status: string): string {
    switch (status) {
        case "A":
        case "U":
            return "text-success";
        case "D":
        case "!":
            return "text-error";
        case "R":
        case "C":
            return "text-info";
        default:
            return "text-warning";
    }
}

export function splitPath(path: string): { name: string; dir: string } {
    const idx = path.lastIndexOf("/");
    if (idx === -1) {
        return { name: path, dir: "" };
    }
    return { name: path.substring(idx + 1), dir: path.substring(0, idx) };
}

function DiffMessage({ text, error }: { text: string; error?: boolean }) {
    return (
        <div
            className={cn(
                "flex items-center justify-center w-full h-full px-4 text-center text-xs",
                error ? "text-error" : "text-secondary"
            )}
        >
            {text}
        </div>
    );
}

type GitDiffPaneProps = {
    model: GitViewModel;
    slot: GitDiffSlot;
    onBack?: () => void;
};

export const GitDiffPane = memo(function GitDiffPane({ model, slot, onBack }: GitDiffPaneProps) {
    const t = useT();
    const target = useAtomValue(slot.targetAtom);
    const state = useAtomValue(slot.stateAtom);

    if (target == null) {
        return <DiffMessage text={t("git.selectFile")} />;
    }

    const { name, dir } = splitPath(target.file);
    let modeLabel: string;
    if (target.mode === "staged") {
        modeLabel = t("git.modeStaged");
    } else if (target.mode === "unstaged") {
        modeLabel = t("git.modeWorkingTree");
    } else {
        modeLabel = t("git.modeCommit", { hash: target.hash?.substring(0, 7) ?? "" });
    }

    let body: React.ReactNode;
    if (state == null || (state.loading && state.data == null)) {
        body = <DiffMessage text={t("git.loadingDiff")} />;
    } else if (state.error != null) {
        body = <DiffMessage text={state.error} error={true} />;
    } else if (state.data?.toolarge) {
        body = <DiffMessage text={t("git.fileTooLarge")} />;
    } else if (state.data?.binary) {
        body = <DiffMessage text={t("git.binaryFile")} />;
    } else if (state.data != null && state.data.original === state.data.modified) {
        body = <DiffMessage text={t("git.noTextChanges")} />;
    } else {
        body = (
            <DiffViewer
                key={target.key}
                blockId={model.blockId}
                original={state.data?.original ?? ""}
                modified={state.data?.modified ?? ""}
                language={guessLanguage(target.file)}
                fileName={target.key}
            />
        );
    }

    const title = target.origfile ? `${target.origfile} → ${target.file}` : target.file;
    return (
        <div className="flex flex-col w-full h-full min-w-0 overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 h-7 px-2 border-b border-border bg-panel text-xs">
                {onBack != null && (
                    <Tooltip content={t("git.back")} placement="bottom">
                        <button
                            className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            onClick={onBack}
                        >
                            <i className="fa-sharp fa-solid fa-arrow-left text-[10px]" />
                        </button>
                    </Tooltip>
                )}
                <span
                    className={cn("shrink-0 w-3 text-center font-mono font-semibold", statusColorClass(target.status))}
                >
                    {target.status}
                </span>
                <Tooltip content={title} placement="bottom" divClassName="flex items-baseline gap-1.5 min-w-0">
                    <span className="truncate text-primary">{name}</span>
                    {dir !== "" && <span className="truncate text-muted text-[11px]">{dir}</span>}
                </Tooltip>
                <span className="shrink-0 ml-auto text-muted text-[11px]">{modeLabel}</span>
                {target.mode !== "commit" && (
                    <Tooltip content={t("git.openFile")} placement="bottom">
                        <button
                            className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            onClick={() => model.openFileInPreview(target.file)}
                        >
                            <i className="fa-sharp fa-solid fa-arrow-up-right-from-square text-[10px]" />
                        </button>
                    </Tooltip>
                )}
            </div>
            <div className="flex-1 min-h-0">{body}</div>
        </div>
    );
});
GitDiffPane.displayName = "GitDiffPane";
