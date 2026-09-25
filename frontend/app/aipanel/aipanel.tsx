// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { handleWaveAIContextMenu } from "@/app/aipanel/aipanel-contextmenu";
import { waveAIHasSelection } from "@/app/aipanel/waveai-focus-utils";
import { useTabBackground } from "@/app/block/blockutil";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { atoms, getSettingsKeyAtom } from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { useTabModelMaybe } from "@/app/store/tab-model";
import { isBuilderWindow } from "@/app/store/windowtype";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { useT } from "@/util/i18n-hooks";
import { checkKeyPressed, keydownWrapper } from "@/util/keyutil";
import { isMacOS, isWindows } from "@/util/platformutil";
import { cn, fireAndForget, makeIconClass } from "@/util/util";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import * as jotai from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { formatFileSizeError, isAcceptableFile, validateFileSize } from "./ai-utils";
import { getContextEntries, type ContextEntry } from "./aicontext";
import { AIDroppedFiles } from "./aidroppedfiles";
import { AIPanelHeader } from "./aipanelheader";
import { AIPanelInput } from "./aipanelinput";
import { AIPanelMessages } from "./aipanelmessages";
import { AIRateLimitStrip } from "./airatelimitstrip";
import { WaveUIMessage } from "./aitypes";
import { BYOKAnnouncement } from "./byokannouncement";
import { TelemetryRequiredMessage } from "./telemetryrequired";
import { WaveAIModel } from "./waveai-model";

const AIBlockMask = memo(() => {
    return (
        <div
            key="block-mask"
            className="absolute top-0 left-0 right-0 bottom-0 border-1 border-transparent pointer-events-auto select-none p-0.5"
            style={{
                borderRadius: "var(--block-border-radius)",
                zIndex: "var(--zindex-block-mask-inner)",
            }}
        >
            <div
                className="w-full mt-[44px] h-[calc(100%-44px)] flex items-center justify-center"
                style={{
                    backgroundColor: "rgb(from var(--block-bg-color) r g b / 50%)",
                }}
            >
                <div className="font-bold opacity-70 mt-[-25%] text-[60px]">0</div>
            </div>
        </div>
    );
});

AIBlockMask.displayName = "AIBlockMask";

const AIDragOverlay = memo(() => {
    const t = useT();
    return (
        <div
            key="drag-overlay"
            className="absolute inset-0 bg-typeai/20 border-2 border-dashed border-typeai rounded-lg flex items-center justify-center z-10 p-4"
        >
            <div className="text-typeai text-center">
                <i className="fa fa-upload text-3xl mb-2"></i>
                <div className="text-lg font-semibold">{t("ai.dropFilesHere")}</div>
                <div className="text-sm">{t("ai.dropFilesSupported")}</div>
            </div>
        </div>
    );
});

AIDragOverlay.displayName = "AIDragOverlay";

const KeyCap = memo(({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
        <kbd
            className={cn(
                "px-1 py-px text-[10px] bg-raise border border-border rounded-sm shadow-sm font-mono",
                className
            )}
        >
            {children}
        </kbd>
    );
});

KeyCap.displayName = "KeyCap";

interface SuggestedPrompt {
    icon: string;
    text: string;
}

function getSuggestedPrompts(
    t: (key: string, params?: Record<string, string | number>) => string,
    accessLevel: string,
    entries: ContextEntry[],
    focusedBlockId: string
): SuggestedPrompt[] {
    if (accessLevel === "off") {
        return [
            { icon: "terminal", text: t("ai.suggestFindLargeFiles") },
            { icon: "lightbulb", text: t("ai.suggestExplainCommand") },
            { icon: "code", text: t("ai.suggestShellScript") },
        ];
    }
    const prompts: SuggestedPrompt[] = [];
    const focused = entries.find((entry) => entry.block.oid === focusedBlockId);
    if (focused?.block.meta?.view === "preview") {
        prompts.push({ icon: "file-lines", text: t("ai.suggestExplainFile", { name: focused.label.label }) });
    }
    if (entries.some((entry) => entry.block.meta?.view === "term")) {
        prompts.push({ icon: "terminal", text: t("ai.suggestExplainLastOutput") });
        prompts.push({ icon: "list-check", text: t("ai.suggestSummarizeTerminal") });
    }
    prompts.push({ icon: "folder-open", text: t("ai.suggestWhatProject") });
    return prompts.slice(0, 3);
}

const AISuggestedPrompts = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const accessLevel = jotai.useAtomValue(model.accessLevelAtom);
    const tabBlocks = jotai.useAtomValue(model.tabBlocksAtom);
    const focusedBlockId = jotai.useAtomValue(model.focusedBlockIdAtom);
    const prompts = getSuggestedPrompts(t, accessLevel, getContextEntries(tabBlocks), focusedBlockId);

    return (
        <div className="mt-5 flex flex-col gap-1.5">
            {prompts.map((prompt) => (
                <button
                    key={prompt.text}
                    onClick={() => fireAndForget(() => model.submitPrompt(prompt.text))}
                    className="flex items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary bg-raise/50 border border-border rounded-lg hover:border-typeai/50 hover:text-primary cursor-pointer transition-colors"
                >
                    <i className={cn(makeIconClass(prompt.icon, false), "w-4 text-center text-[12px] text-typeai")}></i>
                    <span className="flex-1 min-w-0">{prompt.text}</span>
                </button>
            ))}
        </div>
    );
});

AISuggestedPrompts.displayName = "AISuggestedPrompts";

const AIGettingStarted = memo(() => {
    const t = useT();
    const modKey = isMacOS() ? "⌘" : "Alt";

    const handleDismiss = () => {
        fireAndForget(() => RpcApi.SetConfigCommand(TabRpcClient, { "waveai:hidegettingstarted": true }));
    };

    return (
        <div className="mt-5 bg-typeai/5 border border-typeai/20 rounded-lg px-3 py-2.5 text-[12px] relative">
            <button
                onClick={handleDismiss}
                className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-hoverbg cursor-pointer transition-colors"
                title={t("ai.dismiss")}
            >
                <i className="fa fa-xmark text-[11px]"></i>
            </button>
            <div className="text-[11px] font-semibold mb-2 text-typeai">{t("ai.gettingStarted")}</div>
            <div className="space-y-1.5 pr-4">
                <div className="flex items-start gap-2">
                    <i className="fa-solid fa-shield-check text-typeai w-3.5 text-center mt-0.5"></i>
                    <span>{t("ai.tipAccessLevel")}</span>
                </div>
                <div className="flex items-start gap-2">
                    <i className="fa-solid fa-at text-typeai w-3.5 text-center mt-0.5"></i>
                    <span>{t("ai.tipMentions")}</span>
                </div>
                <div className="flex items-start gap-2">
                    <i className="fa-solid fa-keyboard text-typeai w-3.5 text-center mt-0.5"></i>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                            <KeyCap>{modKey}</KeyCap>
                            <KeyCap className="ml-0.5">K</KeyCap>
                            <span className="ml-1">{t("ai.shortcutNewChat")}</span>
                        </span>
                        <span>
                            <KeyCap>{modKey}</KeyCap>
                            <KeyCap className="ml-0.5">Shift</KeyCap>
                            <KeyCap className="ml-0.5">A</KeyCap>
                            <span className="ml-1">{t("ai.shortcutTogglePanel")}</span>
                        </span>
                        <span>
                            {isWindows() ? (
                                <>
                                    <KeyCap>Alt</KeyCap>
                                    <KeyCap className="ml-0.5">0</KeyCap>
                                </>
                            ) : (
                                <>
                                    <KeyCap>Ctrl</KeyCap>
                                    <KeyCap className="ml-0.5">Shift</KeyCap>
                                    <KeyCap className="ml-0.5">0</KeyCap>
                                </>
                            )}
                            <span className="ml-1">{t("ai.shortcutFocus")}</span>
                        </span>
                        <span>
                            <KeyCap>↑</KeyCap>
                            <span className="ml-1">{t("ai.shortcutPrevPrompt")}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

AIGettingStarted.displayName = "AIGettingStarted";

const AIWelcomeMessage = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const aiModeConfigs = jotai.useAtomValue(atoms.waveaiModeConfigAtom);
    const currentMode = jotai.useAtomValue(model.currentAIMode);
    const hideGettingStarted = jotai.useAtomValue(getSettingsKeyAtom("waveai:hidegettingstarted")) ?? false;
    const hasCustomModes = Object.keys(aiModeConfigs).some((key) => !key.startsWith("waveai@"));
    const isCloudMode = currentMode?.startsWith("waveai@") ?? false;
    return (
        <div className="text-secondary py-6 px-1 max-w-md mx-auto">
            <div className="flex flex-col items-center text-center">
                <i className="fa fa-sparkles text-2xl text-typeai mb-2"></i>
                <p className="text-base font-semibold text-primary">{t("ai.welcomeTitle")}</p>
                <p className="text-[12px] text-muted mt-1">{t("ai.welcomeSubtitle")}</p>
            </div>
            <AISuggestedPrompts />
            {!hideGettingStarted && <AIGettingStarted />}
            {!hasCustomModes && <BYOKAnnouncement />}
            {isCloudMode && <div className="mt-4 text-center text-[11px] text-muted">{t("ai.betaNotice")}</div>}
        </div>
    );
});

AIWelcomeMessage.displayName = "AIWelcomeMessage";

const AIBuilderWelcomeMessage = memo(() => {
    const t = useT();
    return (
        <div className="text-secondary py-8">
            <div className="text-center">
                <i className="fa fa-sparkles text-4xl text-typeai mb-4 block"></i>
                <p className="text-lg font-bold text-primary">{t("ai.waveAppBuilder")}</p>
            </div>
            <div className="mt-4 text-left max-w-md mx-auto">
                <p className="text-sm mb-6">{t("ai.builderWelcomeDesc")}</p>
            </div>
        </div>
    );
});

AIBuilderWelcomeMessage.displayName = "AIBuilderWelcomeMessage";

const AIErrorMessage = memo(() => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const errorMessage = jotai.useAtomValue(model.errorMessage);
    const isChatEmpty = jotai.useAtomValue(model.isChatEmptyAtom);

    if (!errorMessage) {
        return null;
    }

    return (
        <div className="px-4 py-2 text-error bg-error/10 border-l-4 border-error/70 mx-2 mb-2 relative">
            <button
                onClick={() => model.clearError()}
                className="absolute top-2 right-2 text-error hover:text-error/80 cursor-pointer z-10"
                aria-label={t("ai.closeError")}
            >
                <i className="fa fa-times text-sm"></i>
            </button>
            <div className="text-sm pr-6 max-h-[100px] overflow-y-auto">
                {errorMessage}
                {!isChatEmpty && (
                    <button
                        onClick={() => fireAndForget(() => model.regenerateLastResponse())}
                        className="ml-2 text-xs text-error hover:text-error/80 cursor-pointer underline"
                    >
                        {t("ai.retry")}
                    </button>
                )}
                <button
                    onClick={() => model.clearChat()}
                    className="ml-2 text-xs text-error hover:text-error/80 cursor-pointer underline"
                >
                    {t("ai.newChat")}
                </button>
            </div>
        </div>
    );
});

AIErrorMessage.displayName = "AIErrorMessage";

const ConfigChangeModeFixer = memo(() => {
    const model = WaveAIModel.getInstance();
    const telemetryEnabled = jotai.useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const aiModeConfigs = jotai.useAtomValue(model.aiModeConfigs);

    useEffect(() => {
        model.fixModeAfterConfigChange();
    }, [telemetryEnabled, aiModeConfigs, model]);

    return null;
});

ConfigChangeModeFixer.displayName = "ConfigChangeModeFixer";

type AIPanelComponentInnerProps = {
    roundTopLeft: boolean;
};

const AIPanelComponentInner = memo(({ roundTopLeft }: AIPanelComponentInnerProps) => {
    const t = useT();
    const [isDragOver, setIsDragOver] = useState(false);
    const [isReactDndDragOver, setIsReactDndDragOver] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const model = WaveAIModel.getInstance();
    const containerRef = useRef<HTMLDivElement>(null);
    const waveEnv = useWaveEnv();
    const isLayoutMode = jotai.useAtomValue(atoms.controlShiftDelayAtom);
    const showOverlayBlockNums = jotai.useAtomValue(getSettingsKeyAtom("app:showoverlayblocknums")) ?? true;
    const isFocused = jotai.useAtomValue(model.isWaveAIFocusedAtom);
    const focusFollowsCursorMode = jotai.useAtomValue(getSettingsKeyAtom("app:focusfollowscursor")) ?? "off";
    const telemetryEnabled = jotai.useAtomValue(getSettingsKeyAtom("telemetry:enabled")) ?? false;
    const isPanelVisible = jotai.useAtomValue(model.getPanelVisibleAtom());
    const tabModel = useTabModelMaybe();
    const [tabBorderColor, tabActiveBorderColor] = useTabBackground(waveEnv, tabModel?.tabId);
    const defaultMode = jotai.useAtomValue(getSettingsKeyAtom("waveai:defaultmode")) ?? "waveai@balanced";
    const aiModeConfigs = jotai.useAtomValue(model.aiModeConfigs);

    const hasCustomModes = Object.keys(aiModeConfigs).some((key) => !key.startsWith("waveai@"));
    const isUsingCustomMode = !defaultMode.startsWith("waveai@");
    const allowAccess = telemetryEnabled || (hasCustomModes && isUsingCustomMode);

    const { messages, sendMessage, status, setMessages, error, stop } = useChat<WaveUIMessage>({
        transport: new DefaultChatTransport({
            api: model.getUseChatEndpointUrl(),
            prepareSendMessagesRequest: (_opts) => {
                const msg = model.getAndClearMessage();
                const body: any = {
                    msg,
                    chatid: globalStore.get(model.chatId),
                    accesslevel: globalStore.get(model.accessLevelAtom),
                    aimode: globalStore.get(model.currentAIMode),
                };
                if (model.getAndClearRegenerate()) {
                    body.regenerate = true;
                }
                if (isBuilderWindow()) {
                    body.builderid = globalStore.get(atoms.builderId);
                    body.builderappid = globalStore.get(atoms.builderAppId);
                } else {
                    body.tabid = tabModel.tabId;
                    body.focusedblockid = globalStore.get(model.focusedBlockIdAtom);
                }
                return { body };
            },
        }),
        onError: (error) => {
            console.error("AI Chat error:", error);
            model.setError(error.message || t("ai.errorOccurred"));
        },
    });

    model.registerUseChatData(sendMessage, setMessages, status, stop, messages);

    // console.log("AICHAT messages", messages);
    (window as any).aichatmessages = messages;
    (window as any).aichatstatus = status;

    const handleKeyDown = (waveEvent: WaveKeyboardEvent): boolean => {
        if (checkKeyPressed(waveEvent, "Cmd:k")) {
            model.clearChat();
            return true;
        }
        return false;
    };

    const prevStatusRef = useRef(status);
    useEffect(() => {
        globalStore.set(model.isAIStreaming, status === "streaming" || status === "submitted");
        const wasBusy = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
        prevStatusRef.current = status;
        if (wasBusy && (status === "ready" || status === "error")) {
            fireAndForget(() => model.refreshChatUsage());
        }
    }, [status]);

    useEffect(() => {
        const keyHandler = keydownWrapper(handleKeyDown);
        document.addEventListener("keydown", keyHandler);
        return () => {
            document.removeEventListener("keydown", keyHandler);
        };
    }, []);

    useEffect(() => {
        const loadChat = async () => {
            await model.uiLoadInitialChat();
            setInitialLoadDone(true);
        };
        loadChat();
    }, [model]);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                globalStore.set(model.containerWidth, containerRef.current.offsetWidth);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [model]);

    useEffect(() => {
        model.ensureRateLimitSet();
    }, [model]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await model.handleSubmit();
        setTimeout(() => {
            model.focusInput();
        }, 100);
    };

    const hasFilesDragged = (dataTransfer: DataTransfer): boolean => {
        // Check if the drag operation contains files by looking at the types
        return dataTransfer.types.includes("Files");
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!allowAccess) {
            return;
        }

        const hasFiles = hasFilesDragged(e.dataTransfer);

        // Only handle native file drags here, let react-dnd handle FILE_ITEM drags
        if (!hasFiles) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Only set drag over to false if we're actually leaving the drop zone
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        if (!allowAccess) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            return;
        }

        // Check if this is a FILE_ITEM drag from react-dnd
        // If so, let react-dnd handle it instead
        if (!e.dataTransfer.files.length) {
            return; // Let react-dnd handle FILE_ITEM drags
        }

        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const acceptableFiles = files.filter(isAcceptableFile);

        for (const file of acceptableFiles) {
            const sizeError = validateFileSize(file);
            if (sizeError) {
                model.setError(formatFileSizeError(sizeError));
                return;
            }
            await model.addFile(file);
        }

        if (acceptableFiles.length < files.length) {
            const rejectedCount = files.length - acceptableFiles.length;
            const rejectedFiles = files.filter((f) => !isAcceptableFile(f));
            const fileNames = rejectedFiles.map((f) => f.name).join(", ");
            const key = rejectedCount > 1 ? "ai.filesRejected" : "ai.fileRejected";
            model.setError(t(key, { count: rejectedCount, names: fileNames }));
        }
    };

    const handleFileItemDrop = useCallback(
        (draggedFile: DraggedFile) => {
            if (!allowAccess) {
                return;
            }
            model.addFileFromRemoteUri(draggedFile);
        },
        [model, allowAccess]
    );

    const [{ isOver, canDrop }, drop] = useDrop(
        () => ({
            accept: "FILE_ITEM",
            drop: handleFileItemDrop,
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
            }),
        }),
        [handleFileItemDrop]
    );

    // Update drag over state for FILE_ITEM drags
    useEffect(() => {
        if (isOver && canDrop) {
            setIsReactDndDragOver(true);
        } else {
            setIsReactDndDragOver(false);
        }
    }, [isOver, canDrop]);

    // Attach the drop ref to the container
    useEffect(() => {
        if (containerRef.current) {
            drop(containerRef.current);
        }
    }, [drop]);

    const handleFocusCapture = useCallback(
        (_event: React.FocusEvent) => {
            // console.log("Wave AI focus capture", getElemAsStr(event.target));
            model.requestWaveAIFocus();
        },
        [model]
    );

    const handlePointerEnter = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (focusFollowsCursorMode !== "on") return;
            if (event.pointerType === "touch" || event.buttons > 0) return;
            if (isFocused) return;
            model.focusInput();
        },
        [focusFollowsCursorMode, isFocused, model]
    );

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button, a, input, textarea, select, [role="button"], [tabindex]');

        if (isInteractive) {
            return;
        }

        const hasSelection = waveAIHasSelection();
        if (hasSelection) {
            model.requestWaveAIFocus();
            return;
        }

        setTimeout(() => {
            if (!waveAIHasSelection()) {
                model.focusInput();
            }
        }, 0);
    };

    const showBlockMask = isLayoutMode && showOverlayBlockNums;
    const borderColor = isFocused ? (tabActiveBorderColor ?? null) : (tabBorderColor ?? null);

    return (
        <div
            ref={containerRef}
            data-waveai-panel="true"
            className={cn(
                "@container bg-surface/70 flex flex-col relative",
                model.inBuilder ? "mt-0 h-full" : "mt-1 h-[calc(100%-4px)]",
                (isDragOver || isReactDndDragOver) && "bg-raise border-typeai",
                isFocused && !borderColor ? "border-2 border-typeai" : "border-2 border-transparent"
            )}
            style={{
                borderTopLeftRadius: roundTopLeft ? 10 : 0,
                borderTopRightRadius: model.inBuilder ? 0 : 10,
                borderBottomRightRadius: model.inBuilder ? 0 : 10,
                borderBottomLeftRadius: 10,
                borderColor: borderColor ?? undefined,
                boxShadow: isFocused && !borderColor ? "0 0 22px -6px var(--type-ai)" : undefined,
            }}
            onFocusCapture={handleFocusCapture}
            onPointerEnter={handlePointerEnter}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            inert={!isPanelVisible ? true : undefined}
            data-aipanel="true"
        >
            <ConfigChangeModeFixer />
            {(isDragOver || isReactDndDragOver) && allowAccess && <AIDragOverlay />}
            {showBlockMask && <AIBlockMask />}
            <AIPanelHeader />
            <AIRateLimitStrip />

            <div key="main-content" className="flex-1 flex flex-col min-h-0">
                {!allowAccess ? (
                    <TelemetryRequiredMessage />
                ) : (
                    <>
                        {messages.length === 0 && initialLoadDone ? (
                            <div
                                className="flex-1 overflow-y-auto p-2 relative"
                                onContextMenu={(e) => handleWaveAIContextMenu(e, true)}
                            >
                                {model.inBuilder ? <AIBuilderWelcomeMessage /> : <AIWelcomeMessage />}
                            </div>
                        ) : (
                            <AIPanelMessages
                                messages={messages}
                                status={status}
                                onContextMenu={(e) => handleWaveAIContextMenu(e, true)}
                            />
                        )}
                        <AIErrorMessage />
                        <AIDroppedFiles model={model} />
                        <AIPanelInput onSubmit={handleSubmit} status={status} model={model} />
                    </>
                )}
            </div>
        </div>
    );
});

AIPanelComponentInner.displayName = "AIPanelInner";

type AIPanelComponentProps = {
    roundTopLeft: boolean;
};

const AIPanelComponent = ({ roundTopLeft }: AIPanelComponentProps) => {
    return (
        <ErrorBoundary>
            <AIPanelComponentInner roundTopLeft={roundTopLeft} />
        </ErrorBoundary>
    );
};

AIPanelComponent.displayName = "AIPanel";

export { AIPanelComponent as AIPanel };
