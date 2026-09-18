// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_14_4_Content = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-start gap-6 w-full mb-4 unselectable">
            <div className="text-secondary leading-relaxed">
                <p className="mb-0">{t("onboarding.upgrade.v0144.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-table-columns"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0144.sectionVertical")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0144.termVerticalTab")}</strong> -{" "}
                                {t("onboarding.upgrade.v0144.descVerticalTab")}
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
                        {t("onboarding.upgrade.v0144.sectionTerminal")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0144.termXterm")}</strong> -{" "}
                                {t("onboarding.upgrade.v0144.descXterm")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-wrench"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0144.sectionOther")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0144.termMacosClick")}</strong> -{" "}
                                {t("onboarding.upgrade.v0144.descMacosClick")}
                            </li>
                            <li>
                                <strong>
                                    <code>backgrounds.json</code>
                                </strong>{" "}
                                - {t("onboarding.upgrade.v0144.backgroundsRenamePre")}{" "}
                                <code>presets/bg.json</code> {t("onboarding.upgrade.v0144.backgroundsRenamePost")}{" "}
                                <code>backgrounds.json</code>
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0144.termConfigErrors")}</strong> -{" "}
                                {t("onboarding.upgrade.v0144.descConfigErrors")}
                            </li>
                            <li>{t("onboarding.upgrade.v0144.otherUnsaved")}</li>
                            <li>{t("onboarding.upgrade.v0144.otherPreviewStreaming")}</li>
                            <li>{t("onboarding.upgrade.v0144.otherLegacyAi")}</li>
                            <li>{t("onboarding.upgrade.v0144.bugfixFocus")}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_14_4_Content.displayName = "UpgradeOnboardingModal_v0_14_4_Content";

export { UpgradeOnboardingModal_v0_14_4_Content };
