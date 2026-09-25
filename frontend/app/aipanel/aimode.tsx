// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { atoms, getSettingsKeyAtom } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { t } from "@/util/i18n";
import { useT } from "@/util/i18n-hooks";
import { cn, fireAndForget, makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useRef, useState } from "react";
import { getFilteredAIModeConfigs, getModeDisplayDescription, getModeDisplayName } from "./ai-utils";
import { WaveAIModel } from "./waveai-model";

interface AIModeMenuItemProps {
    config: AIModeConfigWithMode;
    isSelected: boolean;
    isDisabled: boolean;
    isPremiumDisabled: boolean;
    onClick: () => void;
    isFirst?: boolean;
    isLast?: boolean;
}

const AIModeMenuItem = memo(
    ({ config, isSelected, isDisabled, isPremiumDisabled, onClick, isFirst, isLast }: AIModeMenuItemProps) => {
        const t = useT();
        return (
            <button
                key={config.mode}
                onClick={onClick}
                disabled={isDisabled}
                className={cn(
                    "w-full flex flex-col gap-0.5 px-3 transition-colors text-left",
                    isFirst ? "pt-1 pb-0.5" : isLast ? "pt-0.5 pb-1" : "pt-0.5 pb-0.5",
                    isDisabled ? "text-muted" : "text-secondary hover:bg-raise cursor-pointer"
                )}
            >
                <div className="flex items-center gap-2 w-full">
                    <i className={makeIconClass(config["display:icon"] || "sparkles", false)}></i>
                    <span className={cn("text-sm", isSelected && "font-bold")}>
                        {getModeDisplayName(config)}
                        {isPremiumDisabled && t("ai.premiumSuffix")}
                    </span>
                    {isSelected && <i className="fa fa-check ml-auto"></i>}
                </div>
                {config["display:description"] && (
                    <div
                        className={cn("text-xs pl-5", isDisabled ? "text-muted" : "text-muted")}
                        style={{ whiteSpace: "pre-line" }}
                    >
                        {getModeDisplayDescription(config)}
                    </div>
                )}
            </button>
        );
    }
);

AIModeMenuItem.displayName = "AIModeMenuItem";

interface ConfigSection {
    sectionName: string;
    configs: AIModeConfigWithMode[];
    isIncompatible?: boolean;
    noTelemetry?: boolean;
}

function computeCompatibleSections(
    currentMode: string,
    aiModeConfigs: Record<string, AIModeConfigType>,
    waveProviderConfigs: AIModeConfigWithMode[],
    otherProviderConfigs: AIModeConfigWithMode[]
): ConfigSection[] {
    const currentConfig = aiModeConfigs[currentMode];
    const allConfigs = [...waveProviderConfigs, ...otherProviderConfigs];

    if (!currentConfig) {
        return [{ sectionName: t("ai.incompatibleModes"), configs: allConfigs, isIncompatible: true }];
    }

    const currentSwitchCompat = currentConfig["ai:switchcompat"] || [];
    const compatibleConfigs: AIModeConfigWithMode[] = [{ ...currentConfig, mode: currentMode }];
    const incompatibleConfigs: AIModeConfigWithMode[] = [];

    if (currentSwitchCompat.length === 0) {
        allConfigs.forEach((config) => {
            if (config.mode !== currentMode) {
                incompatibleConfigs.push(config);
            }
        });
    } else {
        allConfigs.forEach((config) => {
            if (config.mode === currentMode) return;

            const configSwitchCompat = config["ai:switchcompat"] || [];
            const hasMatch = currentSwitchCompat.some((currentTag: string) => configSwitchCompat.includes(currentTag));

            if (hasMatch) {
                compatibleConfigs.push(config);
            } else {
                incompatibleConfigs.push(config);
            }
        });
    }

    const sections: ConfigSection[] = [];
    const compatibleSectionName = compatibleConfigs.length === 1 ? t("ai.currentMode") : t("ai.compatibleModes");
    sections.push({ sectionName: compatibleSectionName, configs: compatibleConfigs });

    if (incompatibleConfigs.length > 0) {
        sections.push({ sectionName: t("ai.incompatibleModes"), configs: incompatibleConfigs, isIncompatible: true });
    }

    return sections;
}

function computeWaveCloudSections(
    waveProviderConfigs: AIModeConfigWithMode[],
    otherProviderConfigs: AIModeConfigWithMode[],
    telemetryEnabled: boolean
): ConfigSection[] {
    const sections: ConfigSection[] = [];

    if (waveProviderConfigs.length > 0) {
        sections.push({
            sectionName: "Wave AI Cloud",
            configs: waveProviderConfigs,
            noTelemetry: !telemetryEnabled,
        });
    }
    if (otherProviderConfigs.length > 0) {
        sections.push({ sectionName: t("ai.custom"), configs: otherProviderConfigs });
    }

    return sections;
}

interface AIModeDropdownProps {
    compatibilityMode?: boolean;
}

// lives in the input toolbar, so the menu opens upward
export const AIModeDropdown = memo(({ compatibilityMode = false }: AIModeDropdownProps) => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const currentMode = useAtomValue(model.currentAIMode);
    const aiModeConfigs = useAtomValue(model.aiModeConfigs);
    const waveaiModeConfigs = useAtomValue(atoms.waveaiModeConfigAtom);
    const widgetContextEnabled = useAtomValue(model.widgetAccessAtom);
    const hasPremium = useAtomValue(model.hasPremiumAtom);
    const showCloudModes = useAtomValue(getSettingsKeyAtom("waveai:showcloudmodes"));
    const telemetryEnabled = useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { waveProviderConfigs, otherProviderConfigs } = getFilteredAIModeConfigs(
        aiModeConfigs,
        showCloudModes,
        model.inBuilder,
        hasPremium,
        currentMode
    );

    const sections: ConfigSection[] = compatibilityMode
        ? computeCompatibleSections(currentMode, aiModeConfigs, waveProviderConfigs, otherProviderConfigs)
        : computeWaveCloudSections(waveProviderConfigs, otherProviderConfigs, telemetryEnabled);

    const showSectionHeaders = compatibilityMode || sections.length > 1;

    const handleSelect = (mode: string) => {
        const config = aiModeConfigs[mode];
        if (!config) return;
        if (!hasPremium && config["waveai:premium"]) {
            return;
        }
        model.setAIMode(mode);
        setIsOpen(false);
    };

    const displayConfig = aiModeConfigs[currentMode];
    const displayName = displayConfig ? getModeDisplayName(displayConfig) : t("ai.invalidMode", { mode: currentMode });
    const displayIcon = displayConfig ? displayConfig["display:icon"] || "sparkles" : "question";
    const resolvedConfig = waveaiModeConfigs[currentMode];
    const hasToolsSupport = resolvedConfig && resolvedConfig["ai:capabilities"]?.includes("tools");
    const showNoToolsWarning = widgetContextEnabled && resolvedConfig && !hasToolsSupport;

    const handleNewChatClick = () => {
        model.clearChat();
        setIsOpen(false);
    };

    const handleConfigureClick = () => {
        fireAndForget(async () => {
            RpcApi.RecordTEventCommand(
                TabRpcClient,
                {
                    event: "action:other",
                    props: {
                        "action:type": "waveai:configuremodes:contextmenu",
                    },
                },
                { noresponse: true }
            );
            await model.openWaveAIConfig();
            setIsOpen(false);
        });
    };

    const handleEnableTelemetry = () => {
        fireAndForget(async () => {
            await RpcApi.WaveAIEnableTelemetryCommand(TabRpcClient);
            setTimeout(() => {
                model.focusInput();
            }, 100);
        });
    };

    return (
        <div className="relative flex items-center min-w-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "group flex items-center gap-1.5 px-1.5 py-0.5 text-secondary hover:text-primary rounded transition-colors cursor-pointer min-w-0",
                    isOpen ? "bg-hoverbg text-primary" : "hover:bg-hoverbg"
                )}
                title={t("ai.aiModeTitle", { name: displayName })}
            >
                <i className={cn(makeIconClass(displayIcon, false), "text-[10px] flex-shrink-0")}></i>
                <span className="text-[11px] truncate max-w-[140px]">{displayName}</span>
                <i className="fa fa-chevron-down text-[8px] flex-shrink-0"></i>
            </button>

            {showNoToolsWarning && (
                <Tooltip content={<div className="max-w-xs">{t("ai.noToolsWarning")}</div>} placement="top">
                    <i
                        className="fa fa-triangle-exclamation text-[10px] text-warning ml-0.5 cursor-default"
                        aria-label={t("ai.noToolsSupport")}
                    ></i>
                </Tooltip>
            )}

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 bg-raise border border-border rounded shadow-lg z-50 min-w-[280px] max-w-[calc(100vw-32px)] max-h-[60vh] overflow-y-auto">
                        {sections.map((section, sectionIndex) => {
                            const isFirstSection = sectionIndex === 0;
                            const isLastSection = sectionIndex === sections.length - 1;

                            return (
                                <div key={section.sectionName}>
                                    {!isFirstSection && <div className="border-t border-border my-2" />}
                                    {showSectionHeaders && (
                                        <>
                                            <div
                                                className={cn(
                                                    "pb-1 text-center text-[10px] text-secondary uppercase tracking-wide",
                                                    isFirstSection ? "pt-2" : "pt-0"
                                                )}
                                            >
                                                {section.sectionName}
                                            </div>
                                            {section.isIncompatible && (
                                                <div className="text-center text-[11px] text-error pb-1">
                                                    {t("ai.startNewChatToSwitch")}
                                                </div>
                                            )}
                                            {section.noTelemetry && (
                                                <button
                                                    onClick={handleEnableTelemetry}
                                                    className="text-center text-[11px] text-success hover:text-success/80 pb-1 cursor-pointer transition-colors w-full"
                                                >
                                                    {t("ai.enableTelemetryUnlock")}
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {section.configs.map((config, index) => {
                                        const isFirst = index === 0 && isFirstSection && !showSectionHeaders;
                                        const isLast = index === section.configs.length - 1 && isLastSection;
                                        const isPremiumDisabled = !hasPremium && config["waveai:premium"];
                                        const isIncompatibleDisabled = section.isIncompatible || false;
                                        const isTelemetryDisabled = section.noTelemetry || false;
                                        const isDisabled =
                                            isPremiumDisabled || isIncompatibleDisabled || isTelemetryDisabled;
                                        const isSelected = currentMode === config.mode;
                                        return (
                                            <AIModeMenuItem
                                                key={config.mode}
                                                config={config}
                                                isSelected={isSelected}
                                                isDisabled={isDisabled}
                                                isPremiumDisabled={isPremiumDisabled}
                                                onClick={() => handleSelect(config.mode)}
                                                isFirst={isFirst}
                                                isLast={isLast}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })}
                        <div className="border-t border-border my-1" />
                        <button
                            onClick={handleNewChatClick}
                            className="w-full flex items-center gap-2 px-3 pt-1 pb-1 text-secondary hover:bg-raise cursor-pointer transition-colors text-left"
                        >
                            <i className={makeIconClass("plus", false)}></i>
                            <span className="text-sm">{t("ai.newChat")}</span>
                        </button>
                        <button
                            onClick={handleConfigureClick}
                            className="w-full flex items-center gap-2 px-3 pt-1 pb-2 text-secondary hover:bg-raise cursor-pointer transition-colors text-left"
                        >
                            <i className={makeIconClass("gear", false)}></i>
                            <span className="text-sm">{t("ai.configureModes")}</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
});

AIModeDropdown.displayName = "AIModeDropdown";
