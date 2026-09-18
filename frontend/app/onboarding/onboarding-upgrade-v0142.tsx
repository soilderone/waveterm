// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_14_2_Content = () => {
    const t = useT();
    const waveEnv = useWaveEnv();
    return (
        <div className="flex flex-col items-start w-full mb-2 unselectable">
            <div className="text-secondary leading-relaxed mb-4">
                <p className="mb-0">{t("onboarding.upgrade.v0142.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-bell"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0142.sectionBadges")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.termBadgesRollup")}</strong> -{" "}
                                {t("onboarding.upgrade.v0142.descBadgesRollup")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.termBellIndicator")}</strong> -{" "}
                                {t("onboarding.upgrade.v0142.bellIndicatorPre")}{" "}
                                <code>term:bellindicator</code>
                                {t("onboarding.upgrade.v0142.bellIndicatorPost")}
                            </li>
                            <li>
                                <strong>
                                    <code>wsh badge</code>
                                </strong>{" "}
                                - {t("onboarding.upgrade.v0142.wshBadgeDesc")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.termClaudeIntegration")}</strong> -{" "}
                                {t("onboarding.upgrade.v0142.claudeIntegrationPre")} <code>wsh badge</code>{" "}
                                {t("onboarding.upgrade.v0142.claudeIntegrationDescPost")}{" "}
                                <button
                                    onClick={() =>
                                        waveEnv.electron.openExternal("https://docs.waveterm.dev/claude-code")
                                    }
                                    className="text-accent text-sm font-normal cursor-pointer hover:underline"
                                >
                                    {t("onboarding.upgrade.v0142.seeDocs")}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-folder-open"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0142.sectionOther")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.patchReleaseTerm")} </strong>
                                {t("onboarding.upgrade.v0142.patchReleaseDesc")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.termDirectoryPreview")}</strong> -{" "}
                                {t("onboarding.upgrade.v0142.descDirectoryPreview")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0142.termSearchBar")}</strong> -{" "}
                                {t("onboarding.upgrade.v0142.descSearchBar")}
                            </li>
                            <li>{t("onboarding.upgrade.v0142.bugfixNewWindow")}</li>
                            <li>{t("onboarding.upgrade.v0142.bugfixSaveSession")}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_14_2_Content.displayName = "UpgradeOnboardingModal_v0_14_2_Content";

export { UpgradeOnboardingModal_v0_14_2_Content };
