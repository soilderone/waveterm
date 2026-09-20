// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/store/global";
import { useAtomValue } from "jotai";
import { useLayoutEffect } from "react";

export function resolveUITheme(setting: string, prefersLight: boolean): string {
    if (setting === "system") {
        return prefersLight ? "light" : "dark";
    }
    return setting === "light" ? "light" : "dark";
}

export function applyUITheme(setting: string) {
    const theme = resolveUITheme(setting, window.matchMedia("(prefers-color-scheme: light)").matches);
    if (document.documentElement.dataset.uitheme !== theme) {
        document.documentElement.dataset.uitheme = theme;
    }
}

// Each window has its own document, so every window root renders this.
export function UIThemeUpdater() {
    const uiTheme = useAtomValue(getSettingsKeyAtom("app:uitheme"));
    useLayoutEffect(() => {
        const mql = window.matchMedia("(prefers-color-scheme: light)");
        const apply = () => {
            applyUITheme(uiTheme);
        };
        apply();
        if (uiTheme !== "system") {
            return;
        }
        mql.addEventListener("change", apply);
        return () => mql.removeEventListener("change", apply);
    }, [uiTheme]);
    return null;
}
