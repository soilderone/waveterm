// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AIMessage } from "./aimessage";
import { type WaveUIMessage } from "./aitypes";
import { WaveAIModel } from "./waveai-model";

interface AIPanelMessagesProps {
    messages: WaveUIMessage[];
    status: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const AIPanelMessages = memo(({ messages, status, onContextMenu }: AIPanelMessagesProps) => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const isPanelOpen = useAtomValue(model.getPanelVisibleAtom());
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const autoScrollRef = useRef(true);
    const [focusedIndex, setFocusedIndex] = useState<number>(null);
    const isBusy = status === "streaming" || status === "submitted";
    const showPendingMessage = status === "streaming" && messages[messages.length - 1]?.role !== "assistant";
    const count = messages.length + (showPendingMessage ? 1 : 0);
    const getItemKey = useCallback(
        (index: number) => (index < messages.length ? `message:${messages[index].id}` : "pending-assistant"),
        [messages]
    );
    const rangeExtractor = useCallback(
        (range: Parameters<typeof defaultRangeExtractor>[0]) => {
            const indexes = new Set(defaultRangeExtractor(range));
            // Keep focused controls and the live response mounted when the user reads older messages.
            if (focusedIndex != null && focusedIndex < count) {
                indexes.add(focusedIndex);
            }
            if (isBusy && count > 0) {
                indexes.add(count - 1);
            }
            return [...indexes].sort((a, b) => a - b);
        },
        [focusedIndex, isBusy, count]
    );
    const virtualizer = useVirtualizer({
        count,
        getScrollElement: () => messagesContainerRef.current,
        estimateSize: () => 200,
        getItemKey,
        rangeExtractor,
        overscan: 3,
        gap: 16,
        paddingStart: 8,
        paddingEnd: 8,
        anchorTo: "end",
        followOnAppend: shouldAutoScroll ? "auto" : false,
        scrollEndThreshold: 50,
    });

    const checkIfAtBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;

        const threshold = 50;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return scrollBottom <= threshold;
    };

    const handleScroll = () => {
        const atBottom = checkIfAtBottom();
        autoScrollRef.current = atBottom;
        setShouldAutoScroll(atBottom);
    };

    const scrollToBottom = useCallback(() => {
        autoScrollRef.current = true;
        setShouldAutoScroll(true);
        virtualizer.scrollToEnd();
    }, [virtualizer]);

    useEffect(() => {
        model.registerScrollToBottom(scrollToBottom);
        return () => {
            if (model.scrollToBottomCallback === scrollToBottom) {
                model.registerScrollToBottom(null);
            }
        };
    }, [model, scrollToBottom]);

    useEffect(() => {
        if (!shouldAutoScroll || !isPanelOpen) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            if (autoScrollRef.current) {
                virtualizer.scrollToEnd();
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [messages, status, shouldAutoScroll, isPanelOpen, virtualizer]);

    useEffect(() => {
        if (isPanelOpen) {
            scrollToBottom();
        }
    }, [isPanelOpen, scrollToBottom]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container == null) {
            return;
        }
        let width = container.clientWidth;
        let frame: number = null;
        const observer = new ResizeObserver(() => {
            const nextWidth = container.clientWidth;
            if (nextWidth === width || nextWidth === 0) {
                return;
            }
            width = nextWidth;
            // Off-screen messages also wrap differently after resizing the panel.
            virtualizer.measure();
            cancelAnimationFrame(frame);
            if (autoScrollRef.current) {
                frame = requestAnimationFrame(() => virtualizer.scrollToEnd());
            }
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [virtualizer]);

    return (
        <div className="flex-1 min-h-0 relative flex flex-col">
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-2"
                onContextMenu={onContextMenu}
                onScroll={handleScroll}
            >
                <div className="relative w-full" style={{ height: virtualizer.getTotalSize(), overflowAnchor: "none" }}>
                    {virtualizer.getVirtualItems().map((item) => {
                        const message = messages[item.index];
                        const isLastMessage = item.index === count - 1;
                        return (
                            <div
                                key={item.key}
                                data-index={item.index}
                                ref={virtualizer.measureElement}
                                className="absolute top-0 left-0 w-full"
                                style={{ transform: `translateY(${item.start}px)` }}
                                onFocusCapture={() => setFocusedIndex(item.index)}
                                onBlurCapture={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                                        setFocusedIndex(null);
                                    }
                                }}
                            >
                                <AIMessage
                                    message={message ?? ({ role: "assistant", parts: [], id: "pending-assistant" } as WaveUIMessage)}
                                    isStreaming={
                                        status === "streaming" &&
                                        isLastMessage &&
                                        (message == null || message.role === "assistant")
                                    }
                                    isLast={isLastMessage}
                                    isChatBusy={isBusy}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            {!shouldAutoScroll && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-secondary bg-raise border border-border shadow-md hover:text-primary hover:border-borderstrong cursor-pointer transition-colors"
                >
                    <i className="fa fa-arrow-down text-[10px]"></i>
                    {isBusy ? t("ai.newOutputBelow") : t("ai.scrollToBottom")}
                </button>
            )}
        </div>
    );
});

AIPanelMessages.displayName = "AIPanelMessages";
