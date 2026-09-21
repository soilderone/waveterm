// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useWaveEnv, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import {
    ExpandableMenu,
    ExpandableMenuItem,
    ExpandableMenuItemGroup,
    ExpandableMenuItemGroupTitle,
    ExpandableMenuItemLeftElement,
    ExpandableMenuItemRightElement,
} from "@/element/expandablemenu";
import { Popover, PopoverButton, PopoverContent } from "@/element/popover";
import { useT } from "@/util/i18n-hooks";
import { fireAndForget, makeIconClass, useAtomValueSafe } from "@/util/util";
import clsx from "clsx";
import { atom, PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { splitAtom } from "jotai/utils";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { CSSProperties, forwardRef, useCallback, useEffect } from "react";
import WorkspaceSVG from "../asset/workspace.svg";
import { IconButton } from "../element/iconbutton";
import { globalStore } from "@/app/store/jotaiStore";
import { makeORef } from "../store/wos";
import { waveEventSubscribeSingle } from "../store/wps";
import { WorkspaceEditor } from "./workspaceeditor";
import "./workspaceswitcher.scss";

export type WorkspaceSwitcherEnv = WaveEnvSubset<{
    electron: {
        deleteWorkspace: WaveEnv["electron"]["deleteWorkspace"];
        createWorkspace: WaveEnv["electron"]["createWorkspace"];
        switchWorkspace: WaveEnv["electron"]["switchWorkspace"];
    };
    atoms: {
        workspace: WaveEnv["atoms"]["workspace"];
    };
    services: {
        workspace: WaveEnv["services"]["workspace"];
    };
    wos: WaveEnv["wos"];
}>;

type WorkspaceListEntry = {
    windowId: string;
    workspace: Workspace;
};

type WorkspaceList = WorkspaceListEntry[];
const workspaceMapAtom = atom<WorkspaceList>([]);
const workspaceSplitAtom = splitAtom(workspaceMapAtom);
const editingWorkspaceAtom = atom<string>();
const WorkspaceSwitcher = forwardRef<HTMLDivElement>((_, ref) => {
    const env = useWaveEnv<WorkspaceSwitcherEnv>();
    const t = useT();
    const setWorkspaceList = useSetAtom(workspaceMapAtom);
    const activeWorkspace = useAtomValueSafe(env.atoms.workspace);
    const workspaceList = useAtomValue(workspaceSplitAtom);
    const setEditingWorkspace = useSetAtom(editingWorkspaceAtom);

    const updateWorkspaceList = useCallback(async () => {
        const workspaceList = await env.services.workspace.ListWorkspaces();
        if (!workspaceList) {
            return;
        }
        const newList: WorkspaceList = [];
        for (const entry of workspaceList) {
            // This just ensures that the atom exists for easier setting of the object
            globalStore.get(env.wos.getWaveObjectAtom(makeORef("workspace", entry.workspaceid)));
            newList.push({
                windowId: entry.windowid,
                workspace: await env.services.workspace.GetWorkspace(entry.workspaceid),
            });
        }
        setWorkspaceList(newList);
    }, []);

    useEffect(
        () =>
            waveEventSubscribeSingle({
                eventType: "workspace:update",
                handler: () => fireAndForget(updateWorkspaceList),
            }),
        []
    );

    useEffect(() => {
        fireAndForget(updateWorkspaceList);
    }, []);

    const onDeleteWorkspace = useCallback((workspaceId: string) => {
        env.electron.deleteWorkspace(workspaceId);
    }, []);

    const isActiveWorkspaceSaved = !!(activeWorkspace.name && activeWorkspace.icon);

    const workspaceIcon = isActiveWorkspaceSaved ? (
        <i className={makeIconClass(activeWorkspace.icon, false)} style={{ color: activeWorkspace.color }}></i>
    ) : (
        <WorkspaceSVG />
    );

    const saveWorkspace = () => {
        fireAndForget(async () => {
            await env.services.workspace.UpdateWorkspace(activeWorkspace.oid, "", "", "", true);
            await updateWorkspaceList();
            setEditingWorkspace(activeWorkspace.oid);
        });
    };

    return (
        <Popover
            className="workspace-switcher-popover"
            placement="bottom-start"
            onDismiss={() => setEditingWorkspace(null)}
            ref={ref}
        >
            <PopoverButton
                className="workspace-switcher-button grey"
                as="div"
                onClick={() => {
                    fireAndForget(updateWorkspaceList);
                }}
            >
                <span className="workspace-icon">{workspaceIcon}</span>
                <span className="workspace-switcher-name">{activeWorkspace?.name || t("shell.workspace")}</span>
                <i className="fa fa-chevron-down text-[9px]" />
            </PopoverButton>
            <PopoverContent className="workspace-switcher-content">
                <div className="title">
                    {isActiveWorkspaceSaved ? t("chrome.switchWorkspace") : t("chrome.openWorkspace")}
                </div>
                <OverlayScrollbarsComponent className={"scrollable"} options={{ scrollbars: { autoHide: "leave" } }}>
                    <ExpandableMenu noIndent singleOpen>
                        {workspaceList.map((entry, i) => (
                            <WorkspaceSwitcherItem key={i} entryAtom={entry} onDeleteWorkspace={onDeleteWorkspace} />
                        ))}
                    </ExpandableMenu>
                </OverlayScrollbarsComponent>

                <div className="actions">
                    {isActiveWorkspaceSaved ? (
                        <ExpandableMenuItem onClick={() => env.electron.createWorkspace()}>
                            <ExpandableMenuItemLeftElement>
                                <i className="fa-sharp fa-solid fa-plus"></i>
                            </ExpandableMenuItemLeftElement>
                            <div className="content">{t("chrome.createNewWorkspace")}</div>
                        </ExpandableMenuItem>
                    ) : (
                        <ExpandableMenuItem onClick={() => saveWorkspace()}>
                            <ExpandableMenuItemLeftElement>
                                <i className="fa-sharp fa-solid fa-floppy-disk"></i>
                            </ExpandableMenuItemLeftElement>
                            <div className="content">{t("chrome.saveWorkspace")}</div>
                        </ExpandableMenuItem>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
});

export function WorkspaceNavigation() {
    const env = useWaveEnv<WorkspaceSwitcherEnv>();
    const t = useT();
    const entries = useAtomValue(workspaceMapAtom);
    const active = useAtomValue(env.atoms.workspace);
    const workspaces = entries.map((entry) => entry.workspace).filter(Boolean);
    if (active && !workspaces.some((workspace) => workspace.oid === active.oid)) {
        workspaces.unshift(active);
    }
    return (
        <section className="shell-nav-section">
            <div className="shell-section-label">
                <span>{t("shell.workspaces")}</span>
                <button className="shell-icon-button" onClick={() => env.electron.createWorkspace()} title={t("chrome.createNewWorkspace")} aria-label={t("chrome.createNewWorkspace")}>
                    <i className="fa fa-plus" />
                </button>
            </div>
            {workspaces.map((workspace, index) => (
                <button key={workspace.oid} className={clsx("shell-nav-item", workspace.oid === active?.oid && "is-active")} onClick={() => env.electron.switchWorkspace(workspace.oid)} aria-current={workspace.oid === active?.oid ? "page" : undefined}>
                    <span className="shell-workspace-mark">{(workspace.name || "W").slice(0, 1).toUpperCase()}</span>
                    <span className="shell-nav-label">{workspace.name || t("shell.workspace")}</span>
                    <span className="shell-nav-index">{String(index + 1).padStart(2, "0")}</span>
                </button>
            ))}
        </section>
    );
}

const WorkspaceSwitcherItem = ({
    entryAtom,
    onDeleteWorkspace,
}: {
    entryAtom: PrimitiveAtom<WorkspaceListEntry>;
    onDeleteWorkspace: (workspaceId: string) => void;
}) => {
    const env = useWaveEnv<WorkspaceSwitcherEnv>();
    const t = useT();
    const activeWorkspace = useAtomValueSafe(env.atoms.workspace);
    const [workspaceEntry, setWorkspaceEntry] = useAtom(entryAtom);
    const [editingWorkspace, setEditingWorkspace] = useAtom(editingWorkspaceAtom);

    const workspace = workspaceEntry.workspace;
    const isCurrentWorkspace = activeWorkspace.oid === workspace.oid;

    const setWorkspace = useCallback((newWorkspace: Workspace) => {
        setWorkspaceEntry({ ...workspaceEntry, workspace: newWorkspace });
        if (newWorkspace.name != "") {
            fireAndForget(() =>
                env.services.workspace.UpdateWorkspace(
                    workspace.oid,
                    newWorkspace.name,
                    newWorkspace.icon,
                    newWorkspace.color,
                    false
                )
            );
        }
    }, []);

    const isActive = !!workspaceEntry.windowId;
    const editIconDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        className: "edit",
        icon: "pencil",
        title: t("chrome.editWorkspace"),
        click: (e) => {
            e.stopPropagation();
            if (editingWorkspace === workspace.oid) {
                setEditingWorkspace(null);
            } else {
                setEditingWorkspace(workspace.oid);
            }
        },
    };
    const windowIconDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        className: "window",
        noAction: true,
        icon: isCurrentWorkspace ? "check" : "window",
        title: isCurrentWorkspace ? t("chrome.currentWorkspaceHint") : t("chrome.workspaceOpenHint"),
    };

    const isEditing = editingWorkspace === workspace.oid;

    return (
        <ExpandableMenuItemGroup
            key={workspace.oid}
            isOpen={isEditing}
            className={clsx({ "is-current": isCurrentWorkspace })}
        >
            <ExpandableMenuItemGroupTitle
                onClick={() => {
                    env.electron.switchWorkspace(workspace.oid);
                    // Create a fake escape key event to close the popover
                    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                }}
            >
                <div
                    className="menu-group-title-wrapper"
                    style={
                        {
                            "--workspace-color": workspace.color,
                        } as CSSProperties
                    }
                >
                    <ExpandableMenuItemLeftElement>
                        <i
                            className={clsx("left-icon", makeIconClass(workspace.icon, true))}
                            style={{ color: workspace.color }}
                        />
                    </ExpandableMenuItemLeftElement>
                    <div className="label">{workspace.name}</div>
                    <ExpandableMenuItemRightElement>
                        <div className="icons">
                            <IconButton decl={editIconDecl} />
                            {isActive && <IconButton decl={windowIconDecl} />}
                        </div>
                    </ExpandableMenuItemRightElement>
                </div>
            </ExpandableMenuItemGroupTitle>
            <ExpandableMenuItem>
                <WorkspaceEditor
                    title={workspace.name}
                    icon={workspace.icon}
                    color={workspace.color}
                    focusInput={isEditing}
                    onTitleChange={(title) => setWorkspace({ ...workspace, name: title })}
                    onColorChange={(color) => setWorkspace({ ...workspace, color })}
                    onIconChange={(icon) => setWorkspace({ ...workspace, icon })}
                    onDeleteWorkspace={() => onDeleteWorkspace(workspace.oid)}
                />
            </ExpandableMenuItem>
        </ExpandableMenuItemGroup>
    );
};

export { WorkspaceSwitcher };
