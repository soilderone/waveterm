import { describe, expect, it } from "vitest";
import {
    getBaseName,
    getParentPath,
    getPathSeparator,
    isPathInside,
    joinPath,
    remapPath,
    resolveTypedPath,
} from "./preview-path";

describe("getPathSeparator", () => {
    it("infers the separator from the path rather than the local platform", () => {
        expect(getPathSeparator("/a/b")).toBe("/");
        expect(getPathSeparator("C:\\work\\a")).toBe("\\");
        expect(getPathSeparator("C:/work/a")).toBe("/");
        expect(getPathSeparator("~")).toBe("/");
        expect(getPathSeparator(null)).toBe("/");
    });
});

describe("isPathInside", () => {
    it("treats a path as inside itself", () => {
        expect(isPathInside("/project", "/project")).toBe(true);
    });

    it("matches descendants at any depth", () => {
        expect(isPathInside("/project/src/a.ts", "/project")).toBe(true);
        expect(isPathInside("~/Music/rock/a.mp3", "~")).toBe(true);
        expect(isPathInside("C:\\work\\src\\a.ts", "C:\\work")).toBe(true);
    });

    it("does not match siblings that merely share a prefix", () => {
        expect(isPathInside("/project-old/a.ts", "/project")).toBe(false);
        expect(isPathInside("~/Musical", "~/Music")).toBe(false);
    });

    it("handles a root parent that already ends with the separator", () => {
        expect(isPathInside("/a", "/")).toBe(true);
        expect(isPathInside("C:\\a", "C:\\")).toBe(true);
    });

    it("is false for blank input", () => {
        expect(isPathInside(null, "/project")).toBe(false);
        expect(isPathInside("/project/a", null)).toBe(false);
        expect(isPathInside("", "")).toBe(false);
    });
});

describe("getParentPath", () => {
    it("returns the containing directory", () => {
        expect(getParentPath("/project/src/a.ts")).toBe("/project/src");
        expect(getParentPath("~/Music")).toBe("~");
        expect(getParentPath("C:\\work\\a.ts")).toBe("C:\\work");
    });

    it("collapses to the root instead of an empty string", () => {
        expect(getParentPath("/project")).toBe("/");
    });

    it("returns null when there is no parent", () => {
        expect(getParentPath("~")).toBe(null);
        expect(getParentPath("")).toBe(null);
        expect(getParentPath(null)).toBe(null);
    });
});

describe("getBaseName", () => {
    it("returns the last segment", () => {
        expect(getBaseName("/project/src/a.ts")).toBe("a.ts");
        expect(getBaseName("~")).toBe("~");
        expect(getBaseName("C:\\work\\a.ts")).toBe("a.ts");
    });
});

describe("remapPath", () => {
    it("rewrites the renamed entry itself", () => {
        expect(remapPath("/project/old.ts", "/project/old.ts", "/project/new.ts")).toBe("/project/new.ts");
    });

    it("rewrites everything under a renamed directory", () => {
        expect(remapPath("/project/old/src/a.ts", "/project/old", "/project/new")).toBe("/project/new/src/a.ts");
    });

    it("leaves unrelated paths untouched", () => {
        expect(remapPath("/project/other.ts", "/project/old.ts", "/project/new.ts")).toBe("/project/other.ts");
        expect(remapPath("/project-old/a.ts", "/project", "/renamed")).toBe("/project-old/a.ts");
    });
});

describe("joinPath", () => {
    it("adds exactly one separator", () => {
        expect(joinPath("~/project", "a.ts")).toBe("~/project/a.ts");
        expect(joinPath("/", "etc")).toBe("/etc");
        expect(joinPath("C:\\work", "a.ts")).toBe("C:\\work\\a.ts");
    });
});

describe("resolveTypedPath", () => {
    it("keeps home-relative and absolute paths as typed", () => {
        expect(resolveTypedPath("  ~/Desktop ", "/tmp")).toBe("~/Desktop");
        expect(resolveTypedPath("/etc", "~/project")).toBe("/etc");
        expect(resolveTypedPath("C:\\work", "/tmp")).toBe("C:\\work");
    });

    it("resolves anything else against the current directory", () => {
        expect(resolveTypedPath("src/app", "~/project")).toBe("~/project/src/app");
        expect(resolveTypedPath("../other", "~/project")).toBe("~/project/../other");
    });

    it("returns null for blank input", () => {
        expect(resolveTypedPath("   ", "~")).toBeNull();
        expect(resolveTypedPath(null, "~")).toBeNull();
    });
});
