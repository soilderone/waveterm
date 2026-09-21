// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { FlexDirection, LayoutNode } from "./types";

export type WorkspaceLayoutPreset = "grid" | "columns";

export function makeWorkspaceLayoutPreset(root: LayoutNode, preset: WorkspaceLayoutPreset, primaryBlockId?: string): LayoutNode {
    if (!root) return root;
    const leaves: LayoutNode[] = [];
    const collect = (node: LayoutNode) => {
        if (node.children?.length) {
            node.children.forEach(collect);
        } else if (node.data) {
            leaves.push({ ...node, size: 1, flexDirection: FlexDirection.Column });
        }
    };
    collect(root);
    if (leaves.length < 2) return root;
    const group = (direction: FlexDirection, children: LayoutNode[], size = 1): LayoutNode => ({
        id: crypto.randomUUID(), flexDirection: direction, children, size,
    });
    if (preset === "columns") return group(FlexDirection.Row, leaves);
    const primaryIndex = leaves.findIndex((node) => node.data.blockId === primaryBlockId);
    const [primary] = leaves.splice(Math.max(0, primaryIndex), 1);
    primary.size = 1.34;
    const secondary = leaves.length === 1 ? leaves[0] : group(
        FlexDirection.Column,
        leaves.map((node, index) => ({ ...node, flexDirection: FlexDirection.Row, size: index === 0 ? 1.08 : 1 }))
    );
    return group(FlexDirection.Row, [primary, secondary]);
}
