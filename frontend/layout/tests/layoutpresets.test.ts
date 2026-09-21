// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "vitest";
import { makeWorkspaceLayoutPreset } from "../lib/layoutpresets";
import { FlexDirection, LayoutNode } from "../lib/types";

function leaf(id: string): LayoutNode {
    return { id, data: { blockId: id }, size: 1, flexDirection: FlexDirection.Column };
}
function ids(node: LayoutNode): string[] {
    return node.children?.flatMap(ids) ?? [node.data.blockId];
}

test("template grid preserves every block and its leaf identity without mutating the saved layout", () => {
    const root: LayoutNode = { id: "root", size: 1, flexDirection: FlexDirection.Row, children: [leaf("files"), leaf("term"), leaf("web"), leaf("extra")] };
    const before = JSON.stringify(root);
    const grid = makeWorkspaceLayoutPreset(root, "grid", "term");
    expect(JSON.stringify(root)).toBe(before);
    expect(grid.children[0].id).toBe("term");
    expect(grid.children[0].size / grid.children[1].size).toBeCloseTo(1.34);
    expect(grid.children[1].flexDirection).toBe(FlexDirection.Column);
    expect(ids(grid).sort()).toEqual(ids(root).sort());
    expect(grid.children[1].children.map((node) => node.id)).toEqual(["files", "web", "extra"]);
});

test("columns flatten an existing grid without recreating terminal leaves", () => {
    const root: LayoutNode = { id: "root", size: 1, flexDirection: FlexDirection.Row, children: [leaf("term"), leaf("files"), leaf("web")] };
    const grid = makeWorkspaceLayoutPreset(root, "grid");
    const columns = makeWorkspaceLayoutPreset(grid, "columns");
    expect(columns.children.map((node) => node.id)).toEqual(["term", "files", "web"]);
    expect(columns.children.every((node) => node.size === 1 && !node.children)).toBe(true);
});

test("empty and single-block layouts remain unchanged", () => {
    const terminal = leaf("term");
    expect(makeWorkspaceLayoutPreset(null, "grid")).toBeNull();
    expect(makeWorkspaceLayoutPreset(terminal, "columns")).toBe(terminal);
});
