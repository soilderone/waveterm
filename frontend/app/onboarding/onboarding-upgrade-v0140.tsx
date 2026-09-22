// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_14_0_Content = () => {
    const t = useT();
    const waveEnv = useWaveEnv();
    return (
        <div className="flex flex-col items-start w-full mb-2 unselectable">
            <div className="text-secondary leading-relaxed mb-4">
                <p className="mb-0">{t("onboarding.upgrade.v0140.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-info fa-sharp fa-solid fa-shield"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0140.sectionDurable")}{" "}
                        <button
                            onClick={() => waveEnv.electron.openExternal("https://docs.waveterm.dev/durable-sessions")}
                            className="text-accent text-sm font-normal cursor-pointer hover:underline"
                        >
                            {t("onboarding.upgrade.v0140.seeDocs")}
                        </button>
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termSessionProtection")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descSessionProtection")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termVisualStatus")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descVisualStatus")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termFlexibleConfig")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descFlexibleConfig")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-network-wired"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0140.sectionConnection")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termKeepalives")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descKeepalives")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termStalledDetection")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descStalledDetection")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-sparkles"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0140.sectionAi")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termImageSupport")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descImageSupport")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termStopGeneration")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descStopGeneration")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termAutoScrolling")}</strong>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-terminal"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0140.sectionTerminal")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termContextMenu")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descContextMenu")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0140.termOsc52")}</strong> -{" "}
                                {t("onboarding.upgrade.v0140.descOsc52")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_14_0_Content.displayName = "UpgradeOnboardingModal_v0_14_0_Content";

export { UpgradeOnboardingModal_v0_14_0_Content };
