// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { getSettingsKeyAtom } from "@/store/global";
import { atom, PrimitiveAtom, useAtomValue } from "jotai";
import { useLayoutEffect } from "react";

export function resolveUITheme(setting: string, prefersLight: boolean): string {
    if (setting === "system") {
        return prefersLight ? "light" : "dark";
    }
    return setting === "light" ? "light" : "dark";
}

const prefersLightAtom = atom(false) as PrimitiveAtom<boolean>;

// The resolved theme, for the parts of the app that pick assets rather than CSS variables --
// the terminal palette and the Monaco theme cannot read a var() off the document root.
export const resolvedUIThemeAtom = atom((get) =>
    resolveUITheme(get(getSettingsKeyAtom("app:uitheme")), get(prefersLightAtom))
);

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
            globalStore.set(prefersLightAtom, mql.matches);
            applyUITheme(uiTheme);
        };
        apply();
        mql.addEventListener("change", apply);
        return () => mql.removeEventListener("change", apply);
    }, [uiTheme]);
    return null;
}
