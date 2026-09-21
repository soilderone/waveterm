// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export function computeWorkspacePanelSizes(width: number, navigationWidth: number, aiWidth: number) {
    if (width <= 0) return { outer: [0, 100], inner: [100, 0] };
    const navigation = Math.min(Math.max(0, navigationWidth), width);
    const remaining = width - navigation;
    const navigationPct = (navigation / width) * 100;
    const aiPct = remaining > 0 ? (Math.min(Math.max(0, aiWidth), remaining) / remaining) * 100 : 0;
    return { outer: [navigationPct, 100 - navigationPct], inner: [100 - aiPct, aiPct] };
}
