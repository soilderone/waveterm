// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useT } from "@/util/i18n-hooks";
import { cn, fireAndForget, makeIconClass } from "@/util/util";
import { memo, useState } from "react";
import { WaveAIModel } from "./waveai-model";

const ActionButtonClass = "p-1.5 rounded cursor-pointer transition-colors text-secondary hover:bg-raise hover:text-primary";

const CopyActionButton = memo(({ text }: { text: string }) => {
    const t = useT();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(ActionButtonClass, copied && "text-success hover:text-success")}
            title={t("ai.copyMessage")}
        >
            <i className={makeIconClass(copied ? "solid@check" : "regular@copy", false)} />
        </button>
    );
});

CopyActionButton.displayName = "CopyActionButton";

interface AIAssistantActionsProps {
    messageText: string;
    canRegenerate: boolean;
}

export const AIAssistantActions = memo(({ messageText, canRegenerate }: AIAssistantActionsProps) => {
    const t = useT();
    return (
        <div className="flex items-center gap-0.5 mt-2">
            {messageText?.trim() && <CopyActionButton text={messageText} />}
            {canRegenerate && (
                <button
                    onClick={() => fireAndForget(() => WaveAIModel.getInstance().regenerateLastResponse())}
                    className={ActionButtonClass}
                    title={t("ai.regenerate")}
                >
                    <i className={makeIconClass("rotate-right", false)} />
                </button>
            )}
        </div>
    );
});

AIAssistantActions.displayName = "AIAssistantActions";

interface AIUserActionsProps {
    messageId: string;
    messageText: string;
    canEdit: boolean;
}

export const AIUserActions = memo(({ messageId, messageText, canEdit }: AIUserActionsProps) => {
    const t = useT();
    if (!messageText?.trim()) {
        return null;
    }
    return (
        <div className="flex items-center justify-end gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <CopyActionButton text={messageText} />
            {canEdit && (
                <button
                    onClick={() => WaveAIModel.getInstance().startEditMessage(messageId)}
                    className={ActionButtonClass}
                    title={t("ai.editMessage")}
                >
                    <i className={makeIconClass("pen", false)} />
                </button>
            )}
        </div>
    );
});

AIUserActions.displayName = "AIUserActions";
