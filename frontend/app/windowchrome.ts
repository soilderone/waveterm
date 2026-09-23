// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, getApi, globalStore } from "@/store/global";

let systemAccentColor: string = null;
let accentColorInitialized = false;

// AppKit greys a window's accents while it is not the key window. emain relays BrowserWindow
// focus/blur rather than this document's own blur event, which also fires whenever focus moves
// into a <webview> guest inside the same window.
export function initWindowFocusState() {
    getApi().onWindowFocusChange((focused) => {
        document.documentElement.dataset.windowfocus = focused ? "on" : "off";
    });
}

function applyAccentColor() {
    const root = document.documentElement;
    const setting = globalStore.get(atoms.settingsAtom)?.["app:accentcolor"];
    if (setting !== "system") {
        delete root.dataset.accent;
        root.style.removeProperty("--system-accent");
        return;
    }
    if (systemAccentColor == null) {
        systemAccentColor = getApi().getSystemAccentColor();
    }
    // non-macOS platforms have no accent to follow, so they stay on sage
    if (!systemAccentColor) {
        delete root.dataset.accent;
        root.style.removeProperty("--system-accent");
        return;
    }
    root.dataset.accent = "system";
    root.style.setProperty("--system-accent", systemAccentColor);
}

export function initAccentColor() {
    applyAccentColor();
    if (accentColorInitialized) {
        return;
    }
    accentColorInitialized = true;
    globalStore.sub(atoms.settingsAtom, applyAccentColor);
    getApi().onSystemAccentChange((color) => {
        systemAccentColor = color;
        applyAccentColor();
    });
}
