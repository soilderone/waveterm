// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { enUS } from "@/locales/en";
import { enAi } from "@/locales/en-ai";
import { enBuilder } from "@/locales/en-builder";
import { enChrome } from "@/locales/en-chrome";
import { enOnboarding } from "@/locales/en-onboarding";
import { enSettings } from "@/locales/en-settings";
import { enTerm } from "@/locales/en-term";
import { enViews } from "@/locales/en-views";
import { enWeb } from "@/locales/en-web";
import { zhCN } from "@/locales/zh-cn";
import { zhCNAi } from "@/locales/zh-cn-ai";
import { zhCNBuilder } from "@/locales/zh-cn-builder";
import { zhCNChrome } from "@/locales/zh-cn-chrome";
import { zhCNOnboarding } from "@/locales/zh-cn-onboarding";
import { zhCNSettings } from "@/locales/zh-cn-settings";
import { zhCNTerm } from "@/locales/zh-cn-term";
import { zhCNViews } from "@/locales/zh-cn-views";
import { zhCNWeb } from "@/locales/zh-cn-web";

export type Language = "en" | "zh-CN";

const dictionaries: Record<Language, Record<string, string>> = {
    en: { ...enUS, ...enAi, ...enOnboarding, ...enSettings, ...enTerm, ...enViews, ...enChrome, ...enWeb, ...enBuilder },
    "zh-CN": { ...zhCN, ...zhCNAi, ...zhCNOnboarding, ...zhCNSettings, ...zhCNTerm, ...zhCNViews, ...zhCNChrome, ...zhCNWeb, ...zhCNBuilder },
};

let currentLanguage: Language = "en";

export function normalizeLanguage(lang: string): Language {
    if (lang == null) {
        return "en";
    }
    if (lang.toLowerCase().startsWith("zh")) {
        return "zh-CN";
    }
    return "en";
}

export function setLanguage(lang: string): void {
    currentLanguage = normalizeLanguage(lang);
}

export function getLanguage(): Language {
    return currentLanguage;
}

export function t(key: string, params?: Record<string, string | number>): string {
    const dict = dictionaries[currentLanguage];
    let str = dict[key] ?? dictionaries.en[key] ?? key;
    if (params != null) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            str = str.split(`{${paramKey}}`).join(String(paramValue));
        }
    }
    return str;
}
