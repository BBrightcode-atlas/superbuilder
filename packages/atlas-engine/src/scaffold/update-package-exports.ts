import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureManifest } from "../manifest/types";

export async function updateFeatureExports(
	templateDir: string,
	featureIds: string[],
	manifests: FeatureManifest[],
): Promise<void> {
	// Update packages/features/package.json
	const featuresPkgPath = join(templateDir, "packages/features/package.json");
	const featuresPkg = JSON.parse(await readFile(featuresPkgPath, "utf-8"));
	featuresPkg.exports = featuresPkg.exports || {};

	for (const id of featureIds) {
		const manifest = manifests.find((m) => m.id === id);
		if (!manifest) continue;
		if (manifest.provides.server) {
			featuresPkg.exports[`./${id}`] = `./${id}/index.ts`;
		}
	}

	await writeFile(
		featuresPkgPath,
		`${JSON.stringify(featuresPkg, null, 2)}\n`,
		"utf-8",
	);

	// Update packages/widgets/package.json for widget features
	const widgetIds = featureIds.filter((id) => {
		const m = manifests.find((manifest) => manifest.id === id);
		return m?.provides.widget;
	});

	if (widgetIds.length > 0) {
		const widgetsPkgPath = join(templateDir, "packages/widgets/package.json");
		const widgetsPkg = JSON.parse(await readFile(widgetsPkgPath, "utf-8"));
		widgetsPkg.exports = widgetsPkg.exports || {};

		for (const id of widgetIds) {
			widgetsPkg.exports[`./${id}`] = `./src/${id}/index.ts`;
		}

		await writeFile(
			widgetsPkgPath,
			`${JSON.stringify(widgetsPkg, null, 2)}\n`,
			"utf-8",
		);
	}
}
