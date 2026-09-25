// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    UseChatSendMessageType,
    UseChatSetMessagesType,
    WaveUIMessage,
    WaveUIMessagePart,
} from "@/app/aipanel/aitypes";
import { FocusManager } from "@/app/store/focusManager";
import {
    atoms,
    createBlock,
    getBlockComponentModel,
    getOrefMetaKeyAtom,
    getSettingsKeyAtom,
} from "@/app/store/global";
import { globalStore } from "@/app/store/jotaiStore";
import { isBuilderWindow } from "@/app/store/windowtype";
import * as WOS from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { TermViewModel } from "@/app/view/term/term-model";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { BuilderFocusManager } from "@/builder/store/builder-focusmanager";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { getWebServerEndpoint } from "@/util/endpoints";
import { t } from "@/util/i18n";
import { base64ToArrayBuffer, fireAndForget } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { ChatStatus } from "ai";
import * as jotai from "jotai";
import type React from "react";
import {
    createDataUrl,
    createImagePreview,
    formatFileSizeError,
    isAcceptableFile,
    normalizeAccessLevel,
    normalizeMimeType,
    resizeImage,
    stripShellPrompts,
    validateFileSizeFromInfo,
    type WaveAIAccessLevel,
} from "./ai-utils";
import type { AIPanelInputRef } from "./aipanelinput";

export interface DroppedFile {
    id: string;
    file: File;
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
}

export interface WaveAIChatUsage {
    inputtokens: number;
    outputtokens: number;
    contexttokens: number;
}

export interface FailedCommandInfo {
    cmd: string;
    exitCode: number;
    output: string;
}

const FailedCommandOutputMaxChars = 8000;

export function getMessageText(message: WaveUIMessage): string {
    return (message?.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => (part as { text?: string }).text ?? "")
        .join("\n\n")
        .trim();
}

const BuilderAIModeConfigs: Record<string, AIModeConfigType> = {
    "waveaibuilder@default": {
        "display:name": "Builder Default",
        "display:order": -2,
        "display:icon": "sparkles",
        "display:description": "Good mix of speed and accuracy\n(gpt-5.4 with minimal thinking)",
        "ai:provider": "wave",
        "ai:switchcompat": ["wavecloud"],
        "waveai:premium": true,
    },
    "waveaibuilder@deep": {
        "display:name": "Builder Deep",
        "display:order": -1,
        "display:icon": "lightbulb",
        "display:description": "Slower but most capable\n(gpt-5.4 with full reasoning)",
        "ai:provider": "wave",
        "ai:switchcompat": ["wavecloud"],
        "waveai:premium": true,
    },
};

export class WaveAIModel {
    private static instance: WaveAIModel | null = null;
    inputRef: React.RefObject<AIPanelInputRef> | null = null;
    scrollToBottomCallback: (() => void) | null = null;
    useChatSendMessage: UseChatSendMessageType | null = null;
    useChatSetMessages: UseChatSetMessagesType | null = null;
    useChatStatus: ChatStatus = "ready";
    useChatStop: (() => void) | null = null;
    useChatMessages: WaveUIMessage[] = [];
    // Used for injecting Wave-specific message data into DefaultChatTransport's prepareSendMessagesRequest
    realMessage: AIMessage | null = null;
    regenerateNext: boolean = false;
    // stable identity: WaveStreamdown rebuilds its markdown components (and re-highlights code) when this changes
    handleInsertIntoTerminal = (code: string) => {
        this.insertIntoTerminal(code);
    };
    orefContext: ORef;
    inBuilder: boolean = false;
    isAIStreaming = jotai.atom(false);

    accessLevelAtom!: jotai.Atom<WaveAIAccessLevel>;
    widgetAccessAtom!: jotai.Atom<boolean>;
    tabBlocksAtom!: jotai.Atom<Block[]>;
    focusedBlockIdAtom!: jotai.Atom<string>;
    editingMessageIdAtom: jotai.PrimitiveAtom<string> = jotai.atom(null) as jotai.PrimitiveAtom<string>;
    chatUsageAtom: jotai.PrimitiveAtom<WaveAIChatUsage> = jotai.atom(null) as jotai.PrimitiveAtom<WaveAIChatUsage>;
    droppedFiles: jotai.PrimitiveAtom<DroppedFile[]> = jotai.atom([]);
    chatId!: jotai.PrimitiveAtom<string>;
    currentAIMode!: jotai.PrimitiveAtom<string>;
    aiModeConfigs!: jotai.Atom<Record<string, AIModeConfigType>>;
    hasPremiumAtom!: jotai.Atom<boolean>;
    defaultModeAtom!: jotai.Atom<string>;
    errorMessage: jotai.PrimitiveAtom<string> = jotai.atom(null) as jotai.PrimitiveAtom<string>;
    containerWidth: jotai.PrimitiveAtom<number> = jotai.atom(0);
    codeBlockMaxWidth!: jotai.Atom<number>;
    inputAtom: jotai.PrimitiveAtom<string> = jotai.atom("");
    isLoadingChatAtom: jotai.PrimitiveAtom<boolean> = jotai.atom(false);
    isChatEmptyAtom: jotai.PrimitiveAtom<boolean> = jotai.atom(true);
    isWaveAIFocusedAtom!: jotai.Atom<boolean>;
    panelVisibleAtom!: jotai.Atom<boolean>;
    restoreBackupModalToolCallId: jotai.PrimitiveAtom<string | null> = jotai.atom(null) as jotai.PrimitiveAtom<
        string | null
    >;
    restoreBackupStatus: jotai.PrimitiveAtom<"idle" | "processing" | "success" | "error"> = jotai.atom("idle");
    restoreBackupError: jotai.PrimitiveAtom<string> = jotai.atom(null) as jotai.PrimitiveAtom<string>;

    private constructor(orefContext: ORef, inBuilder: boolean) {
        this.orefContext = orefContext;
        this.inBuilder = inBuilder;
        this.chatId = jotai.atom(null) as jotai.PrimitiveAtom<string>;
        if (inBuilder) {
            this.aiModeConfigs = jotai.atom(BuilderAIModeConfigs) as jotai.Atom<Record<string, AIModeConfigType>>;
        } else {
            this.aiModeConfigs = atoms.waveaiModeConfigAtom;
        }

        this.hasPremiumAtom = jotai.atom((get) => {
            const rateLimitInfo = get(atoms.waveAIRateLimitInfoAtom);
            return !rateLimitInfo || rateLimitInfo.unknown || rateLimitInfo.preq > 0;
        });

        this.accessLevelAtom = jotai.atom((get) => {
            if (this.inBuilder) {
                return "collab" as WaveAIAccessLevel;
            }
            const tabLevel = get(getOrefMetaKeyAtom(this.orefContext, "waveai:accesslevel"));
            const defaultLevel = get(getSettingsKeyAtom("waveai:defaultaccesslevel"));
            return normalizeAccessLevel(tabLevel ?? defaultLevel);
        });

        this.widgetAccessAtom = jotai.atom((get) => get(this.accessLevelAtom) !== "off");

        this.tabBlocksAtom = jotai.atom((get) => {
            if (this.inBuilder) {
                return [];
            }
            const tab = get(WOS.getWaveObjectAtom<Tab>(this.orefContext));
            const blocks: Block[] = [];
            for (const blockId of tab?.blockids ?? []) {
                const block = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId)));
                if (block != null) {
                    blocks.push(block);
                }
            }
            return blocks;
        });

        this.focusedBlockIdAtom = jotai.atom((get) => {
            if (this.inBuilder) {
                return null;
            }
            const layoutModel = getLayoutModelForStaticTab();
            if (layoutModel == null) {
                return null;
            }
            return get(layoutModel.focusedNode)?.data?.blockId ?? null;
        });

        this.codeBlockMaxWidth = jotai.atom((get) => {
            const width = get(this.containerWidth);
            return width > 0 ? width - 35 : 0;
        });

        this.isWaveAIFocusedAtom = jotai.atom((get) => {
            if (this.inBuilder) {
                return get(BuilderFocusManager.getInstance().focusType) === "waveai";
            }
            return get(FocusManager.getInstance().focusType) === "waveai";
        });

        this.panelVisibleAtom = jotai.atom((get) => {
            if (this.inBuilder) {
                return true;
            }
            return get(WorkspaceLayoutModel.getInstance().panelVisibleAtom);
        });

        this.defaultModeAtom = jotai.atom((get) => {
            const telemetryEnabled = get(getSettingsKeyAtom("telemetry:enabled")) ?? false;
            if (this.inBuilder) {
                return telemetryEnabled ? "waveaibuilder@default" : "invalid";
            }
            const aiModeConfigs = get(this.aiModeConfigs);
            if (!telemetryEnabled) {
                let mode = get(getSettingsKeyAtom("waveai:defaultmode"));
                if (mode == null || mode.startsWith("waveai@")) {
                    return "unknown";
                }
                return mode;
            }
            const hasPremium = get(this.hasPremiumAtom);
            const waveFallback = hasPremium ? "waveai@balanced" : "waveai@quick";
            let mode = get(getSettingsKeyAtom("waveai:defaultmode")) ?? waveFallback;
            if (!hasPremium && mode.startsWith("waveai@")) {
                mode = "waveai@quick";
            }
            const modeExists = aiModeConfigs != null && mode in aiModeConfigs;
            if (!modeExists) {
                mode = waveFallback;
            }
            return mode;
        });

        const defaultMode = globalStore.get(this.defaultModeAtom);
        this.currentAIMode = jotai.atom(defaultMode);
    }

    getPanelVisibleAtom(): jotai.Atom<boolean> {
        return this.panelVisibleAtom;
    }

    static getInstance(): WaveAIModel {
        if (!WaveAIModel.instance) {
            let orefContext: ORef;
            if (isBuilderWindow()) {
                const builderId = globalStore.get(atoms.builderId);
                orefContext = WOS.makeORef("builder", builderId);
            } else {
                const tabId = globalStore.get(atoms.staticTabId);
                orefContext = WOS.makeORef("tab", tabId);
            }
            WaveAIModel.instance = new WaveAIModel(orefContext, isBuilderWindow());
            (window as any).WaveAIModel = WaveAIModel.instance;
        }
        return WaveAIModel.instance;
    }

    static resetInstance(): void {
        WaveAIModel.instance = null;
    }

    getUseChatEndpointUrl(): string {
        return `${getWebServerEndpoint()}/api/post-chat-message`;
    }

    async addFile(file: File): Promise<DroppedFile> {
        // Resize images before storing
        const processedFile = await resizeImage(file);

        const droppedFile: DroppedFile = {
            id: crypto.randomUUID(),
            file: processedFile,
            name: processedFile.name,
            type: processedFile.type,
            size: processedFile.size,
        };

        // Create 128x128 preview data URL for images
        if (processedFile.type.startsWith("image/")) {
            const previewDataUrl = await createImagePreview(processedFile);
            if (previewDataUrl) {
                droppedFile.previewUrl = previewDataUrl;
            }
        }

        const currentFiles = globalStore.get(this.droppedFiles);
        globalStore.set(this.droppedFiles, [...currentFiles, droppedFile]);

        return droppedFile;
    }

    async addFileFromRemoteUri(draggedFile: DraggedFile): Promise<void> {
        if (draggedFile.isDir) {
            this.setError(t("ai.cannotAddDirs"));
            return;
        }

        try {
            const fileInfo = await RpcApi.FileInfoCommand(TabRpcClient, { info: { path: draggedFile.uri } }, null);
            if (fileInfo.notfound) {
                this.setError(t("ai.fileNotFound", { name: draggedFile.relName }));
                return;
            }
            if (fileInfo.isdir) {
                this.setError(t("ai.cannotAddDirs"));
                return;
            }

            const mimeType = fileInfo.mimetype || "application/octet-stream";
            const fileSize = fileInfo.size || 0;
            const sizeError = validateFileSizeFromInfo(draggedFile.relName, fileSize, mimeType);
            if (sizeError) {
                this.setError(formatFileSizeError(sizeError));
                return;
            }

            const fileData = await RpcApi.FileReadCommand(TabRpcClient, { info: { path: draggedFile.uri } }, null);
            if (!fileData.data64) {
                this.setError(t("ai.failedReadFile", { name: draggedFile.relName }));
                return;
            }

            const buffer = base64ToArrayBuffer(fileData.data64);
            const file = new File([buffer], draggedFile.relName, { type: mimeType });
            if (!isAcceptableFile(file)) {
                this.setError(t("ai.fileTypeNotSupported", { name: draggedFile.relName }));
                return;
            }

            await this.addFile(file);
        } catch (error) {
            console.error("Error handling FILE_ITEM drop:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.setError(t("ai.failedAddFile", { error: errorMsg }));
        }
    }

    removeFile(fileId: string) {
        const currentFiles = globalStore.get(this.droppedFiles);
        const updatedFiles = currentFiles.filter((f) => f.id !== fileId);
        globalStore.set(this.droppedFiles, updatedFiles);
    }

    clearFiles() {
        const currentFiles = globalStore.get(this.droppedFiles);

        // Cleanup all preview URLs
        currentFiles.forEach((file) => {
            if (file.previewUrl) {
                URL.revokeObjectURL(file.previewUrl);
            }
        });

        globalStore.set(this.droppedFiles, []);
    }

    clearChat() {
        this.useChatStop?.();
        this.clearFiles();
        this.clearError();
        globalStore.set(this.editingMessageIdAtom, null);
        globalStore.set(this.chatUsageAtom, null);
        globalStore.set(this.isChatEmptyAtom, true);
        const newChatId = crypto.randomUUID();
        globalStore.set(this.chatId, newChatId);

        RpcApi.SetRTInfoCommand(TabRpcClient, {
            oref: this.orefContext,
            data: { "waveai:chatid": newChatId },
        });

        this.useChatSetMessages?.([]);
    }

    setError(message: string) {
        globalStore.set(this.errorMessage, message);
    }

    clearError() {
        globalStore.set(this.errorMessage, null);
    }

    registerInputRef(ref: React.RefObject<AIPanelInputRef>) {
        this.inputRef = ref;
    }

    registerScrollToBottom(callback: () => void) {
        this.scrollToBottomCallback = callback;
    }

    registerUseChatData(
        sendMessage: UseChatSendMessageType,
        setMessages: UseChatSetMessagesType,
        status: ChatStatus,
        stop: () => void,
        messages: WaveUIMessage[]
    ) {
        this.useChatSendMessage = sendMessage;
        this.useChatSetMessages = setMessages;
        this.useChatStatus = status;
        this.useChatStop = stop;
        this.useChatMessages = messages;
    }

    scrollToBottom() {
        this.scrollToBottomCallback?.();
    }

    focusInput() {
        if (!this.inBuilder && !WorkspaceLayoutModel.getInstance().getAIPanelVisible()) {
            WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
        }
        if (this.inputRef?.current) {
            this.inputRef.current.focus();
        }
    }

    async reloadChatFromBackend(chatIdValue: string): Promise<WaveUIMessage[]> {
        const chatData = await RpcApi.GetWaveAIChatCommand(TabRpcClient, { chatid: chatIdValue });
        const messages: UIMessage[] = chatData?.messages ?? [];
        globalStore.set(this.isChatEmptyAtom, messages.length === 0);
        this.setChatUsage(chatData);
        return messages as WaveUIMessage[];
    }

    setChatUsage(chatData: UIChat) {
        const usage = chatData?.usage;
        if (usage == null || (!usage.inputtokens && !usage.outputtokens)) {
            globalStore.set(this.chatUsageAtom, null);
            return;
        }
        globalStore.set(this.chatUsageAtom, {
            inputtokens: usage.inputtokens ?? 0,
            outputtokens: usage.outputtokens ?? 0,
            contexttokens: chatData.contexttokens ?? 0,
        });
    }

    async refreshChatUsage() {
        const chatIdValue = globalStore.get(this.chatId);
        if (!chatIdValue) {
            return;
        }
        try {
            const chatData = await RpcApi.GetWaveAIChatCommand(TabRpcClient, { chatid: chatIdValue });
            if (globalStore.get(this.chatId) !== chatIdValue) {
                return;
            }
            this.setChatUsage(chatData);
        } catch (error) {
            console.error("Failed to refresh chat usage:", error);
        }
    }

    async stopResponse() {
        this.useChatStop?.();
        await new Promise((resolve) => setTimeout(resolve, 500));

        const chatIdValue = globalStore.get(this.chatId);
        if (!chatIdValue) {
            return;
        }
        try {
            const messages = await this.reloadChatFromBackend(chatIdValue);
            this.useChatSetMessages?.(messages);
        } catch (error) {
            console.error("Failed to reload chat after stop:", error);
        }
    }

    getAndClearMessage(): AIMessage | null {
        const msg = this.realMessage;
        this.realMessage = null;
        return msg;
    }

    getAndClearRegenerate(): boolean {
        const regenerate = this.regenerateNext;
        this.regenerateNext = false;
        return regenerate;
    }

    isBusy(): boolean {
        return (
            this.useChatStatus === "streaming" ||
            this.useChatStatus === "submitted" ||
            globalStore.get(this.isLoadingChatAtom)
        );
    }

    hasNonEmptyInput(): boolean {
        const input = globalStore.get(this.inputAtom);
        return input != null && input.trim().length > 0;
    }

    appendText(text: string, newLine?: boolean, opts?: { scrollToBottom?: boolean }) {
        const currentInput = globalStore.get(this.inputAtom);
        let newInput = currentInput;

        if (newInput.length > 0) {
            if (newLine) {
                if (!newInput.endsWith("\n")) {
                    newInput += "\n";
                }
            } else if (!newInput.endsWith(" ") && !newInput.endsWith("\n")) {
                newInput += " ";
            }
        }

        newInput += text;
        globalStore.set(this.inputAtom, newInput);

        if (opts?.scrollToBottom && this.inputRef?.current) {
            setTimeout(() => this.inputRef.current.scrollToBottom(), 10);
        }
    }

    setModel(model: string) {
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: this.orefContext,
            meta: { "waveai:model": model },
        });
    }

    setAccessLevel(level: WaveAIAccessLevel) {
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: this.orefContext,
            meta: { "waveai:accesslevel": level },
        });
    }

    isValidMode(mode: string): boolean {
        const telemetryEnabled = globalStore.get(getSettingsKeyAtom("telemetry:enabled")) ?? false;
        if (mode.startsWith("waveai@") && !telemetryEnabled) {
            return false;
        }

        const aiModeConfigs = globalStore.get(this.aiModeConfigs);
        if (aiModeConfigs == null || !(mode in aiModeConfigs)) {
            return false;
        }

        return true;
    }

    setAIMode(mode: string) {
        if (!this.isValidMode(mode)) {
            this.setAIModeToDefault();
        } else {
            globalStore.set(this.currentAIMode, mode);
            RpcApi.SetRTInfoCommand(TabRpcClient, {
                oref: this.orefContext,
                data: { "waveai:mode": mode },
            });
        }
    }

    setAIModeToDefault() {
        const defaultMode = globalStore.get(this.defaultModeAtom);
        globalStore.set(this.currentAIMode, defaultMode);
        RpcApi.SetRTInfoCommand(TabRpcClient, {
            oref: this.orefContext,
            data: { "waveai:mode": null },
        });
    }

    async fixModeAfterConfigChange(): Promise<void> {
        const rtInfo = await RpcApi.GetRTInfoCommand(TabRpcClient, {
            oref: this.orefContext,
        });
        const mode = rtInfo?.["waveai:mode"];
        if (mode == null || !this.isValidMode(mode)) {
            this.setAIModeToDefault();
        }
    }

    async getRTInfo(): Promise<Record<string, any>> {
        const rtInfo = await RpcApi.GetRTInfoCommand(TabRpcClient, {
            oref: this.orefContext,
        });
        return rtInfo ?? {};
    }

    async loadInitialChat(): Promise<WaveUIMessage[]> {
        const rtInfo = await RpcApi.GetRTInfoCommand(TabRpcClient, {
            oref: this.orefContext,
        });
        let chatIdValue = rtInfo?.["waveai:chatid"];
        if (chatIdValue == null) {
            chatIdValue = crypto.randomUUID();
            RpcApi.SetRTInfoCommand(TabRpcClient, {
                oref: this.orefContext,
                data: { "waveai:chatid": chatIdValue },
            });
        }
        globalStore.set(this.chatId, chatIdValue);

        const aiModeValue = rtInfo?.["waveai:mode"];
        if (aiModeValue == null) {
            const defaultMode = globalStore.get(this.defaultModeAtom);
            globalStore.set(this.currentAIMode, defaultMode);
        } else if (this.isValidMode(aiModeValue)) {
            globalStore.set(this.currentAIMode, aiModeValue);
        } else {
            this.setAIModeToDefault();
        }

        try {
            return await this.reloadChatFromBackend(chatIdValue);
        } catch (error) {
            console.error("Failed to load chat:", error);
            this.setError(t("ai.failedLoadChat"));

            this.clearChat();
            return [];
        }
    }

    async handleSubmit() {
        const input = globalStore.get(this.inputAtom);
        const droppedFiles = globalStore.get(this.droppedFiles);

        if (input.trim() === "/clear" || input.trim() === "/new") {
            this.clearChat();
            globalStore.set(this.inputAtom, "");
            return;
        }

        if (
            (!input.trim() && droppedFiles.length === 0) ||
            (this.useChatStatus !== "ready" && this.useChatStatus !== "error") ||
            globalStore.get(this.isLoadingChatAtom)
        ) {
            return;
        }

        this.clearError();

        const editingMessageId = globalStore.get(this.editingMessageIdAtom);
        if (editingMessageId) {
            await this.truncateBeforeMessage(editingMessageId);
        }

        const aiMessageParts: AIMessagePart[] = [];
        const uiMessageParts: WaveUIMessagePart[] = [];

        if (input.trim()) {
            aiMessageParts.push({ type: "text", text: input.trim() });
            uiMessageParts.push({ type: "text", text: input.trim() });
        }

        for (const droppedFile of droppedFiles) {
            const normalizedMimeType = normalizeMimeType(droppedFile.file);
            const dataUrl = await createDataUrl(droppedFile.file);

            aiMessageParts.push({
                type: "file",
                filename: droppedFile.name,
                mimetype: normalizedMimeType,
                url: dataUrl,
                size: droppedFile.file.size,
                previewurl: droppedFile.previewUrl,
            });

            uiMessageParts.push({
                type: "data-userfile",
                data: {
                    filename: droppedFile.name,
                    mimetype: normalizedMimeType,
                    size: droppedFile.file.size,
                    previewurl: droppedFile.previewUrl,
                },
            });
        }

        const realMessage: AIMessage = {
            messageid: crypto.randomUUID(),
            parts: aiMessageParts,
        };
        this.realMessage = realMessage;

        // console.log("SUBMIT MESSAGE", realMessage);

        // the UI message shares the backend message id so edit/regenerate can truncate the stored chat at it
        this.useChatSendMessage?.({ id: realMessage.messageid, parts: uiMessageParts });

        globalStore.set(this.isChatEmptyAtom, false);
        globalStore.set(this.inputAtom, "");
        this.clearFiles();
    }

    async uiLoadInitialChat() {
        globalStore.set(this.isLoadingChatAtom, true);
        const messages = await this.loadInitialChat();
        this.useChatSetMessages?.(messages);
        globalStore.set(this.isLoadingChatAtom, false);
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    async ensureRateLimitSet() {
        const currentInfo = globalStore.get(atoms.waveAIRateLimitInfoAtom);
        if (currentInfo != null) {
            return;
        }
        try {
            const rateLimitInfo = await RpcApi.GetWaveAIRateLimitCommand(TabRpcClient);
            if (rateLimitInfo != null) {
                globalStore.set(atoms.waveAIRateLimitInfoAtom, rateLimitInfo);
            }
        } catch (error) {
            console.error("Failed to fetch rate limit info:", error);
        }
    }

    async truncateBeforeMessage(messageId: string) {
        globalStore.set(this.editingMessageIdAtom, null);
        const messages = this.useChatMessages;
        const idx = messages.findIndex((msg) => msg.id === messageId);
        if (idx === -1) {
            return;
        }
        try {
            await RpcApi.WaveAITruncateChatCommand(TabRpcClient, {
                chatid: globalStore.get(this.chatId),
                messageid: messageId,
            });
        } catch (error) {
            console.error("Failed to truncate chat for edit:", error);
        }
        this.useChatSetMessages?.(messages.slice(0, idx));
    }

    startEditMessage(messageId: string) {
        if (this.isBusy()) {
            return;
        }
        const message = this.useChatMessages.find((msg) => msg.id === messageId);
        if (message == null || message.role !== "user") {
            return;
        }
        globalStore.set(this.editingMessageIdAtom, messageId);
        globalStore.set(this.inputAtom, getMessageText(message));
        this.focusInput();
    }

    cancelEditMessage() {
        globalStore.set(this.editingMessageIdAtom, null);
        globalStore.set(this.inputAtom, "");
    }

    async regenerateLastResponse() {
        if (this.isBusy()) {
            return;
        }
        const messages = this.useChatMessages;
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                lastUserIdx = i;
                break;
            }
        }
        if (lastUserIdx === -1) {
            return;
        }
        const lastUser = messages[lastUserIdx];
        this.clearError();
        let truncated = false;
        try {
            truncated = await RpcApi.WaveAITruncateChatCommand(TabRpcClient, {
                chatid: globalStore.get(this.chatId),
                messageid: lastUser.id,
                keepmessage: true,
            });
        } catch (error) {
            console.error("Failed to truncate chat for regenerate:", error);
        }
        if (truncated) {
            this.useChatSetMessages?.(messages.slice(0, lastUserIdx + 1));
            this.regenerateNext = true;
            this.useChatSendMessage?.();
            return;
        }
        // the backend never stored this turn (the request failed before it was posted), so send its text again;
        // attachments are not kept in the UI message and cannot be resent this way
        const text = getMessageText(lastUser);
        if (!text) {
            return;
        }
        this.useChatSetMessages?.(messages.slice(0, lastUserIdx));
        globalStore.set(this.inputAtom, text);
        await this.handleSubmit();
    }

    // newest first
    getUserPromptHistory(): string[] {
        const history: string[] = [];
        for (let i = this.useChatMessages.length - 1; i >= 0; i--) {
            const message = this.useChatMessages[i];
            if (message.role !== "user") {
                continue;
            }
            const text = getMessageText(message);
            if (text && history[history.length - 1] !== text) {
                history.push(text);
            }
        }
        return history;
    }

    async submitPrompt(text: string) {
        if (this.isBusy()) {
            return;
        }
        globalStore.set(this.inputAtom, text);
        await this.handleSubmit();
    }

    getTermViewModel(blockId: string): TermViewModel | null {
        const viewModel = getBlockComponentModel(blockId)?.viewModel;
        if (viewModel?.viewType !== "term") {
            return null;
        }
        return viewModel as TermViewModel;
    }

    findTargetTermBlockId(): string | null {
        const blocks = globalStore.get(this.tabBlocksAtom);
        const isShellTerm = (block: Block) => block.meta?.view === "term" && block.meta?.controller !== "cmd";
        const focusedBlockId = globalStore.get(this.focusedBlockIdAtom);
        const focused = blocks.find((block) => block.oid === focusedBlockId);
        if (focused != null && isShellTerm(focused)) {
            return focused.oid;
        }
        return blocks.find(isShellTerm)?.oid ?? null;
    }

    focusBlock(blockId: string) {
        const layoutModel = getLayoutModelForStaticTab();
        const node = layoutModel?.getNodeByBlockId(blockId);
        if (node == null) {
            return;
        }
        layoutModel.focusNode(node.id);
        FocusManager.getInstance().setBlockFocus(true);
    }

    // pasted (not typed) so bracketed paste keeps multi-line snippets from running line by line; never presses Enter
    insertIntoTerminal(code: string) {
        const blockId = this.findTargetTermBlockId();
        const terminal = blockId ? this.getTermViewModel(blockId)?.termRef?.current?.terminal : null;
        if (terminal == null) {
            this.setError(t("ai.noTerminalToInsert"));
            return;
        }
        terminal.paste(stripShellPrompts(code));
        this.focusBlock(blockId);
    }

    attachTerminalOutput(blockId: string, label: string) {
        const text = this.getTermViewModel(blockId)?.getRecentOutputText();
        if (!text) {
            this.setError(t("ai.terminalOutputUnavailable"));
            return;
        }
        const safeName = label.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "terminal";
        const file = new File([text], `${safeName}-output.txt`, { type: "text/plain" });
        fireAndForget(() => this.addFile(file));
    }

    attachBlockContext(block: Block) {
        const meta = block?.meta;
        if (meta == null) {
            return;
        }
        if (meta.view === "term") {
            this.attachTerminalOutput(block.oid, meta.connection || "terminal");
            return;
        }
        if (meta.view === "preview" && meta.file) {
            const relName = meta.file.split(/[\\/]/).filter((part) => part !== "").pop() ?? meta.file;
            fireAndForget(() =>
                this.addFileFromRemoteUri({
                    uri: formatRemoteUri(meta.file, meta.connection),
                    absParent: "",
                    relName,
                    isDir: false,
                })
            );
            return;
        }
        if (meta.view === "web" && meta.url) {
            this.appendText(meta.url);
        }
    }

    askAboutFailedCommand(info: FailedCommandInfo) {
        const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
        if (!workspaceLayoutModel.getAIPanelVisible()) {
            workspaceLayoutModel.setAIPanelVisible(true);
        }
        let output = info.output.trim();
        if (output.length > FailedCommandOutputMaxChars) {
            output = "…\n" + output.slice(output.length - FailedCommandOutputMaxChars);
        }
        const prompt = t("ai.failedCommandPrompt", {
            cmd: info.cmd || t("ai.unknownCommand"),
            code: info.exitCode,
            output: output || t("ai.noCommandOutput"),
        });
        if (!this.isBusy() && !this.hasNonEmptyInput()) {
            fireAndForget(() => this.submitPrompt(prompt));
            return;
        }
        this.appendText(prompt, true, { scrollToBottom: true });
        this.focusInput();
    }

    requestWaveAIFocus() {
        if (this.inBuilder) {
            BuilderFocusManager.getInstance().setWaveAIFocused();
        } else {
            FocusManager.getInstance().requestWaveAIFocus();
        }
    }

    requestNodeFocus() {
        if (this.inBuilder) {
            BuilderFocusManager.getInstance().setAppFocused();
        } else {
            FocusManager.getInstance().requestNodeFocus();
        }
    }

    getChatId(): string {
        return globalStore.get(this.chatId);
    }

    toolUseSendApproval(toolcallid: string, approval: string, rememberForChat?: boolean) {
        RpcApi.WaveAIToolApproveCommand(TabRpcClient, {
            toolcallid: toolcallid,
            approval: approval,
            rememberforchat: rememberForChat,
        });
    }

    async openDiff(fileName: string, toolcallid: string) {
        const chatId = this.getChatId();

        if (!chatId || !fileName) {
            console.error("Missing chatId or fileName for opening diff", chatId, fileName);
            return;
        }

        const blockDef: BlockDef = {
            meta: {
                view: "aifilediff",
                file: fileName,
                "aifilediff:chatid": chatId,
                "aifilediff:toolcallid": toolcallid,
            },
        };
        await createBlock(blockDef, false, true);
    }

    async openWaveAIConfig() {
        const blockDef: BlockDef = {
            meta: {
                view: "waveconfig",
                file: "waveai.json",
            },
        };
        await createBlock(blockDef, false, true);
    }

    openRestoreBackupModal(toolcallid: string) {
        globalStore.set(this.restoreBackupModalToolCallId, toolcallid);
    }

    closeRestoreBackupModal() {
        globalStore.set(this.restoreBackupModalToolCallId, null);
        globalStore.set(this.restoreBackupStatus, "idle");
        globalStore.set(this.restoreBackupError, null);
    }

    async restoreBackup(toolcallid: string, backupFilePath: string, restoreToFileName: string) {
        globalStore.set(this.restoreBackupStatus, "processing");
        globalStore.set(this.restoreBackupError, null);
        try {
            await RpcApi.FileRestoreBackupCommand(TabRpcClient, {
                backupfilepath: backupFilePath,
                restoretofilename: restoreToFileName,
            });
            console.log("Backup restored successfully:", { toolcallid, backupFilePath, restoreToFileName });
            globalStore.set(this.restoreBackupStatus, "success");
        } catch (error) {
            console.error("Failed to restore backup:", error);
            const errorMsg = error?.message || String(error);
            globalStore.set(this.restoreBackupError, errorMsg);
            globalStore.set(this.restoreBackupStatus, "error");
        }
    }

    canCloseWaveAIPanel(): boolean {
        if (this.inBuilder) {
            return false;
        }
        return true;
    }

    closeWaveAIPanel() {
        if (this.inBuilder) {
            return;
        }
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(false);
    }
}
