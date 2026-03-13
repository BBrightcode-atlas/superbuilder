import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cloneTemplate, initGitRepo } from "./template-clone";
import { buildProjectSpec, writeProjectSpec } from "./spec-writer";
import { writeInstallWorkflow } from "./workflow-writer";
import { sanitizeTemplate } from "./template-sanitizer";
import { DEFAULT_PATH_MAPPING } from "./path-mapping";
import type { ScaffoldInput, ScaffoldResult } from "./types";

/**
 * Claude CLI가 workspace trust prompt를 건너뛰도록
 * .claude/settings.json을 미리 생성한다.
 */
async function writeClaudeSettings(projectDir: string): Promise<void> {
	const claudeDir = join(projectDir, ".claude");
	await mkdir(claudeDir, { recursive: true });
	const settings = {
		permissions: {
			allow: [
				"Bash(*)","Read(*)","Write(*)","Edit(*)","Glob(*)","Grep(*)",
			],
			deny: [],
		},
	};
	await writeFile(
		join(claudeDir, "settings.json"),
		JSON.stringify(settings, null, "\t"),
		"utf-8",
	);
}

export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
	// 1. Clone template
	const projectDir = await cloneTemplate({
		targetDir: input.targetDir,
		projectName: input.projectName,
	});

	// 2. Sanitize template — clean stale feature references
	await sanitizeTemplate(projectDir);

	// 3. Build and write superbuilder.json
	const spec = buildProjectSpec({
		name: input.projectName,
		description: input.description,
		config: input.config,
		resolved: input.resolved,
		pathMapping: DEFAULT_PATH_MAPPING,
	});
	await writeProjectSpec(projectDir, spec);

	// 4. Write install workflow for CLI agent
	await writeInstallWorkflow(projectDir, {
		resolvedFeatureNames: input.resolved.resolved,
		featureRegistry: input.registry,
		sourceRepo: input.sourceRepoPath,
	});

	// 5. Write .claude/settings.json (trust prompt 우회)
	await writeClaudeSettings(projectDir);

	// 6. Git init
	await initGitRepo(projectDir);

	return { projectDir, spec };
}
