import { describe, expect, it, vi } from "vitest";
import { compareTreeEntries } from "./preview-directory-utils";

vi.mock("@/app/store/jotaiStore", () => ({ globalStore: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/util/util", () => ({ fireAndForget: vi.fn(), isBlank: vi.fn() }));

function file(name: string, extra: Partial<FileInfo> = {}): FileInfo {
    return { name, path: `/dir/${name}`, isdir: false, size: 0, modtime: 0, mimetype: "text/plain", ...extra };
}

function names(entries: FileInfo[], sort: { field: string; desc: boolean }): string[] {
    return [...entries].sort((a, b) => compareTreeEntries(a, b, sort)).map((entry) => entry.name);
}

describe("compareTreeEntries", () => {
    it("always lists directories before files in both directions", () => {
        const entries = [file("b.txt"), file("a", { isdir: true }), file("a.txt"), file("z", { isdir: true })];
        expect(names(entries, { field: "name", desc: false })).toEqual(["a", "z", "a.txt", "b.txt"]);
        expect(names(entries, { field: "name", desc: true })).toEqual(["z", "a", "b.txt", "a.txt"]);
    });

    it("sorts by name ascending and descending", () => {
        const entries = [file("b.txt"), file("a.txt"), file("c.txt")];
        expect(names(entries, { field: "name", desc: false })).toEqual(["a.txt", "b.txt", "c.txt"]);
        expect(names(entries, { field: "name", desc: true })).toEqual(["c.txt", "b.txt", "a.txt"]);
    });

    it("sorts by type using the cleaned mimetype", () => {
        const entries = [
            file("b", { mimetype: "text/plain" }),
            file("a", { mimetype: "application/json" }),
            file("c", { mimetype: "image/png" }),
        ];
        expect(names(entries, { field: "mimetype", desc: false })).toEqual(["a", "c", "b"]);
    });

    it("sorts numerically by size and modification time", () => {
        const entries = [
            file("b", { size: 20, modtime: 200 }),
            file("a", { size: 300, modtime: 100 }),
            file("c", { size: 10, modtime: 300 }),
        ];
        expect(names(entries, { field: "size", desc: false })).toEqual(["c", "b", "a"]);
        expect(names(entries, { field: "modtime", desc: true })).toEqual(["c", "b", "a"]);
    });

    it("orders numbered names naturally and ignores case", () => {
        const entries = [file("file10.txt"), file("File2.txt"), file("file1.txt")];
        expect(names(entries, { field: "name", desc: false })).toEqual(["file1.txt", "File2.txt", "file10.txt"]);
    });

    it("groups files of one mimetype by extension", () => {
        const entries = [
            file("b.log", { mimetype: "text/plain" }),
            file("a.txt", { mimetype: "text/plain" }),
            file("c.log", { mimetype: "text/plain" }),
        ];
        expect(names(entries, { field: "mimetype", desc: false })).toEqual(["b.log", "c.log", "a.txt"]);
    });

    it("breaks ties by name ascending", () => {
        const entries = [file("b", { size: 10 }), file("a", { size: 10 })];
        expect(names(entries, { field: "size", desc: false })).toEqual(["a", "b"]);
    });
});
