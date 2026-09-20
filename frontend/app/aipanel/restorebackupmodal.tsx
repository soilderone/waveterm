// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { recordTEvent } from "@/app/store/global";
import { useT } from "@/util/i18n-hooks";
import { useAtomValue } from "jotai";
import { memo } from "react";
import { WaveUIMessagePart } from "./aitypes";
import { WaveAIModel } from "./waveai-model";

interface RestoreBackupModalProps {
    part: WaveUIMessagePart & { type: "data-tooluse" };
}

export const RestoreBackupModal = memo(({ part }: RestoreBackupModalProps) => {
    const t = useT();
    const model = WaveAIModel.getInstance();
    const toolData = part.data;
    const status = useAtomValue(model.restoreBackupStatus);
    const error = useAtomValue(model.restoreBackupError);

    const formatTimestamp = (ts: number) => {
        if (!ts) return "";
        const date = new Date(ts);
        return date.toLocaleString();
    };

    const handleConfirm = () => {
        recordTEvent("waveai:revertfile", { "waveai:action": "revertfile:confirm" });
        model.restoreBackup(toolData.toolcallid, toolData.writebackupfilename, toolData.inputfilename);
    };

    const handleCancel = () => {
        recordTEvent("waveai:revertfile", { "waveai:action": "revertfile:cancel" });
        model.closeRestoreBackupModal();
    };

    const handleClose = () => {
        model.closeRestoreBackupModal();
    };

    if (status === "success") {
        return (
            <Modal
                className="restore-backup-modal pb-5 pr-5"
                onClose={handleClose}
                onOk={handleClose}
                okLabel={t("ai.close")}
            >
                <div className="flex flex-col gap-4 pt-4 pb-4 max-w-xl">
                    <div className="font-semibold text-lg text-green-500">{t("ai.backupRestored")}</div>
                    <div className="text-sm text-secondary leading-relaxed">
                        {t("ai.backupRestoredPrefix")}
                        <span className="font-mono text-primary break-all">{toolData.inputfilename}</span>
                        {t("ai.backupRestoredSuffix")}
                    </div>
                </div>
            </Modal>
        );
    }

    if (status === "error") {
        return (
            <Modal
                className="restore-backup-modal pb-5 pr-5"
                onClose={handleClose}
                onOk={handleClose}
                okLabel={t("ai.close")}
            >
                <div className="flex flex-col gap-4 pt-4 pb-4 max-w-xl">
                    <div className="font-semibold text-lg text-red-500">{t("ai.backupRestoreFailed")}</div>
                    <div className="text-sm text-secondary leading-relaxed">{t("ai.backupRestoreErrorDesc")}</div>
                    <div className="text-sm text-red-400 font-mono bg-raise p-3 rounded break-all">{error}</div>
                </div>
            </Modal>
        );
    }

    const isProcessing = status === "processing";

    return (
        <Modal
            className="restore-backup-modal pb-5 pr-5"
            onClose={handleCancel}
            onCancel={handleCancel}
            onOk={handleConfirm}
            okLabel={isProcessing ? t("ai.restoring") : t("ai.confirmRestore")}
            cancelLabel={t("common.cancel")}
            okDisabled={isProcessing}
            cancelDisabled={isProcessing}
        >
            <div className="flex flex-col gap-4 pt-4 pb-4 max-w-xl">
                <div className="font-semibold text-lg">{t("ai.restoreFileBackup")}</div>
                <div className="text-sm text-secondary leading-relaxed">
                    {t("ai.restoreBackupPrefix")}
                    <span className="font-mono text-primary break-all">{toolData.inputfilename}</span>
                    {t("ai.restoreBackupSuffix")}
                    {toolData.runts && <span> ({formatTimestamp(toolData.runts)})</span>}
                    {t("ai.sentenceEnd")}
                </div>
                <div className="text-sm text-secondary leading-relaxed">{t("ai.restoreBackupWarning")}</div>
            </div>
        </Modal>
    );
});

RestoreBackupModal.displayName = "RestoreBackupModal";