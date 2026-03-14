import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformDirectory } from "./transform-files";

const TEST_DIR = join(import.meta.dir, "__test_transform_fixtures__");

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});
afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("transformDirectory", () => {
	it("transforms @superbuilder imports in .ts files", async () => {
		writeFileSync(
			join(TEST_DIR, "test.ts"),
			'import { auth } from "@superbuilder/core-auth";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "test.ts"), "utf-8")).toBe(
			'import { auth } from "@repo/core/auth";',
		);
		expect(count).toBe(1);
	});

	it("transforms .tsx files", async () => {
		writeFileSync(
			join(TEST_DIR, "comp.tsx"),
			'import { Feature } from "@superbuilder/core-ui";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "comp.tsx"), "utf-8")).toBe(
			'import { Feature } from "@repo/ui";',
		);
		expect(count).toBe(1);
	});

	it("skips non-ts files", async () => {
		writeFileSync(
			join(TEST_DIR, "data.json"),
			'{"from": "@superbuilder/core-auth"}',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "data.json"), "utf-8")).toBe(
			'{"from": "@superbuilder/core-auth"}',
		);
		expect(count).toBe(0);
	});

	it("processes subdirectories recursively", async () => {
		mkdirSync(join(TEST_DIR, "sub"), { recursive: true });
		writeFileSync(
			join(TEST_DIR, "sub/nested.ts"),
			'import { db } from "@superbuilder/core-db";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "sub/nested.ts"), "utf-8")).toBe(
			'import { db } from "@repo/drizzle";',
		);
		expect(count).toBe(1);
	});

	it("skips files without @superbuilder imports", async () => {
		writeFileSync(join(TEST_DIR, "clean.ts"), 'import React from "react";');
		const count = await transformDirectory(TEST_DIR);
		expect(count).toBe(0);
	});

	it("returns 0 for empty directory", async () => {
		const count = await transformDirectory(TEST_DIR);
		expect(count).toBe(0);
	});
});
