// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { Input } from "@/app/element/input";
import { useT } from "@/util/i18n-hooks";
import React, { memo, useState } from "react";

export enum EntryManagerType {
    NewFile = "New File",
    NewDirectory = "New Folder",
    EditName = "Rename",
}

const EntryManagerTypeKeys: Record<EntryManagerType, string> = {
    [EntryManagerType.NewFile]: "common.newFile",
    [EntryManagerType.NewDirectory]: "common.newFolder",
    [EntryManagerType.EditName]: "common.rename",
};

export type EntryManagerOverlayProps = {
    forwardRef?: React.Ref<HTMLDivElement>;
    entryManagerType: EntryManagerType;
    startingValue?: string;
    onSave: (newValue: string) => void;
    onCancel?: () => void;
    style?: React.CSSProperties;
    getReferenceProps?: () => any;
};

export const EntryManagerOverlay = memo(
    ({
        entryManagerType,
        startingValue,
        onSave,
        onCancel,
        forwardRef,
        style,
        getReferenceProps,
    }: EntryManagerOverlayProps) => {
        const t = useT();
        const [value, setValue] = useState(startingValue);
        return (
            <div className="entry-manager-overlay" ref={forwardRef} style={style} {...(getReferenceProps?.() ?? {})}>
                <div className="entry-manager-type">{t(EntryManagerTypeKeys[entryManagerType])}</div>
                <div className="entry-manager-input">
                    <Input
                        value={value}
                        onChange={setValue}
                        autoFocus={true}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                onSave(value);
                            }
                        }}
                    />
                </div>
                <div className="entry-manager-buttons">
                    <Button className="py-[4px]" onClick={() => onSave(value)}>
                        {t("common.save")}
                    </Button>
                    <Button className="py-[4px] red outlined" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </div>
        );
    }
);

EntryManagerOverlay.displayName = "EntryManagerOverlay";
