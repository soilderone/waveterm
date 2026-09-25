// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { MetaKeyAtomFnType, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import * as WOS from "@/store/wos";
import { t } from "@/util/i18n";
import { fireAndForget, isBlank, makeConnRoute } from "@/util/util";
import * as jotai from "jotai";
import { computeGraphLayout, GraphLayout, WorktreeRowHash } from "./gitgraph";
import { GitView } from "./gitview";

export type GitViewEnv = WaveEnvSubset<{
    rpc: {
        RemoteGitStatusCommand: WaveEnv["rpc"]["RemoteGitStatusCommand"];
        RemoteGitLogCommand: WaveEnv["rpc"]["RemoteGitLogCommand"];
        RemoteGitCommitCommand: WaveEnv["rpc"]["RemoteGitCommitCommand"];
        RemoteGitDiffCommand: WaveEnv["rpc"]["RemoteGitDiffCommand"];
        SetMetaCommand: WaveEnv["rpc"]["SetMetaCommand"];
    };
    createBlock: WaveEnv["createBlock"];
    showContextMenu: WaveEnv["showContextMenu"];
    getConnStatusAtom: WaveEnv["getConnStatusAtom"];
    getBlockMetaKeyAtom: MetaKeyAtomFnType<"connection" | "file">;
}>;

export type GitTab = "changes" | "history";
export type GitDiffMode = "unstaged" | "staged" | "commit";

export type GitDiffTarget = {
    key: string;
    mode: GitDiffMode;
    file: string;
    origfile?: string;
    status: string;
    hash?: string;
    parent?: string;
};

export type GitDiffState = {
    loading: boolean;
    error?: string;
    data?: GitDiffResponse;
};

export type GitChangeEntry = {
    key: string;
    file: GitStatusFile;
    mode: "unstaged" | "staged";
    status: string;
};

export type GitChangeGroups = {
    conflicts: GitChangeEntry[];
    staged: GitChangeEntry[];
    unstaged: GitChangeEntry[];
    untracked: GitChangeEntry[];
};

const StatusPollMs = 4000;
const LogPageSize = 200;
const LogMaxReload = 1000;
const RpcTimeoutMs = 30000;

// Untracked and conflicted files get VS Code's letters ("U" and "!") rather than git's "??" / "UU",
// since those are what most people read at a glance.
export function groupStatusFiles(files: GitStatusFile[]): GitChangeGroups {
    const groups: GitChangeGroups = { conflicts: [], staged: [], unstaged: [], untracked: [] };
    for (const file of files ?? []) {
        if (file.kind === "unmerged") {
            groups.conflicts.push({ key: "unstaged:" + file.path, file, mode: "unstaged", status: "!" });
            continue;
        }
        if (file.kind === "untracked") {
            groups.untracked.push({ key: "unstaged:" + file.path, file, mode: "unstaged", status: "U" });
            continue;
        }
        if (file.index !== ".") {
            groups.staged.push({ key: "staged:" + file.path, file, mode: "staged", status: file.index });
        }
        if (file.worktree !== ".") {
            groups.unstaged.push({ key: "unstaged:" + file.path, file, mode: "unstaged", status: file.worktree });
        }
    }
    return groups;
}

export function errorMessage(e: any): string {
    return e?.message ?? String(e);
}

export class GitDiffSlot {
    targetAtom = jotai.atom<GitDiffTarget>(null) as jotai.PrimitiveAtom<GitDiffTarget>;
    stateAtom = jotai.atom<GitDiffState>(null) as jotai.PrimitiveAtom<GitDiffState>;
    epoch = 0;
}

export class GitViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    env: GitViewEnv;

    viewIcon = jotai.atom<string>("code-branch");
    viewName = jotai.atom<string>(t("git.viewName"));
    manageConnection = jotai.atom<boolean>(true);
    filterOutNowsh = jotai.atom<boolean>(true);
    noPadding = jotai.atom<boolean>(true);

    tabAtom = jotai.atom<GitTab>("changes") as jotai.PrimitiveAtom<GitTab>;
    editingPathAtom = jotai.atom<boolean>(false) as jotai.PrimitiveAtom<boolean>;
    statusAtom = jotai.atom<GitStatusResponse>(null) as jotai.PrimitiveAtom<GitStatusResponse>;
    statusLoadingAtom = jotai.atom<boolean>(true) as jotai.PrimitiveAtom<boolean>;
    statusErrorAtom = jotai.atom<string>(null) as jotai.PrimitiveAtom<string>;
    commitsAtom = jotai.atom<GitCommit[]>(null) as jotai.PrimitiveAtom<GitCommit[]>;
    logAllAtom = jotai.atom<boolean>(true) as jotai.PrimitiveAtom<boolean>;
    logHasMoreAtom = jotai.atom<boolean>(false) as jotai.PrimitiveAtom<boolean>;
    logLoadingAtom = jotai.atom<boolean>(false) as jotai.PrimitiveAtom<boolean>;
    logErrorAtom = jotai.atom<string>(null) as jotai.PrimitiveAtom<string>;
    selectedCommitAtom = jotai.atom<string>(null) as jotai.PrimitiveAtom<string>;
    commitDetailAtom = jotai.atom<GitCommitDetail>(null) as jotai.PrimitiveAtom<GitCommitDetail>;
    commitDetailLoadingAtom = jotai.atom<boolean>(false) as jotai.PrimitiveAtom<boolean>;
    commitDetailErrorAtom = jotai.atom<string>(null) as jotai.PrimitiveAtom<string>;
    workDiff = new GitDiffSlot();
    commitDiff = new GitDiffSlot();

    connection: jotai.Atom<string>;
    connStatus: jotai.Atom<ConnStatus>;
    repoPath: jotai.Atom<string>;
    repoKey: jotai.Atom<string>;
    changeGroups: jotai.Atom<GitChangeGroups>;
    changeCount: jotai.Atom<number>;
    graphCommits: jotai.Atom<GitCommit[]>;
    graphLayout: jotai.Atom<GraphLayout>;
    viewText: jotai.Atom<HeaderElem[]>;

    disposed = false;
    pollTimer: ReturnType<typeof setTimeout> = null;
    pollRunning = false;
    pollAgain = false;
    statusEpoch = 0;
    logEpoch = 0;
    detailEpoch = 0;
    unsubFns: (() => void)[] = [];

    constructor({ blockId, waveEnv }: ViewModelInitType) {
        this.viewType = "git";
        this.blockId = blockId;
        this.env = waveEnv;

        this.connection = jotai.atom((get) => {
            const connValue = get(this.env.getBlockMetaKeyAtom(blockId, "connection"));
            if (isBlank(connValue)) {
                return "local";
            }
            return connValue;
        });
        this.connStatus = jotai.atom((get) => {
            const connName = get(this.env.getBlockMetaKeyAtom(blockId, "connection"));
            return get(this.env.getConnStatusAtom(connName));
        });
        this.repoPath = jotai.atom((get) => {
            const file = get(this.env.getBlockMetaKeyAtom(blockId, "file"));
            if (isBlank(file)) {
                return "~";
            }
            return file;
        });
        this.repoKey = jotai.atom((get) => get(this.connection) + "\u0000" + get(this.repoPath));
        this.changeGroups = jotai.atom((get) => groupStatusFiles(get(this.statusAtom)?.files));
        this.changeCount = jotai.atom((get) => get(this.statusAtom)?.files?.length ?? 0);
        // uncommitted work is drawn as a pseudo-commit hanging off HEAD, like most git graph tools do
        this.graphCommits = jotai.atom((get) => {
            const commits = get(this.commitsAtom) ?? [];
            const status = get(this.statusAtom);
            if (commits.length === 0 || isBlank(status?.head) || get(this.changeCount) === 0) {
                return commits;
            }
            const worktreeRow: GitCommit = {
                hash: WorktreeRowHash,
                parents: [status.head],
                author: "",
                time: 0,
                subject: "",
            };
            return [worktreeRow, ...commits];
        });
        this.graphLayout = jotai.atom((get) => computeGraphLayout(get(this.graphCommits)));
        this.viewText = jotai.atom((get) => {
            const root = get(this.statusAtom)?.reporoot;
            if (isBlank(root)) {
                return [];
            }
            const parts = root.split(/[\\/]/).filter((part) => part !== "");
            const name = parts.length > 0 ? parts[parts.length - 1] : root;
            const rtn: HeaderElem[] = [{ elemtype: "text", text: name, className: "text-secondary" }];
            return rtn;
        });

        this.unsubFns.push(globalStore.sub(this.repoKey, () => this.resetRepo()));
        this.unsubFns.push(
            globalStore.sub(this.connStatus, () => {
                if (globalStore.get(this.connStatus)?.connected && globalStore.get(this.statusAtom) == null) {
                    this.triggerRefresh();
                }
            })
        );
        this.schedulePoll(0);
    }

    get viewComponent(): ViewComponent {
        return GitView;
    }

    getRpcOpts(): RpcOpts {
        return { route: makeConnRoute(globalStore.get(this.connection)), timeout: RpcTimeoutMs };
    }

    getRepoRoot(): string {
        return globalStore.get(this.statusAtom)?.reporoot;
    }

    schedulePoll(delayMs: number) {
        if (this.disposed) {
            return;
        }
        clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(() => fireAndForget(() => this.pollOnce()), delayMs);
    }

    triggerRefresh() {
        if (this.pollRunning) {
            this.pollAgain = true;
            return;
        }
        this.schedulePoll(0);
    }

    async pollOnce() {
        if (this.disposed) {
            return;
        }
        if (this.pollRunning) {
            this.pollAgain = true;
            return;
        }
        this.pollRunning = true;
        try {
            const connected = globalStore.get(this.connStatus)?.connected;
            if (connected && !document.hidden) {
                await this.refreshStatus();
                if (globalStore.get(this.tabAtom) === "history" && globalStore.get(this.commitsAtom) == null) {
                    await this.loadLog(true);
                }
                await this.refreshWorkingDiff();
            }
        } finally {
            this.pollRunning = false;
            const again = this.pollAgain;
            this.pollAgain = false;
            this.schedulePoll(again ? 0 : StatusPollMs);
        }
    }

    async refreshStatus() {
        const epoch = this.statusEpoch;
        const path = globalStore.get(this.repoPath);
        try {
            const status = await this.env.rpc.RemoteGitStatusCommand(TabRpcClient, { path }, this.getRpcOpts());
            if (this.disposed || epoch !== this.statusEpoch) {
                return;
            }
            const prev = globalStore.get(this.statusAtom);
            globalStore.set(this.statusAtom, status);
            globalStore.set(this.statusErrorAtom, null);
            this.closeStaleWorkDiff();
            const headMoved = prev != null && (prev.head !== status.head || prev.branch !== status.branch);
            if (headMoved && globalStore.get(this.commitsAtom) != null) {
                fireAndForget(() => this.loadLog(true));
            }
        } catch (e) {
            if (this.disposed || epoch !== this.statusEpoch) {
                return;
            }
            globalStore.set(this.statusErrorAtom, errorMessage(e));
        } finally {
            if (epoch === this.statusEpoch) {
                globalStore.set(this.statusLoadingAtom, false);
            }
        }
    }

    async loadLog(reset: boolean) {
        const root = this.getRepoRoot();
        if (isBlank(root)) {
            return;
        }
        const current = globalStore.get(this.commitsAtom) ?? [];
        if (!reset && (globalStore.get(this.logLoadingAtom) || !globalStore.get(this.logHasMoreAtom))) {
            return;
        }
        if (reset) {
            this.logEpoch++;
        }
        const epoch = this.logEpoch;
        const skip = reset ? 0 : current.length;
        const limit = reset ? Math.min(Math.max(current.length, LogPageSize), LogMaxReload) : LogPageSize;
        globalStore.set(this.logLoadingAtom, true);
        try {
            const resp = await this.env.rpc.RemoteGitLogCommand(
                TabRpcClient,
                { path: root, skip, limit, all: globalStore.get(this.logAllAtom) },
                this.getRpcOpts()
            );
            if (this.disposed || epoch !== this.logEpoch) {
                return;
            }
            const commits = resp?.commits ?? [];
            globalStore.set(this.commitsAtom, reset ? commits : [...current, ...commits]);
            globalStore.set(this.logHasMoreAtom, resp?.hasmore ?? false);
            globalStore.set(this.logErrorAtom, null);
        } catch (e) {
            if (this.disposed || epoch !== this.logEpoch) {
                return;
            }
            globalStore.set(this.logErrorAtom, errorMessage(e));
            // the list asks for the next page whenever loading settles, so a failing page would retry forever
            globalStore.set(this.logHasMoreAtom, false);
        } finally {
            if (epoch === this.logEpoch) {
                globalStore.set(this.logLoadingAtom, false);
            }
        }
    }

    loadMoreLog() {
        fireAndForget(() => this.loadLog(false));
    }

    setTab(tab: GitTab) {
        globalStore.set(this.tabAtom, tab);
        if (tab === "history") {
            fireAndForget(() => this.loadLog(true));
        }
    }

    setLogAll(all: boolean) {
        globalStore.set(this.logAllAtom, all);
        globalStore.set(this.commitsAtom, null);
        fireAndForget(() => this.loadLog(true));
    }

    selectCommit(hash: string) {
        if (hash === WorktreeRowHash) {
            this.setTab("changes");
            return;
        }
        if (globalStore.get(this.selectedCommitAtom) === hash) {
            return;
        }
        this.detailEpoch++;
        globalStore.set(this.selectedCommitAtom, hash);
        globalStore.set(this.commitDetailAtom, null);
        globalStore.set(this.commitDetailErrorAtom, null);
        this.closeDiff(this.commitDiff);
        if (hash == null) {
            globalStore.set(this.commitDetailLoadingAtom, false);
            return;
        }
        fireAndForget(() => this.loadCommitDetail(hash));
    }

    async loadCommitDetail(hash: string) {
        const epoch = this.detailEpoch;
        globalStore.set(this.commitDetailLoadingAtom, true);
        try {
            const detail = await this.env.rpc.RemoteGitCommitCommand(
                TabRpcClient,
                { path: this.getRepoRoot(), hash },
                this.getRpcOpts()
            );
            if (this.disposed || epoch !== this.detailEpoch) {
                return;
            }
            globalStore.set(this.commitDetailAtom, detail);
        } catch (e) {
            if (this.disposed || epoch !== this.detailEpoch) {
                return;
            }
            globalStore.set(this.commitDetailErrorAtom, errorMessage(e));
        } finally {
            if (epoch === this.detailEpoch) {
                globalStore.set(this.commitDetailLoadingAtom, false);
            }
        }
    }

    openWorkDiff(entry: GitChangeEntry) {
        this.openDiff(this.workDiff, {
            key: entry.key,
            mode: entry.mode,
            file: entry.file.path,
            origfile: entry.mode === "staged" ? entry.file.origpath : undefined,
            status: entry.status,
        });
    }

    openCommitDiff(detail: GitCommitDetail, file: GitChangedFile) {
        this.openDiff(this.commitDiff, {
            key: detail.hash + ":" + file.path,
            mode: "commit",
            file: file.path,
            origfile: file.origpath,
            status: file.status,
            hash: detail.hash,
            parent: detail.parents?.[0] ?? "",
        });
    }

    openDiff(slot: GitDiffSlot, target: GitDiffTarget) {
        globalStore.set(slot.targetAtom, target);
        globalStore.set(slot.stateAtom, { loading: true });
        fireAndForget(() => this.loadDiff(slot, target, false));
    }

    closeDiff(slot: GitDiffSlot) {
        slot.epoch++;
        globalStore.set(slot.targetAtom, null);
        globalStore.set(slot.stateAtom, null);
    }

    // a quiet load is the background refresh of an open working-tree diff: it only touches the
    // state when the content changed (so the editor keeps its scroll position) and swallows errors
    async loadDiff(slot: GitDiffSlot, target: GitDiffTarget, quiet: boolean) {
        const epoch = ++slot.epoch;
        try {
            const data = await this.env.rpc.RemoteGitDiffCommand(
                TabRpcClient,
                {
                    path: this.getRepoRoot(),
                    file: target.file,
                    origfile: target.origfile,
                    mode: target.mode,
                    hash: target.hash,
                    parent: target.parent,
                },
                this.getRpcOpts()
            );
            if (this.disposed || epoch !== slot.epoch) {
                return;
            }
            const prev = globalStore.get(slot.stateAtom)?.data;
            if (
                quiet &&
                prev != null &&
                prev.original === data.original &&
                prev.modified === data.modified &&
                prev.binary === data.binary &&
                prev.toolarge === data.toolarge
            ) {
                return;
            }
            globalStore.set(slot.stateAtom, { loading: false, data });
        } catch (e) {
            if (quiet || this.disposed || epoch !== slot.epoch) {
                return;
            }
            globalStore.set(slot.stateAtom, { loading: false, error: errorMessage(e) });
        }
    }

    // a file that was reverted, committed, or moved between staged and unstaged no longer has the
    // entry its diff was opened from
    closeStaleWorkDiff() {
        const target = globalStore.get(this.workDiff.targetAtom);
        if (target == null) {
            return;
        }
        const groups = globalStore.get(this.changeGroups);
        const stillListed = Object.values(groups).some((entries) => entries.some((entry) => entry.key === target.key));
        if (!stillListed) {
            this.closeDiff(this.workDiff);
        }
    }

    async refreshWorkingDiff() {
        const target = globalStore.get(this.workDiff.targetAtom);
        if (target == null || globalStore.get(this.tabAtom) !== "changes") {
            return;
        }
        await this.loadDiff(this.workDiff, target, true);
    }

    resetRepo() {
        this.statusEpoch++;
        this.logEpoch++;
        this.detailEpoch++;
        globalStore.set(this.statusAtom, null);
        globalStore.set(this.statusLoadingAtom, true);
        globalStore.set(this.statusErrorAtom, null);
        globalStore.set(this.commitsAtom, null);
        globalStore.set(this.logHasMoreAtom, false);
        globalStore.set(this.logLoadingAtom, false);
        globalStore.set(this.logErrorAtom, null);
        globalStore.set(this.selectedCommitAtom, null);
        globalStore.set(this.commitDetailAtom, null);
        globalStore.set(this.commitDetailLoadingAtom, false);
        globalStore.set(this.commitDetailErrorAtom, null);
        globalStore.set(this.editingPathAtom, false);
        this.closeDiff(this.workDiff);
        this.closeDiff(this.commitDiff);
        this.triggerRefresh();
    }

    refreshAll() {
        this.triggerRefresh();
        if (globalStore.get(this.commitsAtom) != null) {
            fireAndForget(() => this.loadLog(true));
        }
        const commitTarget = globalStore.get(this.commitDiff.targetAtom);
        if (commitTarget != null) {
            fireAndForget(() => this.loadDiff(this.commitDiff, commitTarget, true));
        }
    }

    setEditingPath(editing: boolean) {
        globalStore.set(this.editingPathAtom, editing);
    }

    async setRepoPath(path: string) {
        globalStore.set(this.editingPathAtom, false);
        const trimmed = path?.trim();
        if (isBlank(trimmed) || trimmed === globalStore.get(this.repoPath)) {
            return;
        }
        await this.env.rpc.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", this.blockId),
            meta: { file: trimmed },
        });
    }

    joinRepoPath(relPath: string): string {
        const root = this.getRepoRoot() ?? "";
        if (root.endsWith("/") || root.endsWith("\\")) {
            return root + relPath;
        }
        return root + "/" + relPath;
    }

    openFileInPreview(relPath: string) {
        const connection = globalStore.get(this.env.getBlockMetaKeyAtom(this.blockId, "connection"));
        const blockDef: BlockDef = {
            meta: {
                view: "preview",
                file: this.joinRepoPath(relPath),
                connection,
            },
        };
        fireAndForget(() => this.env.createBlock(blockDef));
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const logAll = globalStore.get(this.logAllAtom);
        return [
            {
                label: t("git.refresh"),
                click: () => this.refreshAll(),
            },
            {
                label: t("git.changeFolder"),
                click: () => this.setEditingPath(true),
            },
            {
                label: t("git.allBranches"),
                type: "checkbox",
                checked: logAll,
                click: () => this.setLogAll(!logAll),
            },
        ];
    }

    dispose() {
        this.disposed = true;
        clearTimeout(this.pollTimer);
        this.pollTimer = null;
        for (const unsub of this.unsubFns) {
            unsub();
        }
        this.unsubFns = [];
    }
}
