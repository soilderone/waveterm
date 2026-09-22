// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { WaveStreamdown } from "@/app/element/streamdown";
import { useT } from "@/util/i18n-hooks";
import { memo, useEffect, useRef, useState } from "react";

interface ChatConfig {
    userPrompt: string;
    toolName: string;
    toolDescription: string;
    markdownResponse: string;
}

const chatConfigKeys = [
    {
        userPrompt: "onboarding.fakechat.prompt1",
        toolName: "read_dir",
        toolDescription: "onboarding.fakechat.readDir",
        markdownResponse: "onboarding.fakechat.response1",
    },
    {
        userPrompt: "onboarding.fakechat.prompt2",
        toolName: "term_get_scrollback",
        toolDescription: "onboarding.fakechat.readTerm",
        markdownResponse: "onboarding.fakechat.response2",
    },
];

const AIThinking = memo(() => {
    const t = useT();
    return (
        <div className="flex items-center gap-2">
            <div className="animate-pulse flex items-center">
                <i className="fa fa-circle text-[10px]"></i>
                <i className="fa fa-circle text-[10px] mx-1"></i>
                <i className="fa fa-circle text-[10px]"></i>
            </div>
            <span className="text-sm text-secondary">{t("onboarding.fakechat.thinking")}</span>
        </div>
    );
});

AIThinking.displayName = "AIThinking";

const FakeToolCall = memo(({ toolName, toolDescription }: { toolName: string; toolDescription: string }) => {
    return (
        <div className="flex items-start gap-1 p-2 rounded bg-raise border border-border text-success">
            <span className="font-bold">✓</span>
            <div className="flex-1">
                <div className="font-semibold">{toolName}</div>
                <div className="text-sm text-secondary">{toolDescription}</div>
            </div>
        </div>
    );
});

FakeToolCall.displayName = "FakeToolCall";

const FakeUserMessage = memo(({ userPrompt }: { userPrompt: string }) => {
    return (
        <div className="flex justify-end">
            <div className="px-2 py-2 rounded-lg bg-raise text-primary max-w-[calc(100%-20px)]">
                <div className="whitespace-pre-wrap break-words">{userPrompt}</div>
            </div>
        </div>
    );
});

FakeUserMessage.displayName = "FakeUserMessage";

const FakeAssistantMessage = memo(({ config, onComplete }: { config: ChatConfig; onComplete?: () => void }) => {
    const [phase, setPhase] = useState<"thinking" | "tool" | "streaming">("thinking");
    const [streamedText, setStreamedText] = useState("");

    useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];
        let streamInterval: NodeJS.Timeout | null = null;

        const runAnimation = () => {
            setPhase("thinking");
            setStreamedText("");

            timeouts.push(
                setTimeout(() => {
                    setPhase("tool");
                }, 2000)
            );

            timeouts.push(
                setTimeout(() => {
                    setPhase("streaming");
                }, 4000)
            );

            timeouts.push(
                setTimeout(() => {
                    let currentIndex = 0;
                    streamInterval = setInterval(() => {
                        if (currentIndex >= config.markdownResponse.length) {
                            if (streamInterval) {
                                clearInterval(streamInterval);
                                streamInterval = null;
                            }
                            if (onComplete) {
                                onComplete();
                            }
                            return;
                        }
                        currentIndex += 10;
                        setStreamedText(config.markdownResponse.slice(0, currentIndex));
                    }, 100);
                }, 4000)
            );
        };

        runAnimation();

        return () => {
            timeouts.forEach(clearTimeout);
            if (streamInterval) {
                clearInterval(streamInterval);
            }
        };
    }, [config.markdownResponse, onComplete]);

    return (
        <div className="flex justify-start">
            <div className="px-2 py-2 rounded-lg">
                {phase === "thinking" && <AIThinking />}
                {phase === "tool" && (
                    <>
                        <div className="mb-2">
                            <FakeToolCall toolName={config.toolName} toolDescription={config.toolDescription} />
                        </div>
                        <AIThinking />
                    </>
                )}
                {phase === "streaming" && (
                    <>
                        <div className="mb-2">
                            <FakeToolCall toolName={config.toolName} toolDescription={config.toolDescription} />
                        </div>
                        <WaveStreamdown text={streamedText} parseIncompleteMarkdown={true} className="text-primary" />
                    </>
                )}
            </div>
        </div>
    );
});

FakeAssistantMessage.displayName = "FakeAssistantMessage";

const FakeAIPanelHeader = memo(() => {
    const t = useT();
    return (
        <div className="py-2 pl-3 pr-1 border-b border-border flex items-center justify-between min-w-0 bg-surface">
            <h2 className="text-primary text-sm font-semibold flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                <i className="fa fa-sparkles text-typeai"></i>
                Wave AI
            </h2>

            <div className="flex items-center flex-shrink-0 whitespace-nowrap">
                <div className="flex items-center text-sm whitespace-nowrap">
                    <span className="text-secondary mr-1 text-[12px]">{t("onboarding.fakechat.context")}</span>
                    <button
                        className="relative inline-flex h-6 w-14 items-center rounded-full transition-colors bg-accent/80 text-onaccent"
                        title={t("onboarding.fakechat.widgetAccessOn")}
                    >
                        <span className="absolute inline-block h-4 w-4 transform rounded-full bg-onaccent transition-transform translate-x-8" />
                        <span className="relative z-10 text-xs text-onaccent transition-all ml-2.5 mr-6 text-left font-bold">
                            {t("onboarding.fakechat.on")}
                        </span>
                    </button>
                </div>

                <button
                    className="text-secondary transition-colors p-1 rounded flex-shrink-0 ml-2 focus:outline-none"
                    title={t("onboarding.fakechat.moreOptions")}
                >
                    <i className="fa fa-ellipsis-vertical"></i>
                </button>
            </div>
        </div>
    );
});

FakeAIPanelHeader.displayName = "FakeAIPanelHeader";

export const FakeChat = memo(() => {
    const t = useT();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [chatIndex, setChatIndex] = useState(1);
    const rawConfig = chatConfigKeys[chatIndex] || chatConfigKeys[0];
    const config: ChatConfig = {
        userPrompt: t(rawConfig.userPrompt),
        toolName: rawConfig.toolName,
        toolDescription: t(rawConfig.toolDescription),
        markdownResponse: t(rawConfig.markdownResponse),
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleComplete = () => {
        setTimeout(() => {
            setChatIndex((prev) => (prev + 1) % chatConfigKeys.length);
        }, 2000);
    };

    return (
        <div className="flex flex-col w-full h-full">
            <FakeAIPanelHeader />
            <div className="flex-1 overflow-hidden">
                <div ref={scrollRef} className="flex flex-col gap-1 p-2 h-full overflow-y-auto bg-surface">
                    <FakeUserMessage userPrompt={config.userPrompt} />
                    <FakeAssistantMessage config={config} onComplete={handleComplete} />
                </div>
            </div>
        </div>
    );
});

FakeChat.displayName = "FakeChat";
