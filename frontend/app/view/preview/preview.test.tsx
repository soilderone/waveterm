import { describe, expect, it, vi } from "vitest";
import { getPreviewTreeRoot } from "./preview";

vi.mock("@/app/element/quickelems", () => ({ CenteredDiv: () => null }));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/app/suggestion/suggestion", () => ({ BlockHeaderSuggestionControl: () => null }));
vi.mock("@/app/waveenv/waveenv", () => ({ useWaveEnv: vi.fn() }));
vi.mock("@/util/util", () => ({ cn: vi.fn(), fireAndForget: vi.fn(), isBlank: vi.fn(), makeConnRoute: vi.fn() }));
vi.mock("@/util/i18n-hooks", () => ({ useT: () => (key: string) => key }));
vi.mock("@/util/waveutil", () => ({ formatRemoteUri: vi.fn() }));
vi.mock("./csvview", () => ({ CSVView: () => null }));
vi.mock("./preview-directory", () => ({ DirectoryPreview: () => null, FileTree: () => null }));
vi.mock("./preview-edit", () => ({ CodeEditPreview: () => null }));
vi.mock("./preview-error-overlay", () => ({ ErrorOverlay: () => null }));
vi.mock("./preview-markdown", () => ({ MarkdownPreview: () => null }));
vi.mock("./preview-streaming", () => ({ StreamingPreview: () => null }));

const Root = { connection: "local", directory: { path: "/project", dir: "/", isdir: true } };

function loaded(data: FileInfo): Loadable<FileInfo> {
    return { state: "hasData", data };
}

describe("preview tree root", () => {
    it("keeps the directory root while opening successive descendant files", () => {
        let root = getPreviewTreeRoot(Root, "local", { state: "loading" });
        expect(root).toBe(Root);
        root = getPreviewTreeRoot(root, "local", loaded({ path: "/project/src/a.ts", dir: "/project/src" }));
        expect(root).toBe(Root);
        root = getPreviewTreeRoot(root, "local", loaded({ path: "/project/test/b.ts", dir: "/project/test" }));
        expect(root).toBe(Root);
    });

    it("adopts the active directory when no root is set", () => {
        const directory = { path: "/project/src", dir: "/project", isdir: true };
        const unset = { connection: "local", directory: null };
        expect(getPreviewTreeRoot(unset, "local", loaded(directory))).toEqual({ connection: "local", directory });
    });

    it("re-roots when the block navigates to a descendant directory", () => {
        const directory = { path: "/project/src", dir: "/project", isdir: true };
        expect(getPreviewTreeRoot(Root, "local", loaded(directory))).toEqual({ connection: "local", directory });
    });

    it("re-roots when the block navigates to an unrelated directory", () => {
        const directory = { path: "/other", dir: "/", isdir: true };
        expect(getPreviewTreeRoot(Root, "local", loaded(directory))).toEqual({ connection: "local", directory });
    });

    it("follows a home-relative directory change so the header and the tree agree", () => {
        const home = { connection: "local", directory: { path: "~", dir: "/", isdir: true } };
        const music = { path: "~/Music", dir: "~", isdir: true };
        expect(getPreviewTreeRoot(home, "local", loaded(music))).toEqual({ connection: "local", directory: music });
    });

    it("clears the root for a file outside it so the parent gets resolved", () => {
        expect(getPreviewTreeRoot(Root, "local", loaded({ path: "/other/a.ts", dir: "/other" }))).toEqual({
            connection: "local",
            directory: null,
        });
    });

    it("does not treat a sibling with a shared prefix as a descendant", () => {
        expect(getPreviewTreeRoot(Root, "local", loaded({ path: "/project-old/a.ts", dir: "/project-old" }))).toEqual({
            connection: "local",
            directory: null,
        });
    });

    it("does not reset the same directory after another stat", () => {
        expect(getPreviewTreeRoot(Root, "local", loaded({ ...Root.directory }))).toBe(Root);
    });

    it("retains the root when file information is unavailable or failed", () => {
        expect(getPreviewTreeRoot(Root, "local", loaded(null))).toBe(Root);
        expect(getPreviewTreeRoot(Root, "local", { state: "hasError", error: "failed" })).toBe(Root);
    });

    it("resets the root on connection changes even before new information resolves", () => {
        expect(getPreviewTreeRoot(Root, "ssh", { state: "loading" })).toEqual({ connection: "ssh", directory: null });
        expect(getPreviewTreeRoot(Root, "ssh", loaded({ path: "/project/a.ts", dir: "/project" }))).toEqual({
            connection: "ssh",
            directory: null,
        });
    });

    it("does not invent a directory or parent for a directly opened Windows file", () => {
        const root = { connection: "local", directory: null };
        expect(getPreviewTreeRoot(root, "local", loaded({ path: "C:\\work\\a.ts", dir: "C:\\work" }))).toBe(root);
        const directory = { path: "C:/work", dir: "C:/", isdir: true };
        expect(getPreviewTreeRoot(root, "local", loaded(directory))).toEqual({ connection: "local", directory });
    });
});
