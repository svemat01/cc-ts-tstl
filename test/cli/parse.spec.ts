import * as ts from "typescript";
import * as tstl from "../../src";

describe("command line", () => {
    test("should support aliases", () => {
        const full = tstl.parseCommandLine(["--luaTarget", "5.1"]);
        const alias = tstl.parseCommandLine(["-lt", "5.1"]);
        expect(full).toEqual(alias);
    });

    test("should support standard typescript options", () => {
        const commandLine = "main.ts --project tsconfig.json --noHeader -t es3 -lt 5.3";
        const result = tstl.parseCommandLine(commandLine.split(" "));

        expect(result.errors).not.toHaveDiagnostics();
        expect(result.fileNames).toEqual(["main.ts"]);
        expect(result.options).toEqual({
            project: "tsconfig.json",
            noHeader: true,
            target: ts.ScriptTarget.ES3,
            luaTarget: tstl.LuaTarget.Lua53,
        });
    });

    test("should error on unknown options", () => {
        const result = tstl.parseCommandLine(["--unknownOption"]);

        expect(result.errors).toHaveDiagnostics();
    });

    test("should parse options case-insensitively", () => {
        const result = tstl.parseCommandLine(["--NoHeader"]);

        expect(result.errors).not.toHaveDiagnostics();
        expect(result.options.noHeader).toBe(true);
    });

    describe("enum options", () => {
        test("should parse enums", () => {
            const result = tstl.parseCommandLine(["--luaTarget", "5.1"]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.luaTarget).toBe(tstl.LuaTarget.Lua51);
        });

        test("should be case-insensitive", () => {
            for (const value of ["jit", "JiT", "JIT"]) {
                const result = tstl.parseCommandLine(["--luaTarget", value]);

                expect(result.errors).not.toHaveDiagnostics();
                expect(result.options.luaTarget).toBe(tstl.LuaTarget.LuaJIT);
            }
        });

        test("should error on invalid value", () => {
            const result = tstl.parseCommandLine(["--luaTarget", "invalid"]);

            expect(result.errors).toHaveDiagnostics();
        });
    });

    describe("array-of-objects options", () => {
        test.each([["{"], ["{}"], ["0"], ["''"]])("should error on invalid value (%s)", value => {
            const result = tstl.parseCommandLine(["--luaPlugins", value]);

            expect(result.errors).toHaveDiagnostics();
        });
    });

    describe("boolean options", () => {
        test.each([true, false])("should parse booleans (%p)", value => {
            const result = tstl.parseCommandLine(["--noHeader", value.toString()]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(value);
        });

        test("should be case-sensitive", () => {
            const result = tstl.parseCommandLine(["--noHeader", "FALSE"]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(true);
            expect(result.fileNames).toEqual(["FALSE"]);
        });

        test("should be parsed without a value", () => {
            const result = tstl.parseCommandLine(["--noHeader"]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(true);
        });

        test("shouldn't parse following arguments as values", () => {
            const result = tstl.parseCommandLine(["--noHeader", "--noImplicitSelf"]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(true);
            expect(result.options.noImplicitSelf).toBe(true);
        });

        test("shouldn't parse following files as values", () => {
            const result = tstl.parseCommandLine(["--noHeader", "file.ts"]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(true);
        });
    });

    describe("integration", () => {
        test.each<[string, string, tstl.CompilerOptions]>([
            ["noHeader", "false", { noHeader: false }],
            ["noHeader", "true", { noHeader: true }],
            ["sourceMapTraceback", "false", { sourceMapTraceback: false }],
            ["sourceMapTraceback", "true", { sourceMapTraceback: true }],
            ["tstlVerbose", "true", { tstlVerbose: true }],
            ["tstlVerbose", "false", { tstlVerbose: false }],

            ["buildMode", "default", { buildMode: tstl.BuildMode.Default }],
            ["buildMode", "library", { buildMode: tstl.BuildMode.Library }],

            ["luaLibImport", "none", { luaLibImport: tstl.LuaLibImportKind.None }],
            ["luaLibImport", "inline", { luaLibImport: tstl.LuaLibImportKind.Inline }],
            ["luaLibImport", "require", { luaLibImport: tstl.LuaLibImportKind.Require }],

            ["luaTarget", "universal", { luaTarget: tstl.LuaTarget.Universal }],
            ["luaTarget", "5.1", { luaTarget: tstl.LuaTarget.Lua51 }],
            ["luaTarget", "5.2", { luaTarget: tstl.LuaTarget.Lua52 }],
            ["luaTarget", "5.3", { luaTarget: tstl.LuaTarget.Lua53 }],
            ["luaTarget", "jit", { luaTarget: tstl.LuaTarget.LuaJIT }],
            ["luaTarget", "cc", { luaTarget: tstl.LuaTarget.Cobalt }],
            ["luaTarget", "cc-5.2", { luaTarget: tstl.LuaTarget.Cobalt52 }],

            ["luaBundle", "foo", { luaBundle: "foo" }],
            ["luaBundleEntry", "bar", { luaBundleEntry: "bar" }],

            ["extension", ".lua", { extension: ".lua" }],
            ["extension", "scar", { extension: "scar" }],

            ["luaPlugins", '[{ "name": "a" }]', { luaPlugins: [{ name: "a" }] }],
            ["luaPlugins", '[{ "name": "a" },{ "name": "b" }]', { luaPlugins: [{ name: "a" }, { name: "b" }] }],

            ["noResolvePaths", "path1", { noResolvePaths: ["path1"] }],
            ["noResolvePaths", "path1,path2", { noResolvePaths: ["path1", "path2"] }],
        ])("--%s %s", (optionName, value, expected) => {
            const result = tstl.parseCommandLine([`--${optionName}`, value]);

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options).toEqual(expected);
        });
    });
});

describe("tsconfig", () => {
    const parseConfigFileContent = (config: any) => {
        // Specifying `files` option disables automatic file searching, that includes all files in
        // the project, making these tests slow. Empty file list is considered as an error.
        config.files = ["src/index.ts"];
        return tstl.updateParsedConfigFile(ts.parseJsonConfigFileContent(config, ts.sys, ""));
    };

    test("should support deprecated root-level options", () => {
        const rootLevel = parseConfigFileContent({ noHeader: true });
        const namespaced = parseConfigFileContent({ tstl: { noHeader: true } });

        expect(rootLevel.errors).toEqual([expect.objectContaining({ category: ts.DiagnosticCategory.Warning })]);
        expect(rootLevel.options).toEqual(namespaced.options);
    });

    test("should allow unknown root-level options", () => {
        const result = parseConfigFileContent({ unknownOption: true });

        expect(result.errors).not.toHaveDiagnostics();
        expect(result.options.unknownOption).toBeUndefined();
    });

    test("should error on unknown namespaced options", () => {
        const result = parseConfigFileContent({ tstl: { unknownOption: true } });

        expect(result.errors).toHaveDiagnostics();
        expect(result.options.unknownOption).toBeUndefined();
    });

    test("should parse options case-sensitively", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const result = parseConfigFileContent({ tstl: { NoHeader: true } });

        expect(result.errors).toHaveDiagnostics();
        expect(result.options.NoHeader).toBeUndefined();
        expect(result.options.noHeader).toBeUndefined();
    });

    describe("enum options", () => {
        test("should parse enums", () => {
            const result = parseConfigFileContent({ tstl: { luaTarget: "5.1" } });

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.luaTarget).toBe(tstl.LuaTarget.Lua51);
        });

        test("should be case-insensitive", () => {
            for (const value of ["jit", "JiT", "JIT"]) {
                const result = parseConfigFileContent({ tstl: { luaTarget: value } });

                expect(result.errors).not.toHaveDiagnostics();
                expect(result.options.luaTarget).toBe(tstl.LuaTarget.LuaJIT);
            }
        });

        test("should error on invalid value", () => {
            const result = parseConfigFileContent({ tstl: { luaTarget: "invalid" } });

            expect(result.errors).toHaveDiagnostics();
        });
    });

    describe("boolean options", () => {
        test.each([true, false])("should parse booleans (%p)", value => {
            const result = parseConfigFileContent({ tstl: { noHeader: value } });

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options.noHeader).toBe(value);
        });

        test("shouldn't parse strings", () => {
            const result = parseConfigFileContent({ tstl: { noHeader: "true" } });

            expect(result.errors).toHaveDiagnostics();
            expect(result.options.noHeader).toBeUndefined();
        });
    });

    describe("integration", () => {
        test.each<[string, any, tstl.CompilerOptions]>([
            ["noHeader", false, { noHeader: false }],
            ["noHeader", true, { noHeader: true }],
            ["sourceMapTraceback", false, { sourceMapTraceback: false }],
            ["sourceMapTraceback", true, { sourceMapTraceback: true }],

            ["buildMode", "default", { buildMode: tstl.BuildMode.Default }],
            ["buildMode", "library", { buildMode: tstl.BuildMode.Library }],

            ["luaLibImport", "none", { luaLibImport: tstl.LuaLibImportKind.None }],
            ["luaLibImport", "inline", { luaLibImport: tstl.LuaLibImportKind.Inline }],
            ["luaLibImport", "require", { luaLibImport: tstl.LuaLibImportKind.Require }],

            ["luaTarget", "universal", { luaTarget: tstl.LuaTarget.Universal }],
            ["luaTarget", "5.0", { luaTarget: tstl.LuaTarget.Lua50 }],
            ["luaTarget", "5.1", { luaTarget: tstl.LuaTarget.Lua51 }],
            ["luaTarget", "5.2", { luaTarget: tstl.LuaTarget.Lua52 }],
            ["luaTarget", "5.3", { luaTarget: tstl.LuaTarget.Lua53 }],
            ["luaTarget", "5.4", { luaTarget: tstl.LuaTarget.Lua54 }],
            ["luaTarget", "jit", { luaTarget: tstl.LuaTarget.LuaJIT }],
            ["luaTarget", "cc", { luaTarget: tstl.LuaTarget.Cobalt }],
            ["luaTarget", "cc-5.2", { luaTarget: tstl.LuaTarget.Cobalt52 }],

            ["luaBundle", "foo", { luaBundle: "foo" }],
            ["luaBundleEntry", "bar", { luaBundleEntry: "bar" }],

            ["noImplicitSelf", true, { noImplicitSelf: true }],

            ["tstlVerbose", true, { tstlVerbose: true }],

            ["noResolvePaths", [], { noResolvePaths: [] }],
            ["noResolvePaths", ["path1", "path2"], { noResolvePaths: ["path1", "path2"] }],
        ])("{ %p: %p }", (optionName, value, expected) => {
            const result = parseConfigFileContent({ tstl: { [optionName]: value } });

            expect(result.errors).not.toHaveDiagnostics();
            expect(result.options).toEqual(expected);
        });
    });
});
