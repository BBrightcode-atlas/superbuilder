import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { saveManifest } from "../manifest/local";
import type {
	BoilerplateManifest,
	FeatureConnection,
	ManifestFeature,
} from "../manifest/types";
import type { RemoveInput, RemoveResult } from "./types";

/**
 * Feature Remover
 *
 * Boilerplate에서 클론한 프로젝트에서 불필요한 feature를 제거합니다.
 *
 * 1. 제거 대상의 역의존성(dependents) 확인 → 함께 제거
 * 2. Core feature 제거 방지
 * 3. Feature 디렉토리 삭제
 * 4. Marker 기반 connection 정리
 * 5. Manifest 업데이트
 */
export async function removeFeatures(
	input: RemoveInput,
): Promise<RemoveResult> {
	const { projectPath, featuresToRemove, manifest } = input;

	// 1. 역의존성 포함한 전체 제거 목록
	const toRemove = resolveRemovalSet(featuresToRemove, manifest);

	// 2. Core feature 제거 방지
	const blocked = toRemove.filter(
		(f) => manifest.features[f]?.group === "core",
	);
	if (blocked.length > 0) {
		throw new Error(`Cannot remove core features: ${blocked.join(", ")}`);
	}

	// 3. Feature 디렉토리 삭제
	for (const name of toRemove) {
		const entry = manifest.features[name];
		if (!entry) continue;
		await removeDirectories(projectPath, entry);
	}

	// 4. Marker connection 정리
	const allConnections = toRemove.flatMap(
		(name) => manifest.features[name]?.connections ?? [],
	);
	await cleanConnections(projectPath, allConnections);

	// 5. Manifest 업데이트
	const updated: BoilerplateManifest = {
		...manifest,
		features: { ...manifest.features },
	};
	for (const name of toRemove) {
		delete updated.features[name];
	}
	for (const entry of Object.values(updated.features)) {
		entry.dependents = entry.dependents.filter((d) => !toRemove.includes(d));
	}
	await saveManifest(projectPath, updated);

	return {
		removed: toRemove,
		kept: Object.keys(updated.features),
		manifest: updated,
	};
}

/**
 * 역의존성 캐스케이드: A가 B에 의존하고 B를 제거하면 A도 제거
 */
function resolveRemovalSet(
	requested: string[],
	manifest: BoilerplateManifest,
): string[] {
	const toRemove = new Set(requested);
	let changed = true;

	while (changed) {
		changed = false;
		for (const [name, entry] of Object.entries(manifest.features)) {
			if (toRemove.has(name)) continue;
			if (entry.dependencies.some((dep) => toRemove.has(dep))) {
				toRemove.add(name);
				changed = true;
			}
		}
	}

	return [...toRemove];
}

async function removeDirectories(
	projectPath: string,
	entry: ManifestFeature,
): Promise<void> {
	for (const path of Object.values(entry.paths)) {
		if (path) {
			await rm(join(projectPath, path), { recursive: true, force: true });
		}
	}
}

async function cleanConnections(
	projectPath: string,
	connections: FeatureConnection[],
): Promise<void> {
	const byFile = new Map<string, FeatureConnection[]>();
	for (const conn of connections) {
		const list = byFile.get(conn.file) ?? [];
		list.push(conn);
		byFile.set(conn.file, list);
	}

	for (const [file, conns] of byFile) {
		const filePath = join(projectPath, file);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			continue;
		}

		let modified = content;
		for (const conn of conns) {
			modified = removeFromMarkerBlock(modified, conn.marker, conn.content);
		}

		if (modified !== content) {
			await writeFile(filePath, modified, "utf-8");
		}
	}
}

function removeFromMarkerBlock(
	fileContent: string,
	markerName: string,
	lineToRemove: string,
): string {
	const startMarker = `// [ATLAS:${markerName}]`;
	const endMarker = `// [/ATLAS:${markerName}]`;
	const startIdx = fileContent.indexOf(startMarker);
	const endIdx = fileContent.indexOf(endMarker);

	if (startIdx === -1 || endIdx === -1) {
		const trimmed = lineToRemove.trim();
		return fileContent
			.split("\n")
			.filter((line) => line.trim() !== trimmed)
			.join("\n");
	}

	const before = fileContent.slice(0, startIdx + startMarker.length);
	const markerContent = fileContent.slice(
		startIdx + startMarker.length,
		endIdx,
	);
	const after = fileContent.slice(endIdx);
	const trimmedTarget = lineToRemove.trim();
	const cleanedLines = markerContent
		.split("\n")
		.filter((line) => line.trim() !== trimmedTarget);

	return before + cleanedLines.join("\n") + after;
}

/**
 * 제거 워크플로우 마크다운 생성 (CLI agent용)
 */
export function generateRemovalWorkflow(
	featuresToRemove: string[],
	manifest: BoilerplateManifest,
): string {
	const fullSet = resolveRemovalSet(featuresToRemove, manifest);
	const autoRemoved = fullSet.filter((f) => !featuresToRemove.includes(f));

	let md = "# Feature 제거 워크플로우\n\n";

	if (autoRemoved.length > 0) {
		md += "## 자동 제거 대상 (의존성)\n\n";
		for (const name of autoRemoved) {
			const deps = manifest.features[name]?.dependencies.filter((d) =>
				featuresToRemove.includes(d),
			);
			md += `- **${name}** (depends on: ${deps?.join(", ")})\n`;
		}
		md += "\n";
	}

	md += `## 제거 목록 (${fullSet.length}개)\n\n`;
	for (const name of fullSet) {
		const entry = manifest.features[name];
		if (!entry) continue;

		md += `### ${name}\n\n`;
		md += "**삭제:**\n";
		for (const [, path] of Object.entries(entry.paths)) {
			if (path) md += `- \`rm -rf ${path}\`\n`;
		}
		if (entry.connections.length > 0) {
			md += "\n**Connection 정리:**\n";
			for (const conn of entry.connections) {
				md += `- \`${conn.file}\` [ATLAS:${conn.marker}]: \`${conn.content}\`\n`;
			}
		}
		md += "\n";
	}

	return md;
}
