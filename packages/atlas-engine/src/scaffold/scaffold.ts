import { cloneTemplate, initGitRepo } from "./template-clone";
import { buildProjectSpec, writeProjectSpec } from "./spec-writer";
import { writeInstallWorkflow } from "./workflow-writer";
import { DEFAULT_PATH_MAPPING } from "./path-mapping";
import type { ScaffoldInput, ScaffoldResult } from "./types";

export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
	// 1. Clone template
	const projectDir = await cloneTemplate({
		targetDir: input.targetDir,
		projectName: input.projectName,
	});

	// 2. Build and write superbuilder.json
	const spec = buildProjectSpec({
		name: input.projectName,
		description: input.description,
		config: input.config,
		resolved: input.resolved,
		pathMapping: DEFAULT_PATH_MAPPING,
	});
	await writeProjectSpec(projectDir, spec);

	// 3. Write install workflow for CLI agent
	await writeInstallWorkflow(projectDir, {
		resolvedFeatureNames: input.resolved.resolved,
		featureRegistry: input.registry,
		sourceRepo: input.sourceRepoPath,
	});

	// 4. Git init
	await initGitRepo(projectDir);

	return { projectDir, spec };
}
