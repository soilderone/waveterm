// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { cn, makeIconClass } from "@/util/util";
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
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (level: WaveAIAccessLevel) => {
        setIsOpen(false);
        if (level !== accessLevel) {
            model.setAccessLevel(level);
        }
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
                    <div className="absolute top-full right-0 mt-1 w-[280px] max-w-[calc(100vw-32px)] bg-raise border border-border rounded shadow-lg z-50 py-1">
                        <div className="px-3 pt-1 pb-1.5 text-[10px] text-secondary uppercase tracking-wide">
                            {t("ai.accessLevelHeader")}
                        </div>
                        {WaveAIAccessLevels.map((level) => {
                            const isSelected = level === accessLevel;
                            return (
                                <button
                                    key={level}
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
                                        <div
                                            className={cn(
                                                "text-sm",
                                                isSelected ? "text-primary font-semibold" : "text-secondary"
                                            )}
                                        >
                                            {t(`ai.accessLevel.${level}`)}
                                        </div>
                                        <div className="text-[11px] text-muted leading-snug">
                                            {t(`ai.accessLevelDesc.${level}`)}
                                        </div>
                                    </div>
                                    {isSelected && <i className="fa fa-check text-[11px] text-primary mt-1" />}
                                </button>
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
