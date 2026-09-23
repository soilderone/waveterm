// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { waveEventSubscribeSingle } from "@/app/store/wps";
import { nativeTheme, systemPreferences } from "electron";
import { unamePlatform } from "./emain-platform";

// These paint before the renderer loads and must match --sage-bg in theme.scss.
const DarkChromeBgColor = "#111713";
const LightChromeBgColor = "#e9ece5";
const ThemeListeners = new Set<() => void>();

export function getChromeTheme() {
    const light = !nativeTheme.shouldUseDarkColors;
    return {
        background: light ? LightChromeBgColor : DarkChromeBgColor,
        symbol: light ? "#3a453e" : "#c3c8c2",
    };
}

// macOS reports the accent as RRGGBBAA; the renderer only needs the opaque colour
export function getSystemAccentColor(): string {
    if (unamePlatform !== "darwin") {
        return "";
    }
    const rgba = systemPreferences.getAccentColor();
    if (rgba == null || rgba.length < 6) {
        return "";
    }
    return "#" + rgba.slice(0, 6);
}

export function subscribeSystemAccentColor(listener: (color: string) => void) {
    if (unamePlatform !== "darwin") {
        return;
    }
    systemPreferences.subscribeNotification("AppleColorPreferencesChangedNotification", () => {
        listener(getSystemAccentColor());
    });
}

export function subscribeChromeTheme(listener: () => void): () => void {
    ThemeListeners.add(listener);
    listener();
    return () => {
        ThemeListeners.delete(listener);
    };
}

export function initChromeTheme(fullConfig: FullConfigType) {
    const apply = (config: FullConfigType) => {
        const setting = config?.settings?.["app:uitheme"];
        const source = setting === "light" || setting === "system" ? setting : "dark";
        if (nativeTheme.themeSource !== source) {
            nativeTheme.themeSource = source;
        }
    };
    apply(fullConfig);
    nativeTheme.on("updated", () => {
        for (const listener of ThemeListeners) {
            listener();
        }
    });
    waveEventSubscribeSingle({
        eventType: "config",
        handler: (event) => apply(event.data.fullconfig),
    });
}
