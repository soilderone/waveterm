// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { makeMockWaveEnv } from "@/preview/mock/mockwaveenv";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { atom } from "jotai";
import { getWebPreviewDisplayUrl, WebViewModel, WebViewPreviewFallback } from "./webview";

vi.mock("@/util/i18n", async () => {
    const { enWeb } = await import("@/locales/en-web");
    return {
        t: (key: string, params?: Record<string, string | number>) => {
            let str = enWeb[key] ?? key;
            if (params != null) {
                for (const [paramKey, paramValue] of Object.entries(params)) {
                    str = str.split(`{${paramKey}}`).join(String(paramValue));
                }
            }
            return str;
        },
    };
});

vi.mock("@/util/i18n-hooks", async () => {
    const { t } = await import("@/util/i18n");
    return { useT: () => t };
});

describe("webview preview fallback", () => {
    it("shows the requested URL", () => {
        const markup = renderToStaticMarkup(<WebViewPreviewFallback url="https://waveterm.dev/docs" />);

        expect(markup).toContain("electron webview unavailable");
        expect(markup).toContain("https://waveterm.dev/docs");
    });

    it("falls back to about:blank when no URL is available", () => {
        expect(getWebPreviewDisplayUrl("")).toBe("about:blank");
        expect(getWebPreviewDisplayUrl(null)).toBe("about:blank");
    });

    it("uses the supplied env for homepage atoms and config updates", async () => {
        const blockId = "webview-env-block";
        const env = makeMockWaveEnv({
            settings: {
                "web:defaulturl": "https://default.example",
            },
            mockWaveObjs: {
                [`block:${blockId}`]: {
                    otype: "block",
                    oid: blockId,
                    version: 1,
                    meta: {
                        pinnedurl: "https://block.example",
                    },
                } as Block,
            },
        });
        const model = new WebViewModel({
            blockId,
            nodeModel: {
                isFocused: atom(true),
                focusNode: () => {},
            } as any,
            tabModel: {} as any,
            waveEnv: env,
        });

        expect(globalStore.get(model.homepageUrl)).toBe("https://block.example");

        await model.setHomepageUrl("https://global.example", "global");

        expect(globalStore.get(model.homepageUrl)).toBe("https://global.example");
        expect(globalStore.get(env.getSettingsKeyAtom("web:defaulturl"))).toBe("https://global.example");
        expect(globalStore.get(env.wos.getWaveObjectAtom<Block>(`block:${blockId}`))?.meta?.pinnedurl).toBeUndefined();
    });
});
