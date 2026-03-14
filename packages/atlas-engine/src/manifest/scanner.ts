import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureManifest } from "./types";

export function scanFeatureManifests(featuresDir: string): FeatureManifest[] {
	if (!existsSync(featuresDir)) return [];

	const entries = readdirSync(featuresDir, { withFileTypes: true });
	const manifests: FeatureManifest[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

		const manifestPath = join(featuresDir, entry.name, "feature.json");
		if (!existsSync(manifestPath)) continue;

		try {
			const content = readFileSync(manifestPath, "utf-8");
			const manifest = JSON.parse(content) as FeatureManifest;
			if (!manifest.optionalDependencies) {
				manifest.optionalDependencies = [];
			}
			manifests.push(manifest);
		} catch {
			console.warn(`Warning: Failed to parse ${manifestPath}`);
		}
	}

	return manifests.sort((a, b) => a.id.localeCompare(b.id));
}
