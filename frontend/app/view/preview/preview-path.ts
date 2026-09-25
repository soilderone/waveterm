// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Kept dependency-free on purpose: preview.tsx, preview-model.tsx and preview-directory.tsx all
// need these, and importing them from any of those modules would create an import cycle.

// Remote paths reach us in whatever flavor the connection uses, so the separator is inferred from
// the path itself rather than from the local platform.
export function getPathSeparator(path: string): string {
    if (path == null) {
        return "/";
    }
    if (path.includes("/")) {
        return "/";
    }
    if (path.includes("\\")) {
        return "\\";
    }
    return "/";
}

export function isPathInside(childPath: string, parentPath: string): boolean {
    if (childPath == null || parentPath == null || childPath == "" || parentPath == "") {
        return false;
    }
    if (childPath == parentPath) {
        return true;
    }
    const sep = getPathSeparator(parentPath);
    const prefix = parentPath.endsWith(sep) ? parentPath : parentPath + sep;
    return childPath.startsWith(prefix);
}

export function getParentPath(path: string): string {
    if (path == null || path == "") {
        return null;
    }
    const sep = getPathSeparator(path);
    const idx = path.lastIndexOf(sep);
    if (idx < 0) {
        return null;
    }
    if (idx == 0) {
        return sep;
    }
    return path.substring(0, idx);
}

export function getBaseName(path: string): string {
    if (path == null || path == "") {
        return "";
    }
    const sep = getPathSeparator(path);
    const idx = path.lastIndexOf(sep);
    if (idx < 0) {
        return path;
    }
    return path.substring(idx + 1) || path;
}

export function remapPath(path: string, oldPrefix: string, newPrefix: string): string {
    if (!isPathInside(path, oldPrefix)) {
        return path;
    }
    if (path == oldPrefix) {
        return newPrefix;
    }
    return newPrefix + path.substring(oldPrefix.length);
}

export function joinPath(dir: string, name: string): string {
    const sep = getPathSeparator(dir);
    return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

// A path typed into the block header resolves the way a shell would: "~" and absolute paths stand
// on their own, anything else is taken relative to the directory the block is showing.
export function resolveTypedPath(input: string, baseDir: string): string {
    const path = input?.trim();
    if (path == null || path == "") {
        return null;
    }
    const isAbsolute =
        path.startsWith("~") || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path);
    if (isAbsolute || baseDir == null || baseDir == "") {
        return path;
    }
    return joinPath(baseDir, path);
}

