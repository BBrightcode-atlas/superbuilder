import { describe, expect, test } from "bun:test";
import {
	buildCustomizationPrompt,
	buildFeatureDevelopmentPrompt,
} from "./prompt-builder";

describe("buildFeatureDevelopmentPrompt", () => {
	const input = {
		featureName: "blog",
		spec: "A blog feature with CRUD operations and markdown support.",
		plan: "1. Create schema\n2. Create server module\n3. Create client pages",
	};

	test("includes featureName in output", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain("blog");
		expect(result).toContain("Feature Development: blog");
	});

	test("includes spec content", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain(
			"A blog feature with CRUD operations and markdown support.",
		);
	});

	test("includes plan content", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain("1. Create schema");
		expect(result).toContain("2. Create server module");
	});

	test("includes marker block rules", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain("[ATLAS:IMPORTS]");
		expect(result).toContain("[ATLAS:MODULES]");
		expect(result).toContain("[ATLAS:ROUTERS]");
		expect(result).toContain("[ATLAS:SCHEMAS]");
		expect(result).toContain("[/ATLAS:MARKER_NAME]");
	});

	test("includes superbuilder.json instructions", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain("superbuilder.json");
		expect(result).toContain('"name": "blog"');
		expect(result).toContain('"importName": "blogRouter"');
	});

	test("includes vertical slice paths", () => {
		const result = buildFeatureDevelopmentPrompt(input);
		expect(result).toContain("packages/features/blog/");
		expect(result).toContain("apps/app/src/features/blog/");
		expect(result).toContain("packages/drizzle/src/schema/features/blog/");
	});

	test("converts hyphenated names to camelCase for router", () => {
		const result = buildFeatureDevelopmentPrompt({
			...input,
			featureName: "user-profile",
		});
		expect(result).toContain('"key": "userProfile"');
		expect(result).toContain('"importName": "userProfileRouter"');
	});
});

describe("buildCustomizationPrompt", () => {
	const baseInput = {
		featureName: "blog",
		spec: "A blog feature.",
		plan: "1. Create schema",
		previousErrors: "TypeError: Cannot read property 'id' of undefined",
	};

	test("includes previous errors", () => {
		const result = buildCustomizationPrompt(baseInput);
		expect(result).toContain("Previous Attempt Issues");
		expect(result).toContain(
			"TypeError: Cannot read property 'id' of undefined",
		);
	});

	test("includes human feedback when provided", () => {
		const result = buildCustomizationPrompt({
			...baseInput,
			humanFeedback: "The sidebar navigation is missing the blog link.",
		});
		expect(result).toContain("## Human Feedback");
		expect(result).toContain(
			"The sidebar navigation is missing the blog link.",
		);
	});

	test("omits feedback section when not provided", () => {
		const result = buildCustomizationPrompt(baseInput);
		expect(result).not.toContain("## Human Feedback");
	});

	test("includes fix instructions", () => {
		const result = buildCustomizationPrompt(baseInput);
		expect(result).toContain(
			"Fix the issues above. The worktree already contains your previous work.",
		);
	});

	test("still includes core prompt sections", () => {
		const result = buildCustomizationPrompt(baseInput);
		expect(result).toContain("Feature Development: blog");
		expect(result).toContain("[ATLAS:IMPORTS]");
		expect(result).toContain("superbuilder.json");
	});
});
