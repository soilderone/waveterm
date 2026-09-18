// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_12_3_Content = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-start gap-6 w-full mb-4 unselectable">
            <div className="text-secondary leading-relaxed">
                <p className="mb-0">{t("onboarding.upgrade.v0123.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-sparkles"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0123.sectionWaveAi")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0123.termGpt")}</strong> -{" "}
                                {t("onboarding.upgrade.v0123.descGpt")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0123.termThinking")}</strong> -{" "}
                                {t("onboarding.upgrade.v0123.descThinking")}
                            </li>
                            <li>{t("onboarding.upgrade.v0123.aiBackupFix")}</li>
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
                        {t("onboarding.upgrade.v0123.sectionTerminal")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0123.termInput")}</strong> -{" "}
                                {t("onboarding.upgrade.v0123.descInput")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0123.termImage")}</strong> -{" "}
                                {t("onboarding.upgrade.v0123.descImage")}
                            </li>
                            <li>{t("onboarding.upgrade.v0123.termShiftEnter")}</li>
                            <li>{t("onboarding.upgrade.v0123.termIme")}</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-key"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0123.sectionSecret")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0123.termSecretWidget")}</strong> -{" "}
                                {t("onboarding.upgrade.v0123.descSecretWidget")}
                            </li>
                            <li>
                                {t("onboarding.upgrade.v0123.secretCliPre")}{" "}
                                <span className="font-mono">wsh secret list/get/set</span>{" "}
                                {t("onboarding.upgrade.v0123.secretCliPost")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_12_3_Content.displayName = "UpgradeOnboardingModal_v0_12_3_Content";

export { UpgradeOnboardingModal_v0_12_3_Content };
