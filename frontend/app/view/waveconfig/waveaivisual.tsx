// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import { useT } from "@/util/i18n-hooks";
import { memo } from "react";

interface WaveAIVisualContentProps {
    model: WaveConfigViewModel;
}

export const WaveAIVisualContent = memo(({ model }: WaveAIVisualContentProps) => {
    const t = useT();
    return (
        <div className="flex flex-col gap-4 p-6 h-full">
            <div className="text-lg font-semibold">{t("config.waveAiVisualEditor")}</div>
            <div className="text-muted-foreground">{t("config.visualEditorComingSoon")}</div>
        </div>
    );
});

WaveAIVisualContent.displayName = "WaveAIVisualContent";