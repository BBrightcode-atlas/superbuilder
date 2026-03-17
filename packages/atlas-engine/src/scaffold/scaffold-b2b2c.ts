import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { applyConnectionsB2B2C } from "../connection/apply-connections-b2b2c";
import { scanFeatureManifests } from "../manifest/scanner";
import { copyFeaturesB2B2C } from "./copy-features-b2b2c";
import { generateLandingPages } from "./landing-page-generator";
import { transformDirectory } from "./transform-files";
import type { ScaffoldInput, ScaffoldResult } from "./types";
import { updateFeatureExports } from "./update-package-exports";

const execFile = promisify(execFileCb);
const DEFAULT_TEMPLATE = "BBrightcode-atlas/superbuilder-app-boilerplate";
const DEFAULT_FEATURES_REPO = "BBrightcode-atlas/superbuilder-features";

/**
 * B2B2C 프로젝트 생성 오케스트레이터.
 *
 * SaaS scaffold와 동일한 구조이지만 다음 점이 다르다:
 * - apps/app 대신 apps/landing 포함 (client 슬롯 없음)
 * - provides.client는 있으나 provides.landing이 없는 feature에 경고 출력
 * - copyFeaturesB2B2C → B2B2C 경로 슬롯 사용
 * - applyConnectionsB2B2C → landing 마커 포함, client 마커 제외
 * - generateLandingPages → provides.landing.pages 기반 Next.js 페이지 생성
 * - apps/admin/src/lib/project.ts에서 APP_MODE를 "b2b2c"로 설정
 */
export async function scaffoldB2B2C(
	input: ScaffoldInput,
): Promise<ScaffoldResult> {
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
	await updateSuperbuilderJson(input.targetDir, input.projectName);

	// 2. Resolve features source
	const featuresDir = await resolveFeaturesSource(input);

	// 3. Scan feature manifests
	const allManifests = scanFeatureManifests(featuresDir);
	const selectedManifests = allManifests.filter((m) =>
		input.featuresToKeep.includes(m.id),
	);

	// 4. Warn for features with provides.client but no provides.landing
	for (const manifest of selectedManifests) {
		if (manifest.provides.client && !manifest.provides.landing) {
			console.warn(
				`⚠ Feature "${manifest.id}" provides.client가 있지만 provides.landing이 없습니다. B2B2C 모드에서는 landing이 필요합니다.`,
			);
		}
	}

	// 5. Copy feature code (B2B2C slots: server, admin, schema, widgets, landing)
	await copyFeaturesB2B2C({
		templateDir: input.targetDir,
		featuresSourceDir: featuresDir,
		featureIds: input.featuresToKeep,
		manifests: selectedManifests,
	});

	// 6. Transform imports (@superbuilder/* → @repo/*)
	// B2B2C: apps/app/src/features 제외, apps/landing/src/features 포함
	await transformDirectory(join(input.targetDir, "packages/features"));
	await transformDirectory(join(input.targetDir, "apps/admin/src/features"));
	await transformDirectory(
		join(input.targetDir, "packages/drizzle/src/schema/features"),
	);
	await transformDirectory(join(input.targetDir, "packages/widgets/src"));
	await transformDirectory(
		join(input.targetDir, "apps/landing/src/features"),
	);

	// 7. Apply connections (insert at [ATLAS:*] markers) — B2B2C variant
	for (const manifest of selectedManifests) {
		applyConnectionsB2B2C(input.targetDir, manifest);
	}

	// 8. Generate landing pages from provides.landing.pages
	await generateLandingPages(input.targetDir, selectedManifests);

	// 9. Set APP_MODE to "b2b2c" in apps/admin/src/lib/project.ts
	await setAdminAppMode(input.targetDir);

	// 10. Update package exports
	await updateFeatureExports(
		input.targetDir,
		input.featuresToKeep,
		selectedManifests,
	);

	// 11. Write .claude/settings.json
	await writeClaudeSettings(input.targetDir);

	// 12. Git init + commit
	await execFile("git", ["init", "--initial-branch=main"], {
		cwd: input.targetDir,
	});
	await execFile("git", ["add", "."], { cwd: input.targetDir });
	await execFile(
		"git",
		["commit", "-m", "Initial commit from Superbuilder Composer (B2B2C)"],
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

async function updateSuperbuilderJson(
	dir: string,
	projectName: string,
): Promise<void> {
	const jsonPath = join(dir, "superbuilder.json");
	try {
		const raw = await readFile(jsonPath, "utf-8");
		const data = JSON.parse(raw);
		data.project = { ...data.project, name: projectName };
		await writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	} catch {
		// superbuilder.json missing — non-fatal
	}
}

async function updatePackageName(dir: string, name: string): Promise<void> {
	const pkgPath = join(dir, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);
	pkg.name = name;
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

async function setAdminAppMode(dir: string): Promise<void> {
	const projectTsPath = join(dir, "apps/admin/src/lib/project.ts");
	try {
		const raw = await readFile(projectTsPath, "utf-8");
		const updated = raw.replace(
			/APP_MODE\s*=\s*["'][^"']*["']/,
			'APP_MODE = "b2b2c"',
		);
		await writeFile(projectTsPath, updated, "utf-8");
	} catch {
		// File may not exist in all boilerplate versions — non-fatal
	}
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
