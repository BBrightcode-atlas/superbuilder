import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	resolveFeatures,
	scanFeatureManifests,
} from "@superbuilder/atlas-engine";
import { z } from "zod";
import { publicProcedure, router } from "../..";

/**
 * Resolve features source directory (shared logic with registry.ts).
 */
function getFeaturesDir(): string {
	const envPath = process.env.SUPERBUILDER_FEATURES_PATH;
	if (envPath) {
		const featuresPath = join(envPath, "features");
		if (existsSync(featuresPath)) return featuresPath;
		if (existsSync(envPath)) return envPath;
	}

	try {
		const { app } = require("electron");
		const appPath = app.getAppPath();
		const sibling = join(
			appPath,
			"..",
			"..",
			"..",
			"superbuilder-features",
			"features",
		);
		if (existsSync(sibling)) return sibling;
	} catch {}

	throw new Error(
		"Feature source not found. Set SUPERBUILDER_FEATURES_PATH env var or clone superbuilder-features as sibling directory.",
	);
}

function getManifest() {
	const featuresDir = getFeaturesDir();
	const manifests = scanFeatureManifests(featuresDir);
	// resolveFeatures expects BoilerplateManifest shape
	// Build it from scanned manifests
	const features: Record<
		string,
		{ group: string; dependencies: string[]; optionalDependencies: string[] }
	> = {};
	for (const m of manifests) {
		features[m.id] = {
			group: m.group ?? "extension",
			dependencies: m.dependencies ?? [],
			optionalDependencies: m.optionalDependencies ?? [],
		};
	}
	return {
		version: "1.0.0",
		source: { repo: "", branch: "", lastSyncedCommit: "", syncedAt: "" },
		features,
	};
}

export const createAtlasResolverRouter = () =>
	router({
		resolve: publicProcedure
			.input(z.object({ selected: z.array(z.string()) }))
			.query(({ input }) => {
				const manifest = getManifest();
				return resolveFeatures(manifest as any, input.selected);
			}),
	});
