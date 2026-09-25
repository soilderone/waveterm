// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { getLanguage } from "@/util/i18n";
import { useT } from "@/util/i18n-hooks";
import { cn, isBlank } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GitDiffPane, splitPath, statusColorClass } from "./gitdiff";
import { GraphColorCount, GraphRow, WorktreeRowHash } from "./gitgraph";
import type { GitChangeEntry, GitChangeGroups, GitTab, GitViewModel } from "./gitview-model";

const RowHeight = 24;
const GraphRowHeight = 26;
const LaneWidth = 14;
const MaxDrawnLanes = 16;
const OverscanRows = 20;
const LoadMoreThresholdRows = 30;
const WideWidth = 640;
const HistoryWideWidth = 720;

const GraphColors = [
    "var(--type-term)",
    "var(--type-web)",
    "var(--type-files)",
    "var(--type-ai)",
    "var(--type-git)",
    "var(--type-sys)",
    "#d67aa4",
    "#a3a86a",
];

function graphColor(idx: number): string {
    return GraphColors[idx % GraphColorCount];
}

const relTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function formatRelativeTime(unixSec: number): string {
    const lang = getLanguage();
    let rtf = relTimeFormatters.get(lang);
    if (rtf == null) {
        rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
        relTimeFormatters.set(lang, rtf);
    }
    const diffSec = unixSec - Date.now() / 1000;
    const absSec = Math.abs(diffSec);
    if (absSec < 60) {
        return rtf.format(Math.round(diffSec), "second");
    }
    if (absSec < 3600) {
        return rtf.format(Math.round(diffSec / 60), "minute");
    }
    if (absSec < 86400) {
        return rtf.format(Math.round(diffSec / 3600), "hour");
    }
    if (absSec < 86400 * 30) {
        return rtf.format(Math.round(diffSec / 86400), "day");
    }
    if (absSec < 86400 * 365) {
        return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
    }
    return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

function formatAbsoluteTime(unixSec: number): string {
    if (!unixSec) {
        return "";
    }
    return new Date(unixSec * 1000).toLocaleString(getLanguage());
}

function abbreviatePath(path: string): string {
    const parts = path.split(/[\\/]/).filter((part) => part !== "");
    if (parts.length <= 3) {
        return path;
    }
    return "…/" + parts.slice(-2).join("/");
}

function IconButton({
    icon,
    title,
    onClick,
    spin,
    active,
}: {
    icon: string;
    title: string;
    onClick: () => void;
    spin?: boolean;
    active?: boolean;
}) {
    return (
        <Tooltip content={title} placement="bottom">
            <button
                className={cn(
                    "shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-hover hover:text-primary transition-colors cursor-pointer",
                    active ? "text-primary" : "text-secondary"
                )}
                onClick={onClick}
            >
                <i className={cn("fa-sharp fa-solid text-[11px]", "fa-" + icon, spin && "fa-spin")} />
            </button>
        </Tooltip>
    );
}

// ---- toolbar ----

const PathEditor = memo(function PathEditor({ model, initialPath }: { model: GitViewModel; initialPath: string }) {
    const t = useT();
    const [value, setValue] = useState(initialPath);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    return (
        <input
            ref={inputRef}
            type="text"
            value={value}
            spellCheck={false}
            placeholder={t("git.repoPathPlaceholder")}
            className="flex-1 min-w-0 h-6 px-2 rounded bg-hover text-xs text-primary placeholder-secondary outline-none font-mono"
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => model.setEditingPath(false)}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    model.setRepoPath(value);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    model.setEditingPath(false);
                }
            }}
        />
    );
});
PathEditor.displayName = "PathEditor";

const BranchInfo = memo(function BranchInfo({ status }: { status: GitStatusResponse }) {
    const t = useT();
    if (status == null || !status.isrepo) {
        return null;
    }
    const detached = isBlank(status.branch);
    const branchLabel = detached
        ? t("git.detachedAt", { hash: status.head?.substring(0, 7) ?? "" })
        : status.branch;
    const syncParts: string[] = [];
    if (status.ahead > 0) {
        syncParts.push(t("git.ahead", { count: status.ahead, upstream: status.upstream }));
    }
    if (status.behind > 0) {
        syncParts.push(t("git.behind", { count: status.behind, upstream: status.upstream }));
    }
    const branchTooltip = isBlank(status.upstream)
        ? branchLabel
        : [t("git.tracking", { upstream: status.upstream }), ...syncParts].join("\n");
    return (
        <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <Tooltip content={<div className="whitespace-pre">{branchTooltip}</div>} placement="bottom">
                <div className="flex items-center gap-1 min-w-0 text-primary">
                    <i className="fa-sharp fa-solid fa-code-branch text-[10px] text-secondary" />
                    <span className={cn("truncate", detached && "italic")}>{branchLabel}</span>
                </div>
            </Tooltip>
            {(status.ahead > 0 || status.behind > 0) && (
                <span className="shrink-0 font-mono text-[11px] text-secondary">
                    {status.ahead > 0 && `↑${status.ahead}`}
                    {status.ahead > 0 && status.behind > 0 && " "}
                    {status.behind > 0 && `↓${status.behind}`}
                </span>
            )}
            {!isBlank(status.state) && (
                <span className="shrink-0 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide text-warning bg-hover">
                    {t("git.state." + status.state)}
                </span>
            )}
        </div>
    );
});
BranchInfo.displayName = "BranchInfo";

const TabButton = memo(function TabButton({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            className={cn(
                "flex items-center gap-1 px-2 h-5 rounded text-xs transition-colors cursor-pointer",
                active ? "bg-panel text-primary shadow-sm" : "text-secondary hover:text-primary"
            )}
            onClick={onClick}
        >
            <span>{label}</span>
            {count > 0 && <span className="text-muted text-[10px] font-mono">{count}</span>}
        </button>
    );
});
TabButton.displayName = "TabButton";

const Toolbar = memo(function Toolbar({ model }: { model: GitViewModel }) {
    const t = useT();
    const tab = useAtomValue(model.tabAtom);
    const status = useAtomValue(model.statusAtom);
    const changeCount = useAtomValue(model.changeCount);
    const repoPath = useAtomValue(model.repoPath);
    const editingPath = useAtomValue(model.editingPathAtom);
    const statusLoading = useAtomValue(model.statusLoadingAtom);
    const logLoading = useAtomValue(model.logLoadingAtom);
    const logAll = useAtomValue(model.logAllAtom);
    const displayPath = status?.reporoot ?? repoPath;
    const isRepo = status?.isrepo ?? false;

    return (
        <div className="shrink-0 flex items-center gap-2 h-8 px-2 border-b border-border bg-panel">
            {isRepo && (
                <div className="shrink-0 flex items-center gap-0.5 p-0.5 rounded-md bg-hover">
                    <TabButton
                        label={t("git.changes")}
                        count={changeCount}
                        active={tab === "changes"}
                        onClick={() => model.setTab("changes")}
                    />
                    <TabButton
                        label={t("git.history")}
                        active={tab === "history"}
                        onClick={() => model.setTab("history")}
                    />
                </div>
            )}
            {editingPath ? (
                <PathEditor model={model} initialPath={displayPath} />
            ) : (
                <>
                    <BranchInfo status={status} />
                    <div className="flex-1 min-w-0" />
                    <Tooltip
                        content={t("git.changeFolderTooltip", { path: displayPath })}
                        placement="bottom"
                        divClassName="min-w-0 flex items-center gap-1 px-1.5 h-6 rounded text-[11px] text-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                        divOnClick={() => model.setEditingPath(true)}
                    >
                        <i className="fa-sharp fa-solid fa-folder text-[10px]" />
                        <span className="truncate font-mono">{abbreviatePath(displayPath)}</span>
                    </Tooltip>
                </>
            )}
            {isRepo && tab === "history" && (
                <IconButton
                    icon="layer-group"
                    title={logAll ? t("git.allBranches") : t("git.currentBranchOnly")}
                    active={logAll}
                    onClick={() => model.setLogAll(!logAll)}
                />
            )}
            <IconButton
                icon="rotate-right"
                title={t("git.refresh")}
                spin={statusLoading || logLoading}
                onClick={() => model.refreshAll()}
            />
        </div>
    );
});
Toolbar.displayName = "Toolbar";

// ---- changes ----

type GroupKey = keyof GitChangeGroups;

const GroupOrder: GroupKey[] = ["conflicts", "staged", "unstaged", "untracked"];

const GroupLabelKeys: Record<GroupKey, string> = {
    conflicts: "git.conflicts",
    staged: "git.staged",
    unstaged: "git.unstaged",
    untracked: "git.untracked",
};

const ChangeRow = memo(function ChangeRow({
    model,
    entry,
    selected,
}: {
    model: GitViewModel;
    entry: GitChangeEntry;
    selected: boolean;
}) {
    const t = useT();
    const { name, dir } = splitPath(entry.file.path);
    const title =
        entry.mode === "staged" && entry.file.origpath
            ? `${entry.file.origpath} → ${entry.file.path}`
            : entry.file.path;
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu: ContextMenuItem[] = [
            { label: t("git.openFile"), click: () => model.openFileInPreview(entry.file.path) },
            { type: "separator" },
            { label: t("git.copyPath"), click: () => navigator.clipboard.writeText(entry.file.path) },
            {
                label: t("git.copyFullPath"),
                click: () => navigator.clipboard.writeText(model.joinRepoPath(entry.file.path)),
            },
        ];
        model.env.showContextMenu(menu, e);
    };
    return (
        <div
            className={cn(
                "flex items-center gap-2 pl-5 pr-2 text-xs cursor-pointer transition-colors",
                selected ? "bg-accentbg" : "hover:bg-hover"
            )}
            style={{ height: RowHeight }}
            title={title}
            onClick={() => model.openWorkDiff(entry)}
            onContextMenu={handleContextMenu}
        >
            <span className={cn("shrink-0 w-3 text-center font-mono font-semibold", statusColorClass(entry.status))}>
                {entry.status}
            </span>
            <span className={cn("shrink-0 max-w-[70%] truncate text-primary", entry.status === "D" && "line-through")}>
                {name}
            </span>
            {dir !== "" && <span className="min-w-0 truncate text-muted text-[11px]">{dir}</span>}
        </div>
    );
});
ChangeRow.displayName = "ChangeRow";

const ChangeList = memo(function ChangeList({ model }: { model: GitViewModel }) {
    const t = useT();
    const groups = useAtomValue(model.changeGroups);
    const status = useAtomValue(model.statusAtom);
    const target = useAtomValue(model.workDiff.targetAtom);
    const [collapsed, setCollapsed] = useState<Set<GroupKey>>(() => new Set());

    const toggleGroup = useCallback((key: GroupKey) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const total = GroupOrder.reduce((sum, key) => sum + groups[key].length, 0);
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-secondary text-xs">
                <i className="fa-sharp fa-solid fa-check text-success" />
                <span>{t("git.noChanges")}</span>
            </div>
        );
    }
    return (
        <div className="w-full h-full overflow-y-auto overflow-x-hidden py-1">
            {GroupOrder.map((key) => {
                const entries = groups[key];
                if (entries.length === 0) {
                    return null;
                }
                const isCollapsed = collapsed.has(key);
                return (
                    <div key={key}>
                        <div
                            className="flex items-center gap-1.5 px-2 h-6 text-[11px] font-semibold uppercase tracking-wide text-secondary cursor-pointer select-none hover:text-primary transition-colors"
                            onClick={() => toggleGroup(key)}
                        >
                            <i
                                className={cn(
                                    "fa-sharp fa-solid fa-chevron-down text-[8px] transition-transform",
                                    isCollapsed && "-rotate-90"
                                )}
                            />
                            <span>{t(GroupLabelKeys[key])}</span>
                            <span className="font-mono font-normal text-muted">{entries.length}</span>
                        </div>
                        {!isCollapsed &&
                            entries.map((entry) => (
                                <ChangeRow
                                    key={entry.key}
                                    model={model}
                                    entry={entry}
                                    selected={target?.key === entry.key}
                                />
                            ))}
                    </div>
                );
            })}
            {status?.truncated && <div className="px-3 py-2 text-[11px] text-warning">{t("git.truncated")}</div>}
        </div>
    );
});
ChangeList.displayName = "ChangeList";

const ChangesPanel = memo(function ChangesPanel({ model, width }: { model: GitViewModel; width: number }) {
    const target = useAtomValue(model.workDiff.targetAtom);
    const wide = width >= WideWidth;
    if (!wide) {
        if (target != null) {
            return <GitDiffPane model={model} slot={model.workDiff} onBack={() => model.closeDiff(model.workDiff)} />;
        }
        return <ChangeList model={model} />;
    }
    return (
        <div className="flex w-full h-full min-h-0">
            <div
                className="shrink-0 h-full border-r border-border"
                style={{ width: Math.max(240, Math.round(width * 0.32)) }}
            >
                <ChangeList model={model} />
            </div>
            <div className="flex-1 min-w-0 h-full">
                <GitDiffPane model={model} slot={model.workDiff} />
            </div>
        </div>
    );
});
ChangesPanel.displayName = "ChangesPanel";

// ---- history ----

function laneX(lane: number): number {
    return lane * LaneWidth + LaneWidth / 2;
}

const GraphCell = memo(function GraphCell({
    row,
    width,
    isWorktree,
    isMerge,
    isHead,
}: {
    row: GraphRow;
    width: number;
    isWorktree: boolean;
    isMerge: boolean;
    isHead: boolean;
}) {
    const h = GraphRowHeight;
    const mid = h / 2;
    const xc = laneX(row.col);
    const drawn = (lane: number) => lane < MaxDrawnLanes;
    const nodeColor = graphColor(row.color);
    return (
        <svg className="shrink-0 block" width={width * LaneWidth} height={h} style={{ overflow: "hidden" }}>
            {row.through.filter((e) => drawn(e.lane)).map((e) => (
                <line
                    key={"t" + e.lane}
                    x1={laneX(e.lane)}
                    y1={0}
                    x2={laneX(e.lane)}
                    y2={h}
                    stroke={graphColor(e.color)}
                    strokeWidth={1.5}
                />
            ))}
            {row.incoming.filter((e) => drawn(e.lane)).map((e) => {
                const x = laneX(e.lane);
                const d =
                    x === xc ? `M ${x} 0 L ${xc} ${mid}` : `M ${x} 0 C ${x} ${mid / 2} ${xc} ${mid / 2} ${xc} ${mid}`;
                return <path key={"i" + e.lane} d={d} fill="none" stroke={graphColor(e.color)} strokeWidth={1.5} />;
            })}
            {row.outgoing.filter((e) => drawn(e.lane)).map((e) => {
                const x = laneX(e.lane);
                const c = mid + (h - mid) / 2;
                const d = x === xc ? `M ${xc} ${mid} L ${x} ${h}` : `M ${xc} ${mid} C ${xc} ${c} ${x} ${c} ${x} ${h}`;
                return (
                    <path
                        key={"o" + e.lane}
                        d={d}
                        fill="none"
                        stroke={graphColor(e.color)}
                        strokeWidth={1.5}
                        strokeDasharray={isWorktree ? "2 2" : undefined}
                    />
                );
            })}
            {drawn(row.col) &&
                (isWorktree ? (
                    <circle
                        cx={xc}
                        cy={mid}
                        r={3.5}
                        fill="var(--block-bg-color)"
                        stroke={nodeColor}
                        strokeWidth={1.5}
                        strokeDasharray="2 1.5"
                    />
                ) : isHead ? (
                    <circle cx={xc} cy={mid} r={4.5} fill="var(--block-bg-color)" stroke={nodeColor} strokeWidth={2} />
                ) : (
                    <circle
                        cx={xc}
                        cy={mid}
                        r={isMerge ? 3 : 3.5}
                        fill={nodeColor}
                        stroke={isMerge ? "var(--block-bg-color)" : "none"}
                        strokeWidth={1}
                    />
                ))}
        </svg>
    );
});
GraphCell.displayName = "GraphCell";

function RefBadge({ gitRef }: { gitRef: GitRef }) {
    let icon = "code-branch";
    let className = "border-accent/50 text-accent";
    if (gitRef.type === "tag") {
        icon = "tag";
        className = "border-warning/50 text-warning";
    } else if (gitRef.type === "remote") {
        icon = "cloud";
        className = "border-border text-secondary";
    } else if (gitRef.type === "head") {
        icon = "location-crosshairs";
        className = "border-error/50 text-error";
    }
    return (
        <span
            className={cn(
                "shrink-0 inline-flex items-center gap-1 max-w-[180px] h-4 px-1 rounded border text-[10px] leading-none",
                className,
                gitRef.head && "font-semibold"
            )}
        >
            <i className={cn("fa-sharp fa-solid text-[8px]", "fa-" + icon)} />
            <span className="truncate">{gitRef.name}</span>
        </span>
    );
}

const CommitRow = memo(function CommitRow({
    model,
    commit,
    row,
    graphWidth,
    headHash,
    selected,
    wide,
    changeCount,
}: {
    model: GitViewModel;
    commit: GitCommit;
    row: GraphRow;
    graphWidth: number;
    headHash: string;
    selected: boolean;
    wide: boolean;
    changeCount: number;
}) {
    const t = useT();
    const isWorktree = commit.hash === WorktreeRowHash;
    const handleContextMenu = (e: React.MouseEvent) => {
        if (isWorktree) {
            return;
        }
        e.preventDefault();
        const menu: ContextMenuItem[] = [
            { label: t("git.copyHash"), click: () => navigator.clipboard.writeText(commit.hash) },
            { label: t("git.copySubject"), click: () => navigator.clipboard.writeText(commit.subject) },
        ];
        model.env.showContextMenu(menu, e);
    };
    return (
        <div
            className={cn(
                "flex items-center gap-2 pr-2 text-xs cursor-pointer transition-colors",
                selected ? "bg-accentbg" : "hover:bg-hover"
            )}
            style={{ height: GraphRowHeight }}
            onClick={() => model.selectCommit(selected ? null : commit.hash)}
            onContextMenu={handleContextMenu}
        >
            <div className="shrink-0 pl-1" style={{ width: graphWidth * LaneWidth + 4 }}>
                <GraphCell
                    row={row}
                    width={graphWidth}
                    isWorktree={isWorktree}
                    isMerge={(commit.parents?.length ?? 0) > 1}
                    isHead={commit.hash === headHash}
                />
            </div>
            <div className="flex items-center gap-1 flex-1 min-w-0">
                {commit.refs?.map((gitRef) => (
                    <RefBadge key={gitRef.type + ":" + gitRef.name} gitRef={gitRef} />
                ))}
                {isWorktree ? (
                    <span className="truncate italic text-secondary">
                        {t("git.uncommittedChanges", { count: changeCount })}
                    </span>
                ) : (
                    <span className="truncate text-primary" title={commit.subject}>
                        {commit.subject}
                    </span>
                )}
            </div>
            {wide && !isWorktree && (
                <>
                    <span className="shrink-0 w-[120px] truncate text-secondary" title={commit.email}>
                        {commit.author}
                    </span>
                    <span
                        className="shrink-0 w-[92px] truncate text-secondary text-right"
                        title={formatAbsoluteTime(commit.time)}
                    >
                        {formatRelativeTime(commit.time)}
                    </span>
                    <span className="shrink-0 w-[56px] font-mono text-[11px] text-muted text-right">
                        {commit.hash.substring(0, 7)}
                    </span>
                </>
            )}
        </div>
    );
});
CommitRow.displayName = "CommitRow";

const CommitList = memo(function CommitList({ model, wide }: { model: GitViewModel; wide: boolean }) {
    const t = useT();
    const commits = useAtomValue(model.graphCommits);
    const layout = useAtomValue(model.graphLayout);
    const selected = useAtomValue(model.selectedCommitAtom);
    const status = useAtomValue(model.statusAtom);
    const changeCount = useAtomValue(model.changeCount);
    const hasMore = useAtomValue(model.logHasMoreAtom);
    const loading = useAtomValue(model.logLoadingAtom);
    const loaded = useAtomValue(model.commitsAtom) != null;
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewHeight, setViewHeight] = useState(0);
    const hasRows = loaded && commits.length > 0;

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el == null) {
            return;
        }
        const ro = new ResizeObserver(() => setViewHeight(el.clientHeight));
        ro.observe(el);
        setViewHeight(el.clientHeight);
        setScrollTop(el.scrollTop);
        return () => ro.disconnect();
    }, [hasRows]);

    const firstVisible = Math.floor(scrollTop / GraphRowHeight);
    const visibleCount = Math.ceil((viewHeight || 600) / GraphRowHeight);
    useEffect(() => {
        if (hasMore && !loading && firstVisible + visibleCount + LoadMoreThresholdRows >= commits.length) {
            model.loadMoreLog();
        }
    }, [firstVisible, visibleCount, commits.length, hasMore, loading]);

    if (!loaded) {
        return (
            <div className="flex items-center justify-center w-full h-full text-secondary text-xs">{t("git.loading")}</div>
        );
    }
    if (commits.length === 0) {
        return (
            <div className="flex items-center justify-center w-full h-full text-secondary text-xs">
                {t("git.noCommits")}
            </div>
        );
    }

    const graphWidth = Math.max(1, Math.min(layout.maxWidth, MaxDrawnLanes));
    const start = Math.max(0, firstVisible - OverscanRows);
    const end = Math.min(commits.length, firstVisible + visibleCount + OverscanRows);
    const rows: React.ReactNode[] = [];
    for (let i = start; i < end; i++) {
        const commit = commits[i];
        rows.push(
            <CommitRow
                key={commit.hash}
                model={model}
                commit={commit}
                row={layout.rows[i]}
                graphWidth={graphWidth}
                headHash={status?.head}
                selected={selected === commit.hash}
                wide={wide}
                changeCount={changeCount}
            />
        );
    }
    return (
        <div
            ref={scrollRef}
            className="w-full h-full overflow-y-auto overflow-x-hidden"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
            <div
                style={{
                    height: commits.length * GraphRowHeight + (hasMore ? GraphRowHeight : 0),
                    position: "relative",
                }}
            >
                <div style={{ position: "absolute", top: start * GraphRowHeight, left: 0, right: 0 }}>{rows}</div>
                {hasMore && (
                    <div
                        className="absolute left-0 right-0 flex items-center justify-center text-[11px] text-muted"
                        style={{ top: commits.length * GraphRowHeight, height: GraphRowHeight }}
                    >
                        {t("git.loadingMore")}
                    </div>
                )}
            </div>
        </div>
    );
});
CommitList.displayName = "CommitList";

const CommitDetailPanel = memo(function CommitDetailPanel({ model }: { model: GitViewModel }) {
    const t = useT();
    const detail = useAtomValue(model.commitDetailAtom);
    const loading = useAtomValue(model.commitDetailLoadingAtom);
    const error = useAtomValue(model.commitDetailErrorAtom);
    const target = useAtomValue(model.commitDiff.targetAtom);

    if (error != null) {
        return <div className="px-3 py-2 text-xs text-error">{error}</div>;
    }
    if (detail == null) {
        return (
            <div className="flex items-center justify-center w-full h-full text-secondary text-xs">
                {loading ? t("git.loading") : ""}
            </div>
        );
    }
    const newlineIdx = detail.message.indexOf("\n");
    const subject = newlineIdx === -1 ? detail.message : detail.message.substring(0, newlineIdx);
    const body = newlineIdx === -1 ? "" : detail.message.substring(newlineIdx + 1).trim();
    const committerDiffers =
        !isBlank(detail.committer) &&
        (detail.committer !== detail.author || detail.committeremail !== detail.authoremail);
    return (
        <div className="w-full h-full overflow-y-auto overflow-x-hidden text-xs">
            <div className="px-3 pt-2 pb-2 border-b border-border">
                <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 text-primary font-semibold break-words select-text">{subject}</div>
                    <Tooltip content={t("git.close")} placement="bottom">
                        <button
                            className="shrink-0 flex items-center justify-center w-5 h-5 -mr-1 rounded text-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            onClick={() => model.selectCommit(null)}
                        >
                            <i className="fa-sharp fa-solid fa-xmark text-[10px]" />
                        </button>
                    </Tooltip>
                </div>
                {body !== "" && (
                    <div className="mt-1.5 text-secondary whitespace-pre-wrap break-words select-text">{body}</div>
                )}
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
                    <span className="text-muted">{t("git.author")}</span>
                    <span className="text-secondary truncate select-text">
                        {detail.author} &lt;{detail.authoremail}&gt; · {formatAbsoluteTime(detail.authortime)}
                    </span>
                    {committerDiffers && (
                        <>
                            <span className="text-muted">{t("git.committer")}</span>
                            <span className="text-secondary truncate select-text">
                                {detail.committer} &lt;{detail.committeremail}&gt; · {formatAbsoluteTime(detail.committime)}
                            </span>
                        </>
                    )}
                    <span className="text-muted">{t("git.commit")}</span>
                    <span
                        className="font-mono text-secondary truncate cursor-pointer hover:text-primary transition-colors"
                        title={t("git.copyHash")}
                        onClick={() => navigator.clipboard.writeText(detail.hash)}
                    >
                        {detail.hash}
                    </span>
                    {(detail.parents?.length ?? 0) > 0 && (
                        <>
                            <span className="text-muted">{t("git.parents")}</span>
                            <span className="flex gap-2 font-mono">
                                {detail.parents.map((parent) => (
                                    <span
                                        key={parent}
                                        className="text-secondary cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => model.selectCommit(parent)}
                                    >
                                        {parent.substring(0, 7)}
                                    </span>
                                ))}
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className="px-3 pt-1.5 pb-1 text-[11px] text-muted">
                {t("git.filesChanged", { count: detail.files?.length ?? 0 })}
            </div>
            {(detail.files ?? []).map((file) => {
                const { name, dir } = splitPath(file.path);
                const key = detail.hash + ":" + file.path;
                return (
                    <div
                        key={key}
                        className={cn(
                            "flex items-center gap-2 px-3 text-xs cursor-pointer transition-colors",
                            target?.key === key ? "bg-accentbg" : "hover:bg-hover"
                        )}
                        style={{ height: RowHeight }}
                        title={file.origpath ? `${file.origpath} → ${file.path}` : file.path}
                        onClick={() => model.openCommitDiff(detail, file)}
                    >
                        <span
                            className={cn(
                                "shrink-0 w-3 text-center font-mono font-semibold",
                                statusColorClass(file.status)
                            )}
                        >
                            {file.status}
                        </span>
                        <span
                            className={cn(
                                "shrink-0 max-w-[70%] truncate text-primary",
                                file.status === "D" && "line-through"
                            )}
                        >
                            {name}
                        </span>
                        {dir !== "" && <span className="min-w-0 truncate text-muted text-[11px]">{dir}</span>}
                    </div>
                );
            })}
            {detail.truncated && <div className="px-3 py-2 text-[11px] text-warning">{t("git.truncated")}</div>}
        </div>
    );
});
CommitDetailPanel.displayName = "CommitDetailPanel";

const HistoryPanel = memo(function HistoryPanel({ model, width }: { model: GitViewModel; width: number }) {
    const selected = useAtomValue(model.selectedCommitAtom);
    const diffTarget = useAtomValue(model.commitDiff.targetAtom);
    const error = useAtomValue(model.logErrorAtom);
    const wide = width >= HistoryWideWidth;
    const closeDiff = () => model.closeDiff(model.commitDiff);

    let bottom: React.ReactNode = null;
    if (selected != null) {
        if (wide) {
            bottom = (
                <div className="flex h-full min-h-0">
                    <div
                        className="shrink-0 h-full border-r border-border"
                        style={{ width: Math.max(260, Math.round(width * 0.34)) }}
                    >
                        <CommitDetailPanel model={model} />
                    </div>
                    <div className="flex-1 min-w-0 h-full">
                        <GitDiffPane model={model} slot={model.commitDiff} />
                    </div>
                </div>
            );
        } else if (diffTarget != null) {
            bottom = <GitDiffPane model={model} slot={model.commitDiff} onBack={closeDiff} />;
        } else {
            bottom = <CommitDetailPanel model={model} />;
        }
    }

    return (
        <div className="flex flex-col w-full h-full min-h-0">
            {error != null && (
                <div className="shrink-0 px-3 py-1.5 text-xs text-error border-b border-border">{error}</div>
            )}
            <div className={cn("min-h-0", bottom == null ? "flex-1" : "basis-[45%] shrink-0")}>
                <CommitList model={model} wide={wide} />
            </div>
            {bottom != null && <div className="flex-1 min-h-0 border-t border-border">{bottom}</div>}
        </div>
    );
});
HistoryPanel.displayName = "HistoryPanel";

// ---- root ----

function CenterMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-3 w-full h-full px-6 text-center text-xs",
                error ? "text-error" : "text-secondary"
            )}
        >
            {children}
        </div>
    );
}

const GitViewBody = memo(function GitViewBody({
    model,
    tab,
    width,
}: {
    model: GitViewModel;
    tab: GitTab;
    width: number;
}) {
    const t = useT();
    const connStatus = useAtomValue(model.connStatus);
    const status = useAtomValue(model.statusAtom);
    const statusError = useAtomValue(model.statusErrorAtom);
    const repoPath = useAtomValue(model.repoPath);

    if (!connStatus?.connected) {
        return <CenterMessage>{t("view.waitingConnection")}</CenterMessage>;
    }
    if (status == null) {
        if (statusError != null) {
            return <CenterMessage error={true}>{statusError}</CenterMessage>;
        }
        return <CenterMessage>{t("git.loading")}</CenterMessage>;
    }
    if (!status.isrepo) {
        return (
            <CenterMessage>
                <i className="fa-sharp fa-solid fa-code-branch text-2xl text-muted" />
                <span>{t("git.notRepo", { path: repoPath })}</span>
                <button
                    className="px-3 py-1 rounded bg-accent/80 text-primary hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => model.setEditingPath(true)}
                >
                    {t("git.changeFolder")}
                </button>
            </CenterMessage>
        );
    }
    return (
        <div className="flex flex-col w-full h-full min-h-0">
            {statusError != null && (
                <div className="shrink-0 px-3 py-1.5 text-xs text-error border-b border-border">{statusError}</div>
            )}
            <div className="flex-1 min-h-0">
                {tab === "changes" ? (
                    <ChangesPanel model={model} width={width} />
                ) : (
                    <HistoryPanel model={model} width={width} />
                )}
            </div>
        </div>
    );
});
GitViewBody.displayName = "GitViewBody";

export const GitView: React.FC<ViewComponentProps<GitViewModel>> = memo(function GitView({ model }) {
    const tab = useAtomValue(model.tabAtom);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (el == null) {
            return;
        }
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });
        ro.observe(el);
        setWidth(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="flex flex-col w-full h-full overflow-hidden">
            <Toolbar model={model} />
            <div className="flex-1 min-h-0">
                <GitViewBody model={model} tab={tab} width={width} />
            </div>
        </div>
    );
});
GitView.displayName = "GitView";
