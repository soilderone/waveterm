// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { formatFileSizeError, formatTokenCount, isAcceptableFile, validateFileSize } from "@/app/aipanel/ai-utils";
import { waveAIHasFocusWithin } from "@/app/aipanel/waveai-focus-utils";
import { type WaveAIModel } from "@/app/aipanel/waveai-model";
import { Tooltip } from "@/element/tooltip";
import { useT } from "@/util/i18n-hooks";
import { cn } from "@/util/util";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AIContextChip, AIMentionPopup, filterMentionEntries, getContextEntries, type ContextEntry } from "./aicontext";
import { AIModeDropdown } from "./aimode";

interface AIPanelInputProps {
    onSubmit: (e: React.FormEvent) => void;
    status: string;
    model: WaveAIModel;
}

export interface AIPanelInputRef {
    focus: () => void;
    resize: () => void;
    scrollToBottom: () => void;
}

const MentionTriggerRegex = /(?:^|\s)@([^\s@]*)$/;

const AIUsageIndicator = memo(({ model }: { model: WaveAIModel }) => {
    const t = useT();
    const usage = useAtomValue(model.chatUsageAtom);
    if (usage == null) {
        return null;
    }
    const contextTokens = usage.contexttokens || usage.inputtokens;
    return (
        <Tooltip
            content={t("ai.usageTooltip", {
                context: formatTokenCount(contextTokens),
                input: formatTokenCount(usage.inputtokens),
                output: formatTokenCount(usage.outputtokens),
            })}
            placement="top"
            divClassName="flex items-center"
        >
            <span className="text-[10px] text-muted tabular-nums cursor-default px-1">
                {t("ai.usageShort", { context: formatTokenCount(contextTokens) })}
            </span>
        </Tooltip>
    );
});

AIUsageIndicator.displayName = "AIUsageIndicator";

export const AIPanelInput = memo(({ onSubmit, status, model }: AIPanelInputProps) => {
    const t = useT();
    const [input, setInput] = useAtom(model.inputAtom);
    const isFocused = useAtomValue(model.isWaveAIFocusedAtom);
    const isChatEmpty = useAtomValue(model.isChatEmptyAtom);
    const editingMessageId = useAtomValue(model.editingMessageIdAtom);
    const tabBlocks = useAtomValue(model.tabBlocksAtom);
    const isPanelOpen = useAtomValue(model.getPanelVisibleAtom());
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const historyIndexRef = useRef(-1);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    const mentionEntries = mentionQuery == null ? [] : filterMentionEntries(getContextEntries(tabBlocks), mentionQuery);
    const isStreaming = status === "streaming" || status === "submitted";
    const canSend = status === "ready" || status === "error";

    let placeholder: string;
    if (editingMessageId) {
        placeholder = t("ai.placeholderEdit");
    } else if (!isChatEmpty) {
        placeholder = t("ai.placeholderContinue");
    } else if (model.inBuilder) {
        placeholder = t("ai.placeholderBuilder");
    } else {
        placeholder = t("ai.placeholderAsk");
    }

    const resizeTextarea = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 7 * 24;
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }, []);

    useEffect(() => {
        const inputRefObject: React.RefObject<AIPanelInputRef> = {
            current: {
                focus: () => {
                    textareaRef.current?.focus();
                },
                resize: resizeTextarea,
                scrollToBottom: () => {
                    const textarea = textareaRef.current;
                    if (textarea) {
                        textarea.scrollTop = textarea.scrollHeight;
                    }
                },
            },
        };
        model.registerInputRef(inputRefObject);
    }, [model, resizeTextarea]);

    const updateMentionQuery = (text: string, caret: number) => {
        if (model.inBuilder) {
            return;
        }
        const match = MentionTriggerRegex.exec(text.slice(0, caret));
        if (match == null) {
            setMentionQuery(null);
            return;
        }
        if (match[1] !== mentionQuery) {
            setMentionIndex(0);
        }
        setMentionQuery(match[1]);
    };

    const selectMention = (entry: ContextEntry) => {
        const textarea = textareaRef.current;
        const caret = textarea?.selectionStart ?? input.length;
        const before = input.slice(0, caret).replace(/@[^\s@]*$/, "");
        setInput(before + input.slice(caret));
        setMentionQuery(null);
        model.attachBlockContext(entry.block);
        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(before.length, before.length);
        });
    };

    // ↑/↓ walk previous prompts only while the box is empty or already showing a recalled prompt,
    // so they keep moving the caret inside a multi-line draft
    const recallHistory = (direction: 1 | -1): boolean => {
        const textarea = textareaRef.current;
        if (textarea == null) {
            return false;
        }
        const isBrowsing = historyIndexRef.current >= 0;
        if (!isBrowsing && (input !== "" || direction === -1)) {
            return false;
        }
        const caret = textarea.selectionStart;
        if (direction === 1 && input.slice(0, caret).includes("\n")) {
            return false;
        }
        if (direction === -1 && input.slice(caret).includes("\n")) {
            return false;
        }
        const history = model.getUserPromptHistory();
        if (history.length === 0) {
            return false;
        }
        const nextIndex = Math.min(historyIndexRef.current + direction, history.length - 1);
        historyIndexRef.current = nextIndex;
        const nextText = nextIndex >= 0 ? history[nextIndex] : "";
        setInput(nextText);
        requestAnimationFrame(() => {
            textarea.setSelectionRange(nextText.length, nextText.length);
        });
        return true;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isComposing = e.nativeEvent?.isComposing || e.keyCode == 229;
        if (isComposing) {
            return;
        }
        const hasModifier = e.shiftKey || e.altKey || e.metaKey || e.ctrlKey;
        if (mentionQuery != null) {
            const count = mentionEntries.length;
            if (e.key === "ArrowDown" && count > 0) {
                e.preventDefault();
                setMentionIndex((idx) => (idx + 1) % count);
                return;
            }
            if (e.key === "ArrowUp" && count > 0) {
                e.preventDefault();
                setMentionIndex((idx) => (idx - 1 + count) % count);
                return;
            }
            if ((e.key === "Enter" || e.key === "Tab") && !hasModifier && count > 0) {
                e.preventDefault();
                selectMention(mentionEntries[Math.min(mentionIndex, count - 1)]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
            }
        }
        if (e.key === "Escape" && editingMessageId) {
            e.preventDefault();
            model.cancelEditMessage();
            return;
        }
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !hasModifier) {
            if (recallHistory(e.key === "ArrowUp" ? 1 : -1)) {
                e.preventDefault();
            }
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            historyIndexRef.current = -1;
            onSubmit(e as any);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        historyIndexRef.current = -1;
        updateMentionQuery(e.target.value, e.target.selectionStart);
    };

    const handleFocus = useCallback(() => {
        model.requestWaveAIFocus();
    }, [model]);

    const handleBlur = useCallback(
        (e: React.FocusEvent) => {
            setMentionQuery(null);
            if (e.relatedTarget === null) {
                return;
            }

            if (waveAIHasFocusWithin(e.relatedTarget)) {
                return;
            }

            model.requestNodeFocus();
        },
        [model]
    );

    useEffect(() => {
        resizeTextarea();
    }, [input, resizeTextarea]);

    useEffect(() => {
        if (isPanelOpen) {
            resizeTextarea();
        }
    }, [isPanelOpen, resizeTextarea]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const acceptableFiles = files.filter(isAcceptableFile);

        for (const file of acceptableFiles) {
            const sizeError = validateFileSize(file);
            if (sizeError) {
                model.setError(formatFileSizeError(sizeError));
                if (e.target) {
                    e.target.value = "";
                }
                return;
            }
            await model.addFile(file);
        }

        if (acceptableFiles.length < files.length) {
            console.warn(`${files.length - acceptableFiles.length} files were rejected due to unsupported file types`);
        }

        if (e.target) {
            e.target.value = "";
        }
    };

    const sendDisabled = !canSend || !input.trim();

    return (
        <div className="px-2 pb-2 pt-1">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.go,.py,.java,.c,.cpp,.h,.hpp,.html,.css,.scss,.sass,.json,.xml,.yaml,.yml,.sh,.bat,.sql"
                onChange={handleFileChange}
                className="hidden"
            />
            <form onSubmit={onSubmit} className="relative">
                {mentionQuery != null && (
                    <AIMentionPopup
                        entries={mentionEntries}
                        activeIndex={mentionIndex}
                        onSelect={selectMention}
                        onHover={setMentionIndex}
                    />
                )}
                <div
                    className={cn(
                        "rounded-lg border bg-raise/50 transition-colors",
                        isFocused ? "border-typeai/50" : "border-border"
                    )}
                >
                    {editingMessageId && (
                        <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-secondary border-b border-border/60">
                            <i className="fa fa-pen text-[10px] text-typeai"></i>
                            <span className="flex-1 min-w-0 truncate">{t("ai.editingMessage")}</span>
                            <button
                                type="button"
                                onClick={() => model.cancelEditMessage()}
                                className="text-secondary hover:text-primary cursor-pointer transition-colors"
                            >
                                {t("ai.cancelEdit")}
                            </button>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onClick={(e) =>
                            updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart)
                        }
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        className="w-full block text-primary px-2.5 pt-2 pb-1 bg-transparent focus:outline-none resize-none overflow-auto"
                        style={{ fontSize: "13px" }}
                        rows={2}
                    />
                    <div className="flex items-center gap-0.5 px-1.5 pb-1.5 min-w-0">
                        <Tooltip content={t("ai.attachFiles")} placement="top" divClassName="flex items-center">
                            <button
                                type="button"
                                onClick={handleUploadClick}
                                className="w-6 h-6 rounded flex items-center justify-center text-secondary hover:text-primary hover:bg-hoverbg transition-colors cursor-pointer"
                            >
                                <i className="fa fa-paperclip text-[12px]"></i>
                            </button>
                        </Tooltip>
                        <AIModeDropdown compatibilityMode={!isChatEmpty} />
                        {!model.inBuilder && <AIContextChip />}
                        <div className="flex-1" />
                        <AIUsageIndicator model={model} />
                        <span className="hidden @xs:inline text-[10px] text-muted whitespace-nowrap px-1">
                            {t("ai.newlineHint")}
                        </span>
                        {isStreaming ? (
                            <Tooltip content={t("ai.stopResponse")} placement="top" divClassName="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => model.stopResponse()}
                                    className="w-7 h-7 rounded-md flex items-center justify-center bg-hoverbg text-primary hover:text-error transition-colors cursor-pointer"
                                >
                                    <i className="fa fa-square text-[10px]"></i>
                                </button>
                            </Tooltip>
                        ) : (
                            <Tooltip content={t("ai.sendMessage")} placement="top" divClassName="flex items-center">
                                <button
                                    type="submit"
                                    disabled={sendDisabled}
                                    className={cn(
                                        "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                                        sendDisabled
                                            ? "text-muted"
                                            : "bg-accent/80 text-onaccent hover:bg-accent cursor-pointer"
                                    )}
                                >
                                    <i className="fa fa-arrow-up text-[12px]"></i>
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
});

AIPanelInput.displayName = "AIPanelInput";
