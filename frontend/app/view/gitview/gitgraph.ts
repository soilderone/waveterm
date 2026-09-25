// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export const GraphColorCount = 8;

// the pseudo-commit that stands for uncommitted changes on top of HEAD
export const WorktreeRowHash = "__worktree__";

export type GraphEdge = {
    lane: number;
    color: number;
};

export type GraphRow = {
    col: number;
    color: number;
    width: number;
    through: GraphEdge[];
    incoming: GraphEdge[];
    outgoing: GraphEdge[];
};

export type GraphLayout = {
    rows: GraphRow[];
    maxWidth: number;
};

type GraphCommit = {
    hash: string;
    parents?: string[];
};

// Lays out commits (children before parents, as `git log --topo-order` gives them) onto lanes.
// Each lane holds the hash it is waiting for. Two children of the same parent keep separate lanes
// until the parent row, so a fork is drawn where it happened rather than at the newer child.
// A parent that is not loaded yet keeps its lane open to the bottom of the list.
export function computeGraphLayout(commits: GraphCommit[]): GraphLayout {
    const lanes: string[] = [];
    const laneColors: number[] = [];
    let nextColor = 0;
    const allocLane = (hash: string): number => {
        let idx = lanes.indexOf(null);
        if (idx === -1) {
            idx = lanes.length;
            lanes.push(null);
            laneColors.push(0);
        }
        lanes[idx] = hash;
        laneColors[idx] = nextColor % GraphColorCount;
        nextColor++;
        return idx;
    };

    const rows: GraphRow[] = [];
    let maxWidth = 0;
    for (const commit of commits) {
        let col = lanes.indexOf(commit.hash);
        const isTip = col === -1;
        if (isTip) {
            col = allocLane(commit.hash);
        }
        const color = laneColors[col];
        const through: GraphEdge[] = [];
        const incoming: GraphEdge[] = [];
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] == null) {
                continue;
            }
            if (lanes[i] !== commit.hash) {
                through.push({ lane: i, color: laneColors[i] });
                continue;
            }
            if (!(isTip && i === col)) {
                incoming.push({ lane: i, color: laneColors[i] });
            }
            if (i !== col) {
                lanes[i] = null;
            }
        }

        const outgoing: GraphEdge[] = [];
        const parents = commit.parents ?? [];
        if (parents.length === 0) {
            lanes[col] = null;
        } else {
            lanes[col] = parents[0];
            outgoing.push({ lane: col, color });
            for (let p = 1; p < parents.length; p++) {
                let lane = lanes.indexOf(parents[p]);
                if (lane === -1) {
                    lane = allocLane(parents[p]);
                }
                outgoing.push({ lane, color: laneColors[lane] });
            }
        }
        while (lanes.length > 0 && lanes[lanes.length - 1] == null) {
            lanes.pop();
            laneColors.pop();
        }

        let width = col + 1;
        for (const edge of through) {
            width = Math.max(width, edge.lane + 1);
        }
        for (const edge of incoming) {
            width = Math.max(width, edge.lane + 1);
        }
        for (const edge of outgoing) {
            width = Math.max(width, edge.lane + 1);
        }
        maxWidth = Math.max(maxWidth, width);
        rows.push({ col, color, width, through, incoming, outgoing });
    }
    return { rows, maxWidth };
}
