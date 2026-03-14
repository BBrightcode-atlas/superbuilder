import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadManifest } from "../manifest/local";
import { removeFeatures } from "./feature-remover";
import type { ScaffoldInput, ScaffoldResult } from "./types";

const execFile = promisify(execFileCb);

const DEFAULT_BOILERPLATE = "BBrightcode-atlas/superbuilder-app-boilerplate";

/**
 * Boilerplate 기반 프로젝트 생성
 *
 * 1. Boilerplate repo clone (shallow)
 * 2. manifest 로드
 * 3. 유지할 피처 + core + 의존성 계산
 * 4. 불필요 피처 제거
 * 5. .claude/settings.json 생성
 * 6. git init
 */
export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
	const repo = input.boilerplateRepo ?? DEFAULT_BOILERPLATE;

	// 1. Clone
	await execFile("gh", [
		"repo",
		"clone",
		repo,
		input.targetDir,
		"--",
		"--depth=1",
	]);
	await rm(join(input.targetDir, ".git"), { recursive: true, force: true });
	await updatePackageName(input.targetDir, input.projectName);

	// 2. Load manifest
	const loaded = await loadManifest(input.targetDir);
	if (!loaded) {
		throw new Error(
			"Boilerplate에 superbuilder.json이 없습니다. " +
				"boilerplate repo에 manifest를 먼저 생성하세요.",
		);
	}
	const manifest = loaded;

	// 3. 유지할 피처 계산 (선택 + core + 의존성)
	const allFeatures = Object.keys(manifest.features);
	const keepSet = new Set(input.featuresToKeep);

	for (const [name, entry] of Object.entries(manifest.features)) {
		if (entry.group === "core") keepSet.add(name);
	}

	// 의존성 재귀 추가
	const addDeps = (name: string) => {
		if (!manifest.features[name]) return;
		for (const dep of manifest.features[name].dependencies) {
			if (!keepSet.has(dep)) {
				keepSet.add(dep);
				addDeps(dep);
			}
		}
	};
	for (const name of [...keepSet]) addDeps(name);

	const featuresToRemove = allFeatures.filter((f) => !keepSet.has(f));

	// 4. 불필요 피처 제거
	let removedFeatures: string[] = [];
	if (featuresToRemove.length > 0) {
		const result = await removeFeatures({
			projectPath: input.targetDir,
			featuresToRemove,
			manifest,
		});
		removedFeatures = result.removed;
	}

	// 5. .claude/settings.json
	await writeClaudeSettings(input.targetDir);

	// 6. git init
	await execFile("git", ["init", "--initial-branch=main"], {
		cwd: input.targetDir,
	});
	await execFile("git", ["add", "."], { cwd: input.targetDir });
	await execFile(
		"git",
		["commit", "-m", "Initial commit from Superbuilder Composer"],
		{ cwd: input.targetDir },
	);

	const updatedManifest = await loadManifest(input.targetDir);

	return {
		projectDir: input.targetDir,
		manifest: updatedManifest ?? manifest,
		removedFeatures,
		keptFeatures: [...keepSet],
	};
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
