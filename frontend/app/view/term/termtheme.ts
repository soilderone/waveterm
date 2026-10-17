// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { TermViewModel } from "@/app/view/term/term-model";
import { computeTheme } from "@/app/view/term/termutil";
import { TermWrap } from "@/app/view/term/termwrap";
import { atoms } from "@/store/global";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";

interface TermThemeProps {
    termWrap: TermWrap;
    model: TermViewModel;
}

const TermThemeUpdater = ({ model, termWrap }: TermThemeProps) => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const blockTermTheme = useAtomValue(model.termThemeNameAtom);
    const transparency = useAtomValue(model.termTransparencyAtom);
    const theme = useMemo(
        () => computeTheme(fullConfig, blockTermTheme, transparency)[0],
        [fullConfig, blockTermTheme, transparency]
    );
    useEffect(() => {
        if (termWrap == null || termWrap.disposed) {
            return;
        }
        const currentTheme = termWrap.terminal.options.theme;
        const keys = new Set([...Object.keys(theme), ...Object.keys(currentTheme ?? {})]);
        if ([...keys].some((key) => theme[key] !== currentTheme?.[key])) {
            termWrap.terminal.options.theme = theme;
        }
    }, [theme, termWrap]);
    return null;
};

export { TermThemeUpdater };
