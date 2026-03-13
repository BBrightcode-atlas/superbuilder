import { describe, expect, test } from "bun:test";
import { buildProjectSpec } from "./spec-writer";
import { DEFAULT_PATH_MAPPING } from "./path-mapping";
import type { ProjectConfig } from "./types";
import type { ResolvedFeatures } from "../resolver/types";

describe("buildProjectSpec", () => {
	const config: ProjectConfig = {
		database: { provider: "neon" },
		auth: { provider: "better-auth", features: ["email"] },
		deploy: { provider: "vercel" },
	};

	const resolved: ResolvedFeatures = {
		selected: ["blog"],
		autoIncluded: ["comment"],
		resolved: ["comment", "blog"],
		availableOptional: [],
	};

	test("builds a valid ProjectSpec", () => {
		const spec = buildProjectSpec({
			name: "test-app",
			config,
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.name).toBe("test-app");
		expect(spec.config.database.provider).toBe("neon");
		expect(spec.config.auth.provider).toBe("better-auth");
		expect(spec.features.selected).toEqual(["blog"]);
		expect(spec.features.resolved).toEqual(["comment", "blog"]);
		expect(spec.features.autoIncluded).toEqual(["comment"]);
		expect(spec.installed).toEqual({});
		expect(spec.pathMapping).toEqual(DEFAULT_PATH_MAPPING);
		expect(spec.source.type).toBe("superbuilder");
		expect(spec.source.templateRepo).toBe(
			"BBrightcode-atlas/feature-atlas-template",
		);
	});

	test("includes description when provided", () => {
		const spec = buildProjectSpec({
			name: "my-saas",
			description: "AI-powered SaaS",
			config,
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.description).toBe("AI-powered SaaS");
	});

	test("defaults description to empty string", () => {
		const spec = buildProjectSpec({
			name: "my-app",
			config,
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.description).toBe("");
	});

	test("sets version to 0.1.0", () => {
		const spec = buildProjectSpec({
			name: "my-app",
			config,
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.version).toBe("0.1.0");
	});

	test("sets createdAt to a valid ISO string", () => {
		const spec = buildProjectSpec({
			name: "my-app",
			config,
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		const date = new Date(spec.source.createdAt);
		expect(date.getTime()).not.toBeNaN();
	});
});
