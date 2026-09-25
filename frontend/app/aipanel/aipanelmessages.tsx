// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const prevStatusRef = useRef<string>(status);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    const checkIfAtBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;

        const threshold = 50;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return scrollBottom <= threshold;
    };

    const handleScroll = () => {
        const atBottom = checkIfAtBottom();
        setShouldAutoScroll(atBottom);
    };

    const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (container) {
            container.scrollTop = container.scrollHeight;
            container.scrollLeft = 0;
            setShouldAutoScroll(true);
        }
    };

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        model.registerScrollToBottom(scrollToBottom);
    }, [model]);

    useEffect(() => {
        if (shouldAutoScroll) {
            scrollToBottom();
        }
    }, [messages, shouldAutoScroll]);

    useEffect(() => {
        if (isPanelOpen) {
            scrollToBottom();
        }
    }, [isPanelOpen]);

    useEffect(() => {
        const wasStreaming = prevStatusRef.current === "streaming";
        const isNowNotStreaming = status !== "streaming";

        if (wasStreaming && isNowNotStreaming) {
            requestAnimationFrame(() => {
                scrollToBottom();
            });
        }

        prevStatusRef.current = status;
    }, [status]);

    const isBusy = status === "streaming" || status === "submitted";

    return (
        <div className="flex-1 min-h-0 relative flex flex-col">
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-2 space-y-4"
                onContextMenu={onContextMenu}
            >
                {messages.map((message, index) => {
                    const isLastMessage = index === messages.length - 1;
                    const isStreaming = status === "streaming" && isLastMessage && message.role === "assistant";
                    return (
                        <AIMessage
                            key={message.id}
                            message={message}
                            isStreaming={isStreaming}
                            isLast={isLastMessage}
                            isChatBusy={isBusy}
                        />
                    );
                })}

                {status === "streaming" &&
                    (messages.length === 0 || messages[messages.length - 1].role !== "assistant") && (
                        <AIMessage
                            key="last-message"
                            message={{ role: "assistant", parts: [], id: "last-message" } as any}
                            isStreaming={true}
                            isLast={true}
                            isChatBusy={true}
                        />
                    )}

                <div ref={messagesEndRef} />
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
