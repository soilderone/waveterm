// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_14_1_Content = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-start w-full mb-2 unselectable">
            <div className="text-secondary leading-relaxed mb-4">
                <p className="mb-0">{t("onboarding.upgrade.v0141.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-terminal"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0141.sectionTerminalFixes")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termClaudeScroll")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descClaudeScroll")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termImeFix")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descImeFix")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termScrollPosition")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descScrollPosition")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termScrollbackSave")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.scrollbackSavePre")} <code>wsh</code>{" "}
                                {t("onboarding.upgrade.v0141.scrollbackSavePost")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-sliders"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0141.sectionConfig")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termFocusCursor")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.focusCursorPre")}{" "}
                                <code>app:focusfollowscursor</code>{" "}
                                {t("onboarding.upgrade.v0141.focusCursorPost")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termCursorStyle")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descCursorStyle")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termVimNav")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descVimNav")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0141.termAiProviders")}</strong> -{" "}
                                {t("onboarding.upgrade.v0141.descAiProviders")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_14_1_Content.displayName = "UpgradeOnboardingModal_v0_14_1_Content";

export { UpgradeOnboardingModal_v0_14_1_Content };
