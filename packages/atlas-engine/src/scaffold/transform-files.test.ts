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
	it("transforms relative schema imports in .ts files", async () => {
		writeFileSync(
			join(TEST_DIR, "test.ts"),
			'import { posts } from "../../schema";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "test.ts"), "utf-8")).toBe(
			'import { posts } from "@repo/drizzle/schema";',
		);
		expect(count).toBe(1);
	});

	it("transforms relative schema imports in .tsx files", async () => {
		writeFileSync(
			join(TEST_DIR, "comp.tsx"),
			'import { users } from "../../../schema/core";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "comp.tsx"), "utf-8")).toBe(
			'import { users } from "@repo/drizzle/schema";',
		);
		expect(count).toBe(1);
	});

	it("skips non-ts files", async () => {
		writeFileSync(
			join(TEST_DIR, "data.json"),
			'{"from": "../../schema"}',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "data.json"), "utf-8")).toBe(
			'{"from": "../../schema"}',
		);
		expect(count).toBe(0);
	});

	it("processes subdirectories recursively", async () => {
		mkdirSync(join(TEST_DIR, "sub"), { recursive: true });
		writeFileSync(
			join(TEST_DIR, "sub/nested.ts"),
			'import { db } from "../../../schema";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "sub/nested.ts"), "utf-8")).toBe(
			'import { db } from "@repo/drizzle/schema";',
		);
		expect(count).toBe(1);
	});

	it("skips files without relative schema imports", async () => {
		writeFileSync(join(TEST_DIR, "clean.ts"), 'import React from "react";');
		const count = await transformDirectory(TEST_DIR);
		expect(count).toBe(0);
	});

	it("does not transform @repo imports (already correct)", async () => {
		writeFileSync(
			join(TEST_DIR, "already.ts"),
			'import { auth } from "@repo/core/auth";',
		);
		const count = await transformDirectory(TEST_DIR);
		expect(readFileSync(join(TEST_DIR, "already.ts"), "utf-8")).toBe(
			'import { auth } from "@repo/core/auth";',
		);
		expect(count).toBe(0);
	});

	it("returns 0 for empty directory", async () => {
		const count = await transformDirectory(TEST_DIR);
		expect(count).toBe(0);
	});
});
