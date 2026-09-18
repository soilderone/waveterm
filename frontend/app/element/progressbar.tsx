// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { boundNumber } from "@/util/util";
import "./progressbar.scss";

type ProgressBarProps = {
    progress: number;
    label?: string;
};

const ProgressBar = ({ progress, label }: ProgressBarProps) => {
    const t = useT();
    const progressWidth = boundNumber(progress, 0, 100);
    const resolvedLabel = label ?? t("chrome.progress");

    return (
        <div
            className="progress-bar-container"
            role="progressbar"
            aria-valuenow={progressWidth}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={resolvedLabel}
        >
            <div className="outer">
                <div className="progress-bar-fill" style={{ width: `${progressWidth}%` }}></div>
            </div>
            <span className="progress-bar-label">{progressWidth}%</span>
        </div>
    );
};

export { ProgressBar };
