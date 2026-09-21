// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { waveEventSubscribeSingle } from "@/app/store/wps";
import { atoms, createBlock, globalStore } from "@/store/global";
import { useT } from "@/util/i18n-hooks";
import { fireAndForget } from "@/util/util";
import { atom, PrimitiveAtom, useAtomValue } from "jotai";
import { memo, useEffect, useState } from "react";

class WorkspaceVitalsModel {
    private static instance: WorkspaceVitalsModel;
    sampleAtom = atom<TimeSeriesData>(null) as PrimitiveAtom<TimeSeriesData>;
    cpuHistoryAtom = atom<number[]>([]);
    private constructor() {}
    static getInstance() {
        if (!this.instance) this.instance = new WorkspaceVitalsModel();
        return this.instance;
    }
    subscribe() {
        let staleTimer: ReturnType<typeof setTimeout>;
        const unsubscribe = waveEventSubscribeSingle({
            eventType: "sysinfo",
            scope: "local",
            handler: (event) => {
                const sample = event.data;
                if (!sample?.values || !Number.isFinite(sample.values.cpu)) return;
                const previous = globalStore.get(this.sampleAtom);
                if (previous && sample.ts <= previous.ts) return;
                globalStore.set(this.sampleAtom, sample);
                globalStore.set(this.cpuHistoryAtom, (values) => [...values.slice(-23), Math.max(0, Math.min(100, sample.values.cpu))]);
                clearTimeout(staleTimer);
                staleTimer = setTimeout(() => globalStore.set(this.sampleAtom, null), 5000);
            },
        });
        return () => {
            clearTimeout(staleTimer);
            unsubscribe();
            globalStore.set(this.sampleAtom, null);
            globalStore.set(this.cpuHistoryAtom, []);
        };
    }
}

export const WorkspaceVitals = memo(() => {
    const t = useT();
    const focused = useAtomValue(atoms.documentHasFocus);
    const [visible, setVisible] = useState(() => window.matchMedia("(min-width: 1401px)").matches);
    const model = WorkspaceVitalsModel.getInstance();
    const sample = useAtomValue(model.sampleAtom);
    const history = useAtomValue(model.cpuHistoryAtom);
    useEffect(() => {
        const query = window.matchMedia("(min-width: 1401px)");
        const update = () => setVisible(query.matches);
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    useEffect(() => {
        if (focused && visible) return model.subscribe();
    }, [focused, visible, model]);
    const cpu = sample?.values.cpu;
    const total = sample?.values["mem:total"];
    const used = sample?.values["mem:used"];
    const memory = total > 0 && Number.isFinite(used) ? Math.max(0, Math.min(100, (used / total) * 100)) : null;
    const points = history.map((value, index) => `${index * 3},${17 - value * 0.14}`).join(" ");
    return (
        <button className="shell-vitals" title={t("shell.localMetrics")} aria-label={`${t("shell.localMetrics")}: CPU ${cpu != null ? Math.round(cpu) + "%" : "—"}, ${t("view.mem")} ${memory != null ? Math.round(memory) + "%" : "—"}`} onClick={() => fireAndForget(() => createBlock({ meta: { view: "sysinfo" } }))}>
            <span>CPU</span>
            <svg viewBox="0 0 70 20" width="70" height="20" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            <b>{cpu != null ? `${Math.round(cpu)}%` : "—"}</b>
            <span className="shell-vitals-divider" />
            <span>MEM</span>
            <span className="shell-vitals-meter"><i style={{ width: `${memory ?? 0}%` }} /></span>
            <b>{memory != null ? `${Math.round(memory)}%` : "—"}</b>
        </button>
    );
});
WorkspaceVitals.displayName = "WorkspaceVitals";
