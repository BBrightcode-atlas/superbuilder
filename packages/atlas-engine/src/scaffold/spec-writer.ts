import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PathMapping, ProjectConfig, ProjectSpec } from "./types";
import type { ResolvedFeatures } from "../resolver/types";

const TEMPLATE_REPO = "BBrightcode-atlas/feature-atlas-template";
const TEMPLATE_VERSION = "1.0.0";
const SOURCE_REPO = "BBrightcode-atlas/superbuilder";

export function buildProjectSpec(opts: {
	name: string;
	description?: string;
	config: ProjectConfig;
	resolved: ResolvedFeatures;
	pathMapping: PathMapping;
}): ProjectSpec {
	return {
		name: opts.name,
		version: "0.1.0",
		description: opts.description ?? "",
		source: {
			type: "superbuilder",
			repo: SOURCE_REPO,
			branch: "develop",
			templateRepo: TEMPLATE_REPO,
			templateVersion: TEMPLATE_VERSION,
			createdAt: new Date().toISOString(),
		},
		config: opts.config,
		features: {
			selected: opts.resolved.selected,
			resolved: opts.resolved.resolved,
			autoIncluded: opts.resolved.autoIncluded,
		},
		installed: {},
		pathMapping: opts.pathMapping,
	};
}

export async function writeProjectSpec(
	projectDir: string,
	spec: ProjectSpec,
): Promise<void> {
	const specPath = join(projectDir, "superbuilder.json");
	await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf-8");
}
