import { describe, expect, it } from "bun:test";
import {
	FEATURE_JSON_PATH_MAPPING,
	resolveFeatureJsonSourcePath,
	resolveFeatureJsonTargetPath,
} from "./path-mapping";

describe("FEATURE_JSON_PATH_MAPPING", () => {
	it("has all required slots", () => {
		expect(FEATURE_JSON_PATH_MAPPING.server).toBeDefined();
		expect(FEATURE_JSON_PATH_MAPPING.client).toBeDefined();
		expect(FEATURE_JSON_PATH_MAPPING.admin).toBeDefined();
		expect(FEATURE_JSON_PATH_MAPPING.schema).toBeDefined();
		expect(FEATURE_JSON_PATH_MAPPING.widgets).toBeDefined();
	});

	it("maps server to packages/features", () => {
		expect(FEATURE_JSON_PATH_MAPPING.server.from).toBe("src/server");
		expect(FEATURE_JSON_PATH_MAPPING.server.to).toBe("packages/features");
	});

	it("maps widget from src/widget to packages/widgets/src", () => {
		expect(FEATURE_JSON_PATH_MAPPING.widgets.from).toBe("src/widget");
		expect(FEATURE_JSON_PATH_MAPPING.widgets.to).toBe("packages/widgets/src");
	});
});

describe("resolveFeatureJsonSourcePath", () => {
	it("resolves source path for server slot", () => {
		const result = resolveFeatureJsonSourcePath("/features", "blog", "server");
		expect(result).toBe("/features/blog/src/server");
	});

	it("resolves source path for widget slot", () => {
		const result = resolveFeatureJsonSourcePath(
			"/features",
			"comment",
			"widgets",
		);
		expect(result).toBe("/features/comment/src/widget");
	});

	it("resolves source path for schema slot", () => {
		const result = resolveFeatureJsonSourcePath("/features", "blog", "schema");
		expect(result).toBe("/features/blog/src/schema");
	});
});

describe("resolveFeatureJsonTargetPath", () => {
	it("resolves target path for server slot", () => {
		const result = resolveFeatureJsonTargetPath("/project", "blog", "server");
		expect(result).toBe("/project/packages/features/blog");
	});

	it("resolves target path for client slot", () => {
		const result = resolveFeatureJsonTargetPath("/project", "blog", "client");
		expect(result).toBe("/project/apps/app/src/features/blog");
	});

	it("resolves target path for admin slot", () => {
		const result = resolveFeatureJsonTargetPath("/project", "blog", "admin");
		expect(result).toBe("/project/apps/admin/src/features/blog");
	});

	it("resolves target path for widgets slot", () => {
		const result = resolveFeatureJsonTargetPath(
			"/project",
			"comment",
			"widgets",
		);
		expect(result).toBe("/project/packages/widgets/src/comment");
	});
});
