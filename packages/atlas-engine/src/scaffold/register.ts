import { execFile as execFileCb } from "node:child_process";
import { cp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadManifest, saveManifest } from "../manifest/local";
import type { FeatureConnection, ManifestFeature } from "../manifest/types";

const execFile = promisify(execFileCb);

const DEFAULT_BOILERPLATE_REPO =
	"BBrightcode-atlas/superbuilder-app-boilerplate";

export interface RegisterInput {
	/** 피처 이름 (key) */
	featureName: string;
	/** 피처 메타데이터 */
	feature: ManifestFeature;
	/** 피처 코드가 있는 로컬 경로 (worktree 또는 temp dir) */
	sourceDir: string;
	/** Boilerplate repo의 로컬 clone 경로 */
	boilerplatePath: string;
	/** Boilerplate GitHub repo (default: superbuilder-app-boilerplate) */
	boilerplateRepo?: string;
	/** PR 생성 여부 (default: true) */
	createPR?: boolean;
}

export interface RegisterResult {
	/** 생성된 branch 이름 */
	branch: string;
	/** PR URL (createPR=true인 경우) */
	prUrl?: string;
	/** 복사된 경로 목록 */
	copiedPaths: string[];
	/** 삽입된 connection 수 */
	connectionsInjected: number;
}

/**
 * 새 피처를 boilerplate repo에 등록합니다.
 *
 * 1. Boilerplate repo에 feature branch 생성 (기존 branch 처리)
 * 2. 피처 코드를 해당 경로에 복사
 * 3. Marker 블록에 connection 코드 삽입
 * 4. superbuilder.json에 피처 항목 추가
 * 5. Commit + PR 생성
 */
export async function registerToBoilerplate(
	input: RegisterInput,
): Promise<RegisterResult> {
	const {
		featureName,
		feature,
		sourceDir,
		boilerplatePath,
		boilerplateRepo = DEFAULT_BOILERPLATE_REPO,
		createPR = true,
	} = input;

	const branchName = `feature/${featureName}`;

	// 1. Feature branch 생성 (기존 branch 있으면 삭제 후 재생성)
	try {
		await execFile("git", ["branch", "-D", branchName], {
			cwd: boilerplatePath,
		});
	} catch {
		// branch가 없으면 무시
	}
	await execFile("git", ["checkout", "-b", branchName], {
		cwd: boilerplatePath,
	});

	// 2. 피처 코드 복사
	const copiedPaths: string[] = [];

	for (const [, targetRelPath] of Object.entries(feature.paths)) {
		if (!targetRelPath) continue;

		const sourcePath = join(sourceDir, targetRelPath);
		const targetPath = join(boilerplatePath, targetRelPath);

		if (await dirExists(sourcePath)) {
			await cp(sourcePath, targetPath, { recursive: true });
			copiedPaths.push(targetRelPath);
		}
	}

	// 3. Marker 블록에 connection 코드 삽입
	const connectionsInjected = await injectConnections(
		boilerplatePath,
		feature.connections,
	);

	// 4. superbuilder.json 업데이트
	const manifest = await loadManifest(boilerplatePath);
	if (!manifest) {
		throw new Error("superbuilder.json not found in boilerplate repo");
	}

	manifest.features[featureName] = feature;

	// dependents 업데이트
	for (const dep of feature.dependencies) {
		if (manifest.features[dep]) {
			if (!manifest.features[dep].dependents.includes(featureName)) {
				manifest.features[dep].dependents.push(featureName);
			}
		}
	}

	manifest.source.syncedAt = new Date().toISOString();
	await saveManifest(boilerplatePath, manifest);

	// 5. Commit
	await execFile("git", ["add", "-A"], { cwd: boilerplatePath });
	await execFile("git", ["commit", "-m", `feat: add ${featureName} feature`], {
		cwd: boilerplatePath,
	});

	// 6. Push + PR
	let prUrl: string | undefined;

	await execFile("git", ["push", "-u", "origin", branchName], {
		cwd: boilerplatePath,
	});

	if (createPR) {
		const { stdout } = await execFile(
			"gh",
			[
				"pr",
				"create",
				"--repo",
				boilerplateRepo,
				"--title",
				`feat: add ${featureName} feature`,
				"--body",
				buildPRBody(featureName, feature, copiedPaths),
			],
			{ cwd: boilerplatePath },
		);
		prUrl = stdout.trim();
	}

	return { branch: branchName, prUrl, copiedPaths, connectionsInjected };
}

/**
 * Marker 블록에 connection 코드를 삽입합니다.
 *
 * // [ATLAS:IMPORTS]
 * (기존 내용)
 * import { NewModule } from "@repo/features/new";  ← 여기에 추가
 * // [/ATLAS:IMPORTS]
 */
async function injectConnections(
	boilerplatePath: string,
	connections: FeatureConnection[],
): Promise<number> {
	const byFile = new Map<string, FeatureConnection[]>();
	for (const conn of connections) {
		const list = byFile.get(conn.file) ?? [];
		list.push(conn);
		byFile.set(conn.file, list);
	}

	let injected = 0;

	for (const [file, conns] of byFile) {
		const filePath = join(boilerplatePath, file);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			continue;
		}

		let modified = content;
		for (const conn of conns) {
			const result = insertIntoMarkerBlock(modified, conn.marker, conn.content);
			if (result !== modified) {
				modified = result;
				injected++;
			}
		}

		if (modified !== content) {
			await writeFile(filePath, modified, "utf-8");
		}
	}

	return injected;
}

/**
 * Marker 블록의 닫는 태그 바로 앞에 새 줄을 삽입합니다.
 */
function insertIntoMarkerBlock(
	fileContent: string,
	markerName: string,
	lineToInsert: string,
): string {
	const endMarker = `// [/ATLAS:${markerName}]`;
	const endIdx = fileContent.indexOf(endMarker);

	if (endIdx === -1) return fileContent;

	// 이미 존재하면 중복 삽입 방지
	if (fileContent.includes(lineToInsert.trim())) return fileContent;

	const before = fileContent.slice(0, endIdx);
	const after = fileContent.slice(endIdx);

	return `${before}${lineToInsert}\n${after}`;
}

function buildPRBody(
	name: string,
	feature: ManifestFeature,
	paths: string[],
): string {
	let body = `## New Feature: ${name}\n\n`;
	body += `- **Type**: ${feature.type}\n`;
	body += `- **Group**: ${feature.group}\n`;
	if (feature.dependencies.length > 0) {
		body += `- **Dependencies**: ${feature.dependencies.join(", ")}\n`;
	}
	if (feature.tables.length > 0) {
		body += `- **Tables**: ${feature.tables.join(", ")}\n`;
	}
	body += `\n### Paths\n\n`;
	for (const p of paths) {
		body += `- \`${p}\`\n`;
	}
	body += `\n### Connections\n\n`;
	body += `${feature.connections.length} marker-based connections added.\n`;
	return body;
}

async function dirExists(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}
