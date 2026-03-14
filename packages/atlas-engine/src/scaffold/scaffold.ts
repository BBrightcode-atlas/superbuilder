import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { applyConnections } from "../connection/apply-connections";
import { scanFeatureManifests } from "../manifest/scanner";
import { copyFeaturesToTemplate } from "./copy-features";
import { transformDirectory } from "./transform-files";
import type { ScaffoldInput, ScaffoldResult } from "./types";
import { updateFeatureExports } from "./update-package-exports";

const execFile = promisify(execFileCb);
const DEFAULT_TEMPLATE = "BBrightcode-atlas/superbuilder-app-boilerplate";
const DEFAULT_FEATURES_REPO = "BBrightcode-atlas/superbuilder-features";

/**
 * Feature-JSON 기반 프로젝트 생성
 *
 * 1. Empty template repo clone (shallow)
 * 2. Features source 해석 (local / env / remote)
 * 3. Feature manifests 스캔
 * 4. 선택된 feature 코드 복사
 * 5. Import 변환 (@superbuilder/* → @repo/*)
 * 6. Connection 적용 ([ATLAS:*] markers)
 * 7. Package exports 업데이트
 * 8. .claude/settings.json 생성
 * 9. git init + commit
 */
export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
	const templateRepo = input.templateRepo ?? DEFAULT_TEMPLATE;

	// 1. Clone empty template
	await execFile("gh", [
		"repo",
		"clone",
		templateRepo,
		input.targetDir,
		"--",
		"--depth=1",
	]);
	await rm(join(input.targetDir, ".git"), { recursive: true, force: true });
	await updatePackageName(input.targetDir, input.projectName);

	// 2. Resolve features source
	const featuresDir = await resolveFeaturesSource(input);

	// 3. Scan feature manifests
	const allManifests = scanFeatureManifests(featuresDir);
	const selectedManifests = allManifests.filter((m) =>
		input.featuresToKeep.includes(m.id),
	);

	// 4. Copy feature code
	await copyFeaturesToTemplate({
		templateDir: input.targetDir,
		featuresSourceDir: featuresDir,
		featureIds: input.featuresToKeep,
		manifests: selectedManifests,
	});

	// 5. Transform imports (@superbuilder/* → @repo/*)
	await transformDirectory(join(input.targetDir, "packages/features"));
	await transformDirectory(join(input.targetDir, "apps/app/src/features"));
	await transformDirectory(
		join(input.targetDir, "apps/system-admin/src/features"),
	);
	await transformDirectory(
		join(input.targetDir, "packages/drizzle/src/schema/features"),
	);
	await transformDirectory(join(input.targetDir, "packages/widgets/src"));

	// 6. Apply connections (insert at [ATLAS:*] markers)
	for (const manifest of selectedManifests) {
		applyConnections(input.targetDir, manifest);
	}

	// 7. Update package exports
	await updateFeatureExports(
		input.targetDir,
		input.featuresToKeep,
		selectedManifests,
	);

	// 8. Write .claude/settings.json
	await writeClaudeSettings(input.targetDir);

	// 9. Git init + commit
	await execFile("git", ["init", "--initial-branch=main"], {
		cwd: input.targetDir,
	});
	await execFile("git", ["add", "."], { cwd: input.targetDir });
	await execFile(
		"git",
		["commit", "-m", "Initial commit from Superbuilder Composer"],
		{ cwd: input.targetDir },
	);

	return {
		projectDir: input.targetDir,
		installedFeatures: input.featuresToKeep,
		manifests: selectedManifests,
	};
}

async function resolveFeaturesSource(input: ScaffoldInput): Promise<string> {
	// 1. Direct path
	if (input.featuresSourceDir && existsSync(input.featuresSourceDir)) {
		return input.featuresSourceDir;
	}

	// 2. Environment variable
	const envPath = process.env.SUPERBUILDER_FEATURES_PATH;
	if (envPath) {
		const featuresPath = join(envPath, "features");
		if (existsSync(featuresPath)) return featuresPath;
		if (existsSync(envPath)) return envPath;
	}

	// 3. Clone remote repo
	const repo = input.featuresRepo ?? DEFAULT_FEATURES_REPO;
	const tmpDir = join(tmpdir(), `superbuilder-features-${Date.now()}`);
	await execFile("gh", ["repo", "clone", repo, tmpDir, "--", "--depth=1"]);
	return join(tmpDir, "features");
}

async function updatePackageName(dir: string, name: string): Promise<void> {
	const pkgPath = join(dir, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);
	pkg.name = name;
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

async function writeClaudeSettings(dir: string): Promise<void> {
	const claudeDir = join(dir, ".claude");
	await mkdir(claudeDir, { recursive: true });
	await writeFile(
		join(claudeDir, "settings.json"),
		JSON.stringify(
			{
				permissions: {
					allow: [
						"Bash(*)",
						"Read(*)",
						"Write(*)",
						"Edit(*)",
						"Glob(*)",
						"Grep(*)",
					],
					deny: [],
				},
			},
			null,
			"\t",
		),
		"utf-8",
	);
}
