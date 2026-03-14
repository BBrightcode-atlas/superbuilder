import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanFeatureManifests } from "./scanner";
import type { FeatureManifest } from "./types";

const TEST_DIR = join(import.meta.dir, "__test_fixtures__");

function writeManifest(id: string, overrides: Partial<FeatureManifest> = {}) {
	const dir = join(TEST_DIR, id);
	mkdirSync(dir, { recursive: true });
	const manifest: FeatureManifest = {
		id,
		name: overrides.name ?? id,
		version: overrides.version ?? "1.0.0",
		type: overrides.type ?? "page",
		group: overrides.group ?? "content",
		icon: overrides.icon ?? "file",
		description: overrides.description,
		dependencies: overrides.dependencies ?? [],
		optionalDependencies: overrides.optionalDependencies,
		provides: overrides.provides ?? {},
	};
	writeFileSync(join(dir, "feature.json"), JSON.stringify(manifest, null, 2));
}

describe("scanFeatureManifests", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	it("returns empty array when features dir is empty", () => {
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toEqual([]);
	});

	it("reads a single feature.json manifest", () => {
		writeManifest("blog", { name: "Blog", group: "content" });
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("blog");
		expect(result[0].name).toBe("Blog");
		expect(result[0].group).toBe("content");
	});

	it("reads multiple manifests sorted by id", () => {
		writeManifest("review");
		writeManifest("auth");
		writeManifest("blog");
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(3);
		expect(result.map((m) => m.id)).toEqual(["auth", "blog", "review"]);
	});

	it("skips directories without feature.json", () => {
		writeManifest("blog");
		mkdirSync(join(TEST_DIR, "empty-dir"), { recursive: true });
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("blog");
	});

	it("skips dotfiles and _prefixed directories", () => {
		writeManifest("blog");
		writeManifest(".hidden");
		writeManifest("_internal");
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("blog");
	});

	it("returns empty array when features dir does not exist", () => {
		const result = scanFeatureManifests(join(TEST_DIR, "nonexistent"));
		expect(result).toEqual([]);
	});

	it("skips directories with malformed feature.json", () => {
		writeManifest("blog");
		const malformedDir = join(TEST_DIR, "broken");
		mkdirSync(malformedDir, { recursive: true });
		writeFileSync(join(malformedDir, "feature.json"), "{ invalid json }}}");
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("blog");
	});

	it("skips regular files in features directory", () => {
		writeManifest("blog");
		writeFileSync(join(TEST_DIR, "README.md"), "# Features");
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("blog");
	});

	it("preserves all manifest fields when reading", () => {
		writeManifest("payment", {
			name: "결제",
			type: "page",
			group: "commerce",
			icon: "CreditCard",
			description: "결제 시스템",
			dependencies: ["profile", "auth"],
			optionalDependencies: ["coupon"],
			provides: {
				server: {
					module: "PaymentModule",
					router: "paymentRouter",
					routerKey: "payment",
				},
				schema: { tables: ["payments", "invoices"] },
			},
		});
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].dependencies).toEqual(["profile", "auth"]);
		expect(result[0].optionalDependencies).toEqual(["coupon"]);
		expect(result[0].provides.server?.module).toBe("PaymentModule");
		expect(result[0].provides.schema?.tables).toEqual(["payments", "invoices"]);
	});

	it("defaults optionalDependencies to empty array when not present", () => {
		const dir = join(TEST_DIR, "no-optional");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "feature.json"),
			JSON.stringify({
				id: "no-optional",
				name: "No Optional",
				version: "1.0.0",
				type: "page",
				group: "content",
				icon: "file",
				dependencies: [],
				provides: {},
			}),
		);
		const result = scanFeatureManifests(TEST_DIR);
		expect(result).toHaveLength(1);
		expect(result[0].optionalDependencies).toEqual([]);
	});
});
