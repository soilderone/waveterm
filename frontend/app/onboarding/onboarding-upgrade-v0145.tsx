// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";

const UpgradeOnboardingModal_v0_14_5_Content = () => {
    const t = useT();
    return (
        <div className="flex flex-col items-start gap-6 w-full mb-4 unselectable">
            <div className="text-secondary leading-relaxed">
                <p className="mb-0">{t("onboarding.upgrade.v0145.intro")}</p>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-list-tree"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0145.sectionProcessViewer")}
                    </div>
                    <div className="text-secondary leading-5">{t("onboarding.upgrade.v0145.processViewerDesc")}</div>
                </div>
            </div>

            <div className="flex w-full items-start gap-4">
                <div className="flex-shrink-0">
                    <i className="text-[24px] text-accent fa-solid fa-wrench"></i>
                </div>
                <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="text-foreground text-base font-semibold leading-[18px]">
                        {t("onboarding.upgrade.v0145.sectionOther")}
                    </div>
                    <div className="text-secondary leading-5">
                        <ul className="list-disc list-outside space-y-1 pl-5">
                            <li>
                                <strong>{t("onboarding.upgrade.v0145.termQuake")}</strong>{" "}
                                {t("onboarding.upgrade.v0145.quakeDescPre")}
                                <code>app:globalhotkey</code>
                                {t("onboarding.upgrade.v0145.quakeDescPost")}
                            </li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0145.termDragDrop")}</strong>{" "}
                                {t("onboarding.upgrade.v0145.dragDropDesc")}
                            </li>
                            <li>
                                {t("onboarding.upgrade.v0145.splitButtonsPre")}{" "}
                                <code>app:showsplitbuttons</code> {t("onboarding.upgrade.v0145.splitButtonsPost")}
                            </li>
                            <li>{t("onboarding.upgrade.v0145.otherSidebarToggle")}</li>
                            <li>{t("onboarding.upgrade.v0145.otherF2Rename")}</li>
                            <li>{t("onboarding.upgrade.v0145.otherMouseButtons")}</li>
                            <li>
                                <strong>{t("onboarding.upgrade.v0145.bugfixTerm")}</strong>{" "}
                                {t("onboarding.upgrade.v0145.bugfixDesc")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

UpgradeOnboardingModal_v0_14_5_Content.displayName = "UpgradeOnboardingModal_v0_14_5_Content";

export { UpgradeOnboardingModal_v0_14_5_Content };
