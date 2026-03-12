import { describe, expect, test } from "bun:test";
import {
	DEFAULT_PATH_MAPPING,
	resolveSourcePath,
	resolveTargetPath,
} from "./path-mapping";

describe("resolveSourcePath", () => {
	test("resolves server feature path", () => {
		const result = resolveSourcePath(
			DEFAULT_PATH_MAPPING,
			"server",
			"blog",
			"/home/user/superbuilder",
		);
		expect(result).toBe(
			"/home/user/superbuilder/packages/features-server/features/blog",
		);
	});

	test("resolves client feature path", () => {
		const result = resolveSourcePath(
			DEFAULT_PATH_MAPPING,
			"client",
			"blog",
			"/home/user/superbuilder",
		);
		expect(result).toBe(
			"/home/user/superbuilder/apps/features-app/src/features/blog",
		);
	});

	test("resolves schema feature path", () => {
		const result = resolveSourcePath(
			DEFAULT_PATH_MAPPING,
			"schema",
			"blog",
			"/home/user/superbuilder",
		);
		expect(result).toBe(
			"/home/user/superbuilder/packages/drizzle/src/schema/features/blog",
		);
	});

	test("resolves widgets path", () => {
		const result = resolveSourcePath(
			DEFAULT_PATH_MAPPING,
			"widgets",
			"reaction",
			"/home/user/superbuilder",
		);
		expect(result).toBe(
			"/home/user/superbuilder/packages/widgets/src/reaction",
		);
	});
});

describe("resolveTargetPath", () => {
	test("resolves server target path", () => {
		const result = resolveTargetPath(
			DEFAULT_PATH_MAPPING,
			"server",
			"blog",
			"/tmp/my-project",
		);
		expect(result).toBe("/tmp/my-project/packages/features/blog");
	});

	test("resolves client target path", () => {
		const result = resolveTargetPath(
			DEFAULT_PATH_MAPPING,
			"client",
			"blog",
			"/tmp/my-project",
		);
		expect(result).toBe("/tmp/my-project/apps/app/src/features/blog");
	});

	test("resolves admin target path", () => {
		const result = resolveTargetPath(
			DEFAULT_PATH_MAPPING,
			"admin",
			"blog",
			"/tmp/my-project",
		);
		expect(result).toBe(
			"/tmp/my-project/apps/feature-admin/src/features/blog",
		);
	});

	test("resolves schema target path", () => {
		const result = resolveTargetPath(
			DEFAULT_PATH_MAPPING,
			"schema",
			"blog",
			"/tmp/my-project",
		);
		expect(result).toBe(
			"/tmp/my-project/packages/drizzle/src/schema/features/blog",
		);
	});
});
