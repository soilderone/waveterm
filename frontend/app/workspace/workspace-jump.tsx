// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToIcon, blockViewToName } from "@/app/block/blockutil";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { atoms, createBlock, globalStore, refocusNode, WOS } from "@/store/global";
import { useT } from "@/util/i18n-hooks";
import { fireAndForget, makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { shouldIncludeWidgetForWorkspace } from "./widgetfilter";

export const WorkspaceJump = memo(() => {
    const t = useT();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const resultId = useId();
    const tabId = useAtomValue(atoms.staticTabId);
    const workspaceId = useAtomValue(atoms.workspaceId);
    const [tab] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId));
    const config = useAtomValue(atoms.fullConfigAtom);
    const items = useMemo(() => {
        if (!open) return [];
        const blocks = (tab?.blockids ?? []).map((id) => {
            const block = WOS.getObjectValue<Block>(WOS.makeORef("block", id), globalStore.get);
            const view = block?.meta?.view;
            return {
                key: id,
                label: block?.meta?.["frame:title"] || blockViewToName(view),
                icon: blockViewToIcon(view),
                blockId: id,
                widget: null as WidgetConfigType,
            };
        });
        const widgets = Object.entries(config?.widgets ?? {})
            .filter(([, widget]) => !widget["display:hidden"] && shouldIncludeWidgetForWorkspace(widget, workspaceId))
            .sort(([, a], [, b]) => (a["display:order"] ?? 0) - (b["display:order"] ?? 0))
            .map(([key, widget]) => ({
                key,
                label: widget.label || key,
                icon: widget.icon,
                blockId: null as string,
                widget,
            }));
        return [...blocks, ...widgets]
            .filter((item) => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
            .slice(0, 12);
    }, [open, query, tab?.blockids, config?.widgets, workspaceId]);
    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, [open]);
    const activate = (index: number) => {
        const item = items[index];
        if (!item) return;
        setOpen(false);
        setQuery("");
        if (item.widget) {
            fireAndForget(() => createBlock(item.widget.blockdef, item.widget.magnified));
        } else {
            const layout = getLayoutModelForStaticTab();
            const node = layout?.getNodeByBlockId(item.blockId);
            const magnified = layout && globalStore.get(layout.magnifiedNodeIdAtom);
            if (magnified && node && magnified !== node.id) {
                layout.magnifyNodeToggle(node.id);
            }
            refocusNode(item.blockId);
        }
    };
    const activeIndex = Math.min(selected, items.length - 1);
    return (
        <div
            className="shell-jump"
            ref={ref}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
            }}
        >
            <i className="fa fa-magnifying-glass" aria-hidden="true" />
            <input
                role="combobox"
                aria-label={t("shell.jump")}
                aria-expanded={open}
                aria-controls={resultId}
                aria-autocomplete="list"
                aria-activedescendant={open && activeIndex >= 0 ? `${resultId}-${activeIndex}` : undefined}
                placeholder={t("shell.jump")}
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setSelected(0);
                    setOpen(true);
                }}
                onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setOpen(true);
                        setSelected(
                            Math.max(0, Math.min(items.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1)))
                        );
                    } else if (event.key === "Enter" && open) {
                        event.preventDefault();
                        activate(activeIndex);
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                    }
                }}
            />
            {open && (
                <div className="shell-jump-results" role="listbox" id={resultId} aria-label={t("shell.jump")}>
                    {items.map((item, index) => (
                        <div
                            key={item.key}
                            id={`${resultId}-${index}`}
                            role="option"
                            aria-selected={index === activeIndex}
                            className={index === activeIndex ? "is-active" : ""}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setSelected(index)}
                            onClick={() => activate(index)}
                        >
                            <i className={makeIconClass(item.icon, true)} />
                            <span>{item.label}</span>
                            <small>{t(item.widget ? "shell.newBlock" : "shell.blocks")}</small>
                        </div>
                    ))}
                    {items.length === 0 && <div className="shell-jump-empty">{t("shell.noResults")}</div>}
                </div>
            )}
        </div>
    );
});
WorkspaceJump.displayName = "WorkspaceJump";
