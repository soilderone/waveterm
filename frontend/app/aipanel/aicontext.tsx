// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { cn, makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useState } from "react";
import { getBlockContextLabel, type BlockContextLabel } from "./ai-utils";
import { WaveAIModel } from "./waveai-model";

export interface ContextEntry {
    block: Block;
    label: BlockContextLabel;
}

export function getContextEntries(blocks: Block[]): ContextEntry[] {
    const entries: ContextEntry[] = [];
    for (const block of blocks) {
        const label = getBlockContextLabel(block);
        if (label != null) {
            entries.push({ block, label });
        }
    }
    return entries;
}

export function filterMentionEntries(entries: ContextEntry[], query: string): ContextEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) {
        return entries;
    }
    return entries.filter((entry) => {
        const haystack = [entry.label.label, entry.label.detail ?? "", entry.block.meta?.view ?? ""]
            .join(" ")
            .toLowerCase();
        return haystack.includes(q);
    });
}

function formatEntryText(label: BlockContextLabel): string {
    return label.detail ? `${label.label} · ${label.detail}` : label.label;
}

interface ContextEntryRowProps {
    entry: ContextEntry;
    isFocused?: boolean;
    isActive?: boolean;
    onClick: () => void;
    onAttach?: () => void;
    onMouseEnter?: () => void;
}

const ContextEntryRow = memo(({ entry, isFocused, isActive, onClick, onAttach, onMouseEnter }: ContextEntryRowProps) => {
    const t = useT();
    return (
        <div
            className={cn(
                "group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors",
                isActive ? "bg-hoverbg" : "hover:bg-hoverbg"
            )}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            <i className={cn(makeIconClass(entry.label.icon, false), "w-4 text-center text-[11px] text-secondary")} />
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
                <span className="text-sm text-primary truncate">{entry.label.label}</span>
                {entry.label.detail && (
                    <span className="text-[11px] text-muted truncate">{entry.label.detail}</span>
                )}
            </div>
            {isFocused && (
                <span className="text-[10px] text-typeai border border-typeai/40 rounded px-1 flex-shrink-0">
                    {t("ai.contextFocused")}
                </span>
            )}
            {onAttach && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAttach();
                    }}
                    className="text-secondary hover:text-primary cursor-pointer px-1 rounded flex-shrink-0 opacity-60 group-hover:opacity-100"
                    title={t("ai.attachWidget")}
                >
                    <i className="fa fa-paperclip text-[11px]" />
                </button>
            )}
        </div>
    );
});

ContextEntryRow.displayName = "ContextEntryRow";

export const AIContextChip = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const accessLevel = useAtomValue(model.accessLevelAtom);
    const blocks = useAtomValue(model.tabBlocksAtom);
    const focusedBlockId = useAtomValue(model.focusedBlockIdAtom);
    const [isOpen, setIsOpen] = useState(false);

    const entries = getContextEntries(blocks);
    const focused = entries.find((entry) => entry.block.oid === focusedBlockId);
    const isOff = accessLevel === "off";

    let chipIcon = "layer-group";
    let chipText = t("ai.contextWidgets", { count: entries.length });
    if (isOff) {
        chipIcon = "lock";
        chipText = t("ai.contextOff");
    } else if (focused != null) {
        chipIcon = focused.label.icon;
        chipText = formatEntryText(focused.label);
    }
    const extraCount = !isOff && focused != null ? entries.length - 1 : 0;

    const handleFocusEntry = (entry: ContextEntry) => {
        setIsOpen(false);
        model.focusBlock(entry.block.oid);
    };

    const handleAttachEntry = (entry: ContextEntry) => {
        setIsOpen(false);
        model.attachBlockContext(entry.block);
        model.focusInput();
    };

    return (
        <div className="relative min-w-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] max-w-[190px] transition-colors cursor-pointer",
                    isOpen ? "bg-hoverbg text-primary" : "text-secondary hover:bg-hoverbg hover:text-primary"
                )}
                title={isOff ? t("ai.contextOffTitle") : t("ai.contextChipTitle")}
            >
                <i className={cn(makeIconClass(chipIcon, false), "text-[10px] flex-shrink-0")} />
                <span className="truncate">{chipText}</span>
                {extraCount > 0 && <span className="text-muted flex-shrink-0">+{extraCount}</span>}
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 w-[280px] max-w-[calc(100vw-32px)] bg-raise border border-border rounded shadow-lg z-50 py-1">
                        <div className="px-3 pt-1 pb-1.5 text-[11px] text-secondary leading-snug">
                            {isOff ? t("ai.contextMenuOffHeader") : t("ai.contextMenuHeader")}
                        </div>
                        {entries.length === 0 && (
                            <div className="px-3 py-1.5 text-sm text-muted">{t("ai.contextNoWidgets")}</div>
                        )}
                        {entries.map((entry) => (
                            <ContextEntryRow
                                key={entry.block.oid}
                                entry={entry}
                                isFocused={entry.block.oid === focusedBlockId}
                                onClick={() => handleFocusEntry(entry)}
                                onAttach={() => handleAttachEntry(entry)}
                            />
                        ))}
                        <div className="border-t border-border mt-1 px-3 pt-1.5 pb-1 text-[10px] text-muted leading-snug">
                            {t("ai.contextMenuFooter")}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

AIContextChip.displayName = "AIContextChip";

interface AIMentionPopupProps {
    entries: ContextEntry[];
    activeIndex: number;
    onSelect: (entry: ContextEntry) => void;
    onHover: (index: number) => void;
}

export const AIMentionPopup = memo(({ entries, activeIndex, onSelect, onHover }: AIMentionPopupProps) => {
    const t = useT();
    return (
        // mousedown would otherwise blur the textarea and lose the caret position the mention is replacing
        <div
            className="absolute bottom-full left-0 right-0 mb-1 bg-raise border border-border rounded shadow-lg z-50 py-1 max-h-[240px] overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="px-3 pt-0.5 pb-1 text-[10px] text-secondary uppercase tracking-wide">
                {t("ai.mentionHeader")}
            </div>
            {entries.length === 0 && <div className="px-3 py-1.5 text-sm text-muted">{t("ai.contextNoWidgets")}</div>}
            {entries.map((entry, idx) => (
                <ContextEntryRow
                    key={entry.block.oid}
                    entry={entry}
                    isActive={idx === activeIndex}
                    onClick={() => onSelect(entry)}
                    onMouseEnter={() => onHover(idx)}
                />
            ))}
        </div>
    );
});

AIMentionPopup.displayName = "AIMentionPopup";
