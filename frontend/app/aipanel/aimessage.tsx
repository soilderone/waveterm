// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveStreamdown } from "@/app/element/streamdown";
import { t } from "@/util/i18n";
import { useT } from "@/util/i18n-hooks";
import { cn } from "@/util/util";
import { memo, useEffect, useRef, useState } from "react";
import { getFileIcon } from "./ai-utils";
import { AIAssistantActions, AIUserActions } from "./aimessageactions";
import { AIToolUseGroup } from "./aitooluse";
import { WaveUIMessage, WaveUIMessagePart } from "./aitypes";
import { getMessageText, WaveAIModel } from "./waveai-model";

const AIThinking = memo(
    ({
        message,
        reasoningText,
        isWaitingApproval = false,
    }: {
        message?: string;
        reasoningText?: string;
        isWaitingApproval?: boolean;
    }) => {
        const t = useT();
        const scrollRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (scrollRef.current && reasoningText) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, [reasoningText]);

        const displayText = reasoningText
            ? (() => {
                  const lastDoubleNewline = reasoningText.lastIndexOf("\n\n");
                  return lastDoubleNewline !== -1 ? reasoningText.substring(lastDoubleNewline + 2) : reasoningText;
              })()
            : "";
        const displayMessage = message ?? t("ai.aiThinking");

        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    {isWaitingApproval ? (
                        <i className="fa fa-clock text-base text-warning"></i>
                    ) : (
                        <div className="animate-pulse flex items-center">
                            <i className="fa fa-circle text-[10px]"></i>
                            <i className="fa fa-circle text-[10px] mx-1"></i>
                            <i className="fa fa-circle text-[10px]"></i>
                        </div>
                    )}
                    {displayMessage && <span className="text-sm text-secondary">{displayMessage}</span>}
                </div>
                <div ref={scrollRef} className="text-sm text-muted overflow-y-auto h-[3lh] max-w-[600px] pl-9">
                    {displayText}
                </div>
            </div>
        );
    }
);

AIThinking.displayName = "AIThinking";

const AIReasoningBlock = memo(({ text }: { text: string }) => {
    const t = useT();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="text-[12px]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-muted hover:text-secondary cursor-pointer transition-colors"
            >
                <i className={cn("fa fa-chevron-right text-[9px] transition-transform", isOpen && "rotate-90")}></i>
                <i className="fa fa-brain text-[10px]"></i>
                <span>{t("ai.reasoning")}</span>
            </button>
            {isOpen && (
                <div className="mt-1 ml-1 pl-3 border-l-2 border-border text-muted whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                    {text}
                </div>
            )}
        </div>
    );
});

AIReasoningBlock.displayName = "AIReasoningBlock";

interface UserMessageFilesProps {
    fileParts: Array<WaveUIMessagePart & { type: "data-userfile" }>;
}

const UserMessageFiles = memo(({ fileParts }: UserMessageFilesProps) => {
    const t = useT();
    if (fileParts.length === 0) return null;

    return (
        <div className="mt-2 pt-2 border-t border-border">
            <div className="flex gap-2 overflow-x-auto pb-1">
                {fileParts.map((file, index) => (
                    <div key={index} className="relative bg-raise rounded-lg p-2 min-w-20 flex-shrink-0">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 mb-1 flex items-center justify-center bg-hoverbg rounded overflow-hidden">
                                {file.data?.previewurl ? (
                                    <img
                                        src={file.data.previewurl}
                                        alt={file.data?.filename || t("ai.file")}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <i
                                        className={cn(
                                            "fa text-lg text-secondary",
                                            getFileIcon(file.data?.filename || "", file.data?.mimetype || "")
                                        )}
                                    ></i>
                                )}
                            </div>
                            <div
                                className="text-[10px] text-primary truncate w-full max-w-16"
                                title={file.data?.filename || t("ai.file")}
                            >
                                {file.data?.filename || t("ai.file")}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

UserMessageFiles.displayName = "UserMessageFiles";

interface AIMessagePartProps {
    part: WaveUIMessagePart;
    role: string;
    isStreaming: boolean;
}

const AIMessagePart = memo(({ part, role, isStreaming }: AIMessagePartProps) => {
    const model = WaveAIModel.getInstance();

    if (part.type === "reasoning") {
        return <AIReasoningBlock text={part.text ?? ""} />;
    }

    if (part.type === "text") {
        const content = part.text ?? "";

        if (role === "user") {
            return <div className="whitespace-pre-wrap break-words">{content}</div>;
        } else {
            return (
                <WaveStreamdown
                    text={content}
                    parseIncompleteMarkdown={isStreaming}
                    className="text-primary"
                    codeBlockMaxWidthAtom={model.codeBlockMaxWidth}
                    onClickExecute={model.inBuilder ? undefined : model.handleInsertIntoTerminal}
                />
            );
        }
    }

    return null;
});

AIMessagePart.displayName = "AIMessagePart";

interface AIMessageProps {
    message: WaveUIMessage;
    isStreaming: boolean;
    isLast: boolean;
    isChatBusy: boolean;
}

const isDisplayPart = (part: WaveUIMessagePart): boolean => {
    return (
        part.type === "text" ||
        part.type === "data-tooluse" ||
        part.type === "data-toolprogress" ||
        (part.type.startsWith("tool-") && "state" in part && part.state === "input-available")
    );
};

type MessagePart =
    | { type: "single"; part: WaveUIMessagePart }
    | { type: "toolgroup"; parts: Array<WaveUIMessagePart & { type: "data-tooluse" | "data-toolprogress" }> };

const groupMessageParts = (parts: WaveUIMessagePart[]): MessagePart[] => {
    const grouped: MessagePart[] = [];
    let currentToolGroup: Array<WaveUIMessagePart & { type: "data-tooluse" | "data-toolprogress" }> = [];

    for (const part of parts) {
        if (part.type === "data-tooluse" || part.type === "data-toolprogress") {
            currentToolGroup.push(part as WaveUIMessagePart & { type: "data-tooluse" | "data-toolprogress" });
        } else {
            if (currentToolGroup.length > 0) {
                grouped.push({ type: "toolgroup", parts: currentToolGroup });
                currentToolGroup = [];
            }
            grouped.push({ type: "single", part });
        }
    }

    if (currentToolGroup.length > 0) {
        grouped.push({ type: "toolgroup", parts: currentToolGroup });
    }

    return grouped;
};

const getThinkingMessage = (
    parts: WaveUIMessagePart[],
    isStreaming: boolean,
    role: string
): { message: string; reasoningText?: string; isWaitingApproval?: boolean } | null => {
    if (!isStreaming || role !== "assistant") {
        return null;
    }

    const hasPendingApprovals = parts.some(
        (part) => part.type === "data-tooluse" && part.data?.approval === "needs-approval"
    );

    if (hasPendingApprovals) {
        return { message: t("ai.waitingApprovals"), isWaitingApproval: true };
    }

    const lastPart = parts[parts.length - 1];

    if (lastPart?.type === "reasoning") {
        const reasoningContent = lastPart.text || "";
        return { message: t("ai.aiThinking"), reasoningText: reasoningContent };
    }

    if (lastPart?.type === "text" && lastPart.text) {
        return null;
    }

    return { message: "" };
};

export const AIMessage = memo(({ message, isStreaming, isLast, isChatBusy }: AIMessageProps) => {
    const t = useT();
    const parts = message.parts || [];
    const lastPart = parts[parts.length - 1];
    // while it is still streaming, the last reasoning part is shown live by AIThinking instead
    const displayParts = parts.filter(
        (part) =>
            isDisplayPart(part) || (part.type === "reasoning" && !!part.text && !(isStreaming && part === lastPart))
    );
    const fileParts = parts.filter(
        (part): part is WaveUIMessagePart & { type: "data-userfile" } => part.type === "data-userfile"
    );

    const thinkingData = getThinkingMessage(parts, isStreaming, message.role);
    const groupedParts = groupMessageParts(displayParts);

    const isUser = message.role === "user";

    return (
        <div className={cn("flex", isUser ? "flex-col items-end group" : "justify-start")}>
            <div
                className={cn(
                    "px-2 rounded-lg [&>*:first-child]:!mt-0",
                    message.role === "user"
                        ? "py-2 bg-raise/60 text-primary max-w-[calc(100%-50px)]"
                        : "min-w-[min(100%,500px)]"
                )}
            >
                {displayParts.length === 0 && !isStreaming && !thinkingData ? (
                    <div className="whitespace-pre-wrap break-words">{t("ai.noTextContent")}</div>
                ) : (
                    <>
                        {groupedParts.map((group, index: number) =>
                            group.type === "toolgroup" ? (
                                <AIToolUseGroup key={index} parts={group.parts} isStreaming={isStreaming} />
                            ) : (
                                <div key={index} className="mt-2">
                                    <AIMessagePart part={group.part} role={message.role} isStreaming={isStreaming} />
                                </div>
                            )
                        )}
                        {thinkingData != null && (
                            <div className="mt-2">
                                <AIThinking
                                    message={thinkingData.message}
                                    reasoningText={thinkingData.reasoningText}
                                    isWaitingApproval={thinkingData.isWaitingApproval}
                                />
                            </div>
                        )}
                    </>
                )}

                {isUser && <UserMessageFiles fileParts={fileParts} />}
                {message.role === "assistant" && !isStreaming && displayParts.length > 0 && (
                    <AIAssistantActions
                        messageText={getMessageText(message)}
                        canRegenerate={isLast && !isChatBusy}
                    />
                )}
            </div>
            {isUser && (
                <AIUserActions messageId={message.id} messageText={getMessageText(message)} canEdit={!isChatBusy} />
            )}
        </div>
    );
});

AIMessage.displayName = "AIMessage";
