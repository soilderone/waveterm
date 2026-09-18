// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getSettingsKeyAtom } from "@/store/global";
import { useAtomValue } from "jotai";
import { setLanguage, t } from "./i18n";

export function useT(): typeof t {
    const lang = useAtomValue(getSettingsKeyAtom("app:language"));
    setLanguage(lang ?? "en");
    return t;
}
