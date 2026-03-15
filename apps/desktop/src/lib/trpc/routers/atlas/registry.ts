import { z } from "zod";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { publicProcedure, router } from "../..";
import {
	scanFeatureManifests,
	manifestsToRegistry,
	type FeatureRegistry,
} from "@superbuilder/atlas-engine";

/**
 * Resolve features source directory.
 *
 * 1. SUPERBUILDER_FEATURES_PATH env var
 * 2. Sibling directory ../superbuilder-features/features
 * 3. Error
 */
function getFeaturesDir(): string {
	// 1. Environment variable
	const envPath = process.env.SUPERBUILDER_FEATURES_PATH;
	if (envPath) {
		const featuresPath = join(envPath, "features");
		if (existsSync(featuresPath)) return featuresPath;
		if (existsSync(envPath)) return envPath;
	}

	// 2. Sibling directory (common local dev layout)
	try {
		const { app } = require("electron");
		const appPath = app.getAppPath();
		// superbuilder/apps/desktop → superbuilder → ../superbuilder-features/features
		const sibling = join(appPath, "..", "..", "..", "superbuilder-features", "features");
		if (existsSync(sibling)) return sibling;
	} catch {}

	throw new Error(
		"Feature source not found. Set SUPERBUILDER_FEATURES_PATH env var or clone superbuilder-features as sibling directory.",
	);
}

let cachedRegistry: FeatureRegistry | null = null;

function getRegistry(): FeatureRegistry {
	if (cachedRegistry) return cachedRegistry;
	const featuresDir = getFeaturesDir();
	const manifests = scanFeatureManifests(featuresDir);
	cachedRegistry = manifestsToRegistry(manifests);
	return cachedRegistry;
}

export const createAtlasRegistryRouter = () =>
	router({
		getRegistry: publicProcedure.query(() => {
			const registry = getRegistry();
			return { registry, errors: [] };
		}),

		listFeatures: publicProcedure.query(() => {
			const registry = getRegistry();
			return Object.entries(registry.features).map(([id, entry]) => ({
				id,
				...entry,
			}));
		}),

		getFeature: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(({ input }) => {
				const registry = getRegistry();
				const entry = registry.features[input.id];
				if (!entry) throw new Error(`Feature not found: ${input.id}`);
				return { id: input.id, ...entry };
			}),

		getGroups: publicProcedure.query(() => {
			const registry = getRegistry();
			return registry.groups;
		}),

		// Invalidate cache (for development)
		invalidateCache: publicProcedure.mutation(() => {
			cachedRegistry = null;
			return { success: true };
		}),
	});
