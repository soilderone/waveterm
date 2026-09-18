// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import React from "react";
import "./quickelems.scss";

function CenteredLoadingDiv() {
    const t = useT();
    return <CenteredDiv>{t("chrome.loading")}</CenteredDiv>;
}

function CenteredDiv({ children }: { children: React.ReactNode }) {
    return (
        <div className="centered-div">
            <div>{children}</div>
        </div>
    );
}

export { CenteredDiv, CenteredLoadingDiv };
