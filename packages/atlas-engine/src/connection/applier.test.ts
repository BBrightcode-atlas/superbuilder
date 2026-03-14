import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { insertAtMarker } from "./applier";
import { registerWidgetExport } from "./widget-export";

const TEST_DIR = join(import.meta.dir, "__test_fixtures__");

describe("insertAtMarker", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	it("inserts content before closing marker", () => {
		const filePath = join(TEST_DIR, "app.module.ts");
		writeFileSync(
			filePath,
			["// [ATLAS:IMPORTS]", "// [/ATLAS:IMPORTS]"].join("\n"),
		);

		insertAtMarker(
			filePath,
			"IMPORTS",
			'import { BlogModule } from "@repo/features/blog";',
		);

		const result = readFileSync(filePath, "utf-8");
		expect(result).toContain(
			'import { BlogModule } from "@repo/features/blog";',
		);
		expect(result.indexOf("BlogModule")).toBeLessThan(
			result.indexOf("[/ATLAS:IMPORTS]"),
		);
	});

	it("inserts multiple lines", () => {
		const filePath = join(TEST_DIR, "router.ts");
		writeFileSync(
			filePath,
			["// [ATLAS:ROUTERS]", "// [/ATLAS:ROUTERS]"].join("\n"),
		);

		insertAtMarker(filePath, "ROUTERS", "blog: blogRouter,");
		insertAtMarker(filePath, "ROUTERS", "auth: authRouter,");

		const result = readFileSync(filePath, "utf-8");
		expect(result).toContain("blog: blogRouter,");
		expect(result).toContain("auth: authRouter,");
	});

	it("does nothing when marker not found", () => {
		const filePath = join(TEST_DIR, "no-marker.ts");
		const original = "const x = 1;\n";
		writeFileSync(filePath, original);

		insertAtMarker(filePath, "IMPORTS", "import { Foo } from 'foo';");

		const result = readFileSync(filePath, "utf-8");
		expect(result).toBe(original);
	});

	it("preserves indentation of closing marker", () => {
		const filePath = join(TEST_DIR, "indented.ts");
		writeFileSync(
			filePath,
			[
				"@Module({",
				"  imports: [",
				"    // [ATLAS:MODULES]",
				"    // [/ATLAS:MODULES]",
				"  ],",
				"})",
			].join("\n"),
		);

		insertAtMarker(filePath, "MODULES", "BlogModule,");

		const result = readFileSync(filePath, "utf-8");
		expect(result).toContain("    BlogModule,");
	});

	it("handles markers with content between them", () => {
		const filePath = join(TEST_DIR, "between.ts");
		writeFileSync(
			filePath,
			[
				"// [ATLAS:IMPORTS]",
				'import { A } from "a";',
				'import { B } from "b";',
				"// [/ATLAS:IMPORTS]",
			].join("\n"),
		);

		insertAtMarker(filePath, "IMPORTS", 'import { C } from "c";');

		const result = readFileSync(filePath, "utf-8");
		const lines = result.split("\n");
		expect(lines).toHaveLength(5);
		expect(lines[3]).toContain('import { C } from "c"');
	});

	it("preserves existing content", () => {
		const filePath = join(TEST_DIR, "existing.ts");
		writeFileSync(
			filePath,
			[
				"// [ATLAS:IMPORTS]",
				'import { AuthModule } from "@repo/features/auth";',
				"// [/ATLAS:IMPORTS]",
			].join("\n"),
		);

		insertAtMarker(
			filePath,
			"IMPORTS",
			'import { BlogModule } from "@repo/features/blog";',
		);

		const result = readFileSync(filePath, "utf-8");
		expect(result).toContain("AuthModule");
		expect(result).toContain("BlogModule");
	});
});

describe("registerWidgetExport", () => {
	beforeEach(() => {
		mkdirSync(join(TEST_DIR, "packages", "widgets"), { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	it("adds subpath export to package.json", () => {
		const pkgPath = join(TEST_DIR, "packages", "widgets", "package.json");
		writeFileSync(
			pkgPath,
			JSON.stringify({
				name: "@repo/widgets",
				exports: { ".": "./src/index.ts" },
			}),
		);

		registerWidgetExport(TEST_DIR, "comment", {
			subpath: "./comment",
			entry: "./src/comment/index.ts",
		});

		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		expect(pkg.exports["./comment"]).toBe("./src/comment/index.ts");
		expect(pkg.exports["."]).toBe("./src/index.ts");
	});

	it("creates exports field if missing", () => {
		const pkgPath = join(TEST_DIR, "packages", "widgets", "package.json");
		writeFileSync(pkgPath, JSON.stringify({ name: "@repo/widgets" }));

		registerWidgetExport(TEST_DIR, "comment", {
			subpath: "./comment",
			entry: "./src/comment/index.ts",
		});

		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		expect(pkg.exports["./comment"]).toBe("./src/comment/index.ts");
	});
});
