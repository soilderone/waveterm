// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "vitest";
import { computeWorkspacePanelSizes } from "./workspace-panels";

test("AI visibility preserves navigation width and returns its space to the canvas", () => {
    for (const width of [800, 1440, 2560]) {
        const closed = computeWorkspacePanelSizes(width, 206, 0);
        const open = computeWorkspacePanelSizes(width, 206, 340);
        expect(open.outer).toEqual(closed.outer);
        expect((open.outer[0] / 100) * width).toBeCloseTo(206);
        const remaining = (open.outer[1] / 100) * width;
        expect((open.inner[1] / 100) * remaining).toBeCloseTo(340);
        expect(((closed.inner[0] - open.inner[0]) / 100) * remaining).toBeCloseTo(340);
    }
});

test("resizing navigation does not change the requested AI width", () => {
    for (const navigation of [170, 206, 280]) {
        const { outer, inner } = computeWorkspacePanelSizes(1200, navigation, 360);
        expect((outer[1] / 100) * 1200 * (inner[1] / 100)).toBeCloseTo(360);
        expect(outer[0] + outer[1]).toBeCloseTo(100);
        expect(inner[0] + inner[1]).toBeCloseTo(100);
    }
});

test("transient zero bounds and oversized panels never produce invalid percentages", () => {
    for (const width of [0, 100, 300]) {
        const { outer, inner } = computeWorkspacePanelSizes(width, 280, 400);
        for (const percentage of [...outer, ...inner]) {
            expect(Number.isFinite(percentage)).toBe(true);
            expect(percentage).toBeGreaterThanOrEqual(0);
            expect(percentage).toBeLessThanOrEqual(100);
        }
    }
});
