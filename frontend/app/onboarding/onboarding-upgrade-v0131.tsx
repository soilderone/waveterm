// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_13_1_Content = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-start gap-6 w-full mb-4 unselectable">
            <div className="text-secondary leading-relaxed">
                <p className="mb-0">{t("onboarding.upgrade.v0131.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-brands fa-windows"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0131.sectionWindows")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termLayout")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descLayout")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termGitBash")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descGitBash")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termSshAgent")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descSshAgent")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termFocusKey")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descFocusKey")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-sparkles"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0131.sectionWaveAi")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termVisual")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descVisual")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termByok")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descByok")}
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
                        {t("onboarding.upgrade.v0131.sectionTerminal")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0131.termScroll")}</strong> -{" "}
                                {t("onboarding.upgrade.v0131.descScroll")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_13_1_Content.displayName = "UpgradeOnboardingModal_v0_13_1_Content";

export { UpgradeOnboardingModal_v0_13_1_Content };
