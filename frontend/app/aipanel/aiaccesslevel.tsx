// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { cn, fireAndForget, makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useState } from "react";
import { WaveAIAccessLevelIcons, WaveAIAccessLevels, type WaveAIAccessLevel } from "./ai-utils";
import { WaveAIModel } from "./waveai-model";

const AccessLevelColors: Record<WaveAIAccessLevel, string> = {
    off: "text-muted",
    readonly: "text-secondary",
    collab: "text-typeai",
    trust: "text-warning",
};

export const AIAccessLevelDropdown = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const accessLevel = useAtomValue(model.accessLevelAtom);
    const defaultLevel = useAtomValue(model.defaultAccessLevelAtom);
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (level: WaveAIAccessLevel) => {
        setIsOpen(false);
        if (level !== accessLevel) {
            model.setAccessLevel(level);
        }
        setTimeout(() => model.focusInput(), 0);
    };

    const handleSetDefault = (level: WaveAIAccessLevel) => {
        setIsOpen(false);
        fireAndForget(() => model.setDefaultAccessLevel(level));
        setTimeout(() => model.focusInput(), 0);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors cursor-pointer whitespace-nowrap",
                    isOpen ? "bg-hoverbg text-primary" : "text-secondary hover:bg-hoverbg hover:text-primary"
                )}
                title={t("ai.accessLevelTitle", { level: t(`ai.accessLevel.${accessLevel}`) })}
            >
                <i
                    className={cn(
                        makeIconClass(WaveAIAccessLevelIcons[accessLevel], false),
                        "text-[11px]",
                        AccessLevelColors[accessLevel]
                    )}
                />
                <span>{t(`ai.accessLevel.${accessLevel}`)}</span>
                <i className="fa fa-chevron-down text-[8px]" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    {/* whitespace-normal: the header row this sits in is nowrap, which would otherwise
                        stop the descriptions from wrapping and push them past the panel edge */}
                    <div className="absolute top-full right-0 mt-1 w-[280px] max-w-[calc(100vw-32px)] whitespace-normal bg-raise border border-border rounded shadow-lg z-50 py-1">
                        <div className="px-3 pt-1 pb-1.5 text-[10px] text-secondary uppercase tracking-wide">
                            {t("ai.accessLevelHeader")}
                        </div>
                        {WaveAIAccessLevels.map((level) => {
                            const isSelected = level === accessLevel;
                            const isDefault = level === defaultLevel;
                            return (
                                <div key={level} className="group relative">
                                    <button
                                        onClick={() => handleSelect(level)}
                                        className="w-full flex items-start gap-2.5 px-3 py-1.5 text-left hover:bg-hoverbg cursor-pointer transition-colors"
                                    >
                                        <i
                                            className={cn(
                                                makeIconClass(WaveAIAccessLevelIcons[level], false),
                                                "w-4 text-center text-[12px] mt-0.5",
                                                AccessLevelColors[level]
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={cn(
                                                        "text-sm",
                                                        isSelected ? "text-primary font-semibold" : "text-secondary"
                                                    )}
                                                >
                                                    {t(`ai.accessLevel.${level}`)}
                                                </span>
                                                {isDefault && (
                                                    <span className="px-1 py-px rounded text-[10px] leading-tight text-muted bg-hoverbg">
                                                        {t("ai.accessLevelDefault")}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-muted leading-snug">
                                                {t(`ai.accessLevelDesc.${level}`)}
                                            </div>
                                        </div>
                                        {isSelected && <i className="fa fa-check text-[11px] text-primary mt-1" />}
                                    </button>
                                    {/* a sibling of the row, not a child: a button cannot contain another button */}
                                    {!isDefault && (
                                        <button
                                            onClick={() => handleSetDefault(level)}
                                            title={t("ai.accessLevelSetDefaultTitle")}
                                            className="absolute top-1.5 right-8 px-1.5 py-px rounded text-[10px] text-secondary bg-raise border border-border opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary hover:border-borderstrong cursor-pointer transition-opacity"
                                        >
                                            {t("ai.accessLevelSetDefault")}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        <div className="border-t border-border mt-1 px-3 pt-1.5 pb-1 text-[10px] text-muted leading-snug">
                            {t("ai.accessLevelFooter")}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

AIAccessLevelDropdown.displayName = "AIAccessLevelDropdown";
