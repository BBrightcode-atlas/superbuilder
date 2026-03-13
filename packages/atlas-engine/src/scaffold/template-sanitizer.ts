import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

/**
 * Template Sanitizer
 *
 * 템플릿 클론 후 ATLAS 마커 사이의 stale content를 제거하고,
 * 마커 기반이 아닌 stale feature import를 정리합니다.
 */

/** ATLAS 마커 사이의 내용을 비웁니다 */
function cleanAtlasMarkers(content: string): string {
	return content.replace(
		/\/\/\s*\[ATLAS:(\w+)\]\n[\s\S]*?\/\/\s*\[\/ATLAS:\1\]/g,
		(_, markerName) => `// [ATLAS:${markerName}]\n// [/ATLAS:${markerName}]`,
	);
}

/** 특정 파일의 stale feature import를 정리합니다 */
async function sanitizeFile(filePath: string, cleanFn: (content: string) => string): Promise<void> {
	try {
		const content = await readFile(filePath, "utf-8");
		const cleaned = cleanFn(content);
		if (cleaned !== content) {
			await writeFile(filePath, cleaned, "utf-8");
		}
	} catch {
		// 파일이 없으면 무시
	}
}

/** schema-registry.ts에서 feature import만 제거하고 core는 유지 */
function cleanSchemaRegistry(content: string): string {
	const lines = content.split("\n");
	const cleanedLines = lines.filter((line) => {
		// feature import 제거 (core는 유지)
		if (line.match(/^import \* as \w+ from "\.\/schema\/features\//)) {
			return false;
		}
		// feature spread 제거 (core는 유지)
		if (line.match(/^\s*\.\.\.(?!auth|profiles|files|reviews|rolePermission)\w+,?\s*$/) && !line.includes("// Core")) {
			return false;
		}
		// feature 주석 섹션 제거
		if (line.match(/^\s*\/\/\s*(Features|System|Content|Data|Family|Agent|AI|Task|Story|Feature Catalog)/) && !line.includes("Core")) {
			return false;
		}
		return true;
	});

	// ATLAS 마커 추가 (없으면)
	let result = cleanedLines.join("\n");
	if (!result.includes("[ATLAS:SCHEMA_IMPORTS]")) {
		result = result.replace(
			/(import \* as rolePermission.*\n)/,
			"$1// [ATLAS:SCHEMA_IMPORTS]\n// [/ATLAS:SCHEMA_IMPORTS]\n",
		);
	}
	if (!result.includes("[ATLAS:SCHEMA_SPREAD]")) {
		result = result.replace(
			/(\s*\.\.\.rolePermission,?\n)/,
			"$1  // [ATLAS:SCHEMA_SPREAD]\n  // [/ATLAS:SCHEMA_SPREAD]\n",
		);
	}
	return result;
}

/** feature-i18n.ts — ATLAS 마커 사이 정리 (마커가 있으면) + 마커 없는 stale import 제거 */
function cleanFeatureI18n(content: string): string {
	let result = cleanAtlasMarkers(content);
	// 마커 밖의 stale feature import도 제거
	result = result.replace(/import \* as \w+Locales from "\.\.\/features\/\w+\/locales";\n/g, "");
	return result;
}

/** layout shell 파일에서 존재하지 않는 feature import 제거 */
async function sanitizeLayoutShells(appDir: string): Promise<void> {
	const layoutBlocksDir = join(appDir, "src/layouts/blocks");

	async function processDir(dir: string): Promise<void> {
		let entries: Awaited<ReturnType<typeof readdir>>;
		try {
			entries = await readdir(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);
			if (stats.isDirectory()) {
				await processDir(fullPath);
			} else if (extname(entry) === ".tsx" || extname(entry) === ".ts") {
				await sanitizeFile(fullPath, (content) => {
					// @features/ import를 주석처리하지 않고 해당 줄 제거
					// 해당 feature 디렉토리가 없으면 제거
					let cleaned = content;
					// 단일행 + 멀티행 import 모두 처리
					// @/features/ 또는 @features/ 또는 @repo/widgets/ import 제거
					cleaned = cleaned.replace(
						/^import\s+[\s\S]*?from\s+["']@\/features\/[^"']+["'];?\n/gm,
						"",
					);
					cleaned = cleaned.replace(
						/^import\s+[\s\S]*?from\s+["']@features\/[^"']+["'];?\n/gm,
						"",
					);
					cleaned = cleaned.replace(
						/^import\s+[\s\S]*?from\s+["']@repo\/widgets\/[^"']+["'];?\n/gm,
						"",
					);
					return cleaned;
				});
			}
		}
	}

	await processDir(layoutBlocksDir);
}

/** tsconfig.json에 @features/* path alias 추가 (없으면) */
async function ensureFeaturesPathAlias(appDir: string): Promise<void> {
	const tsconfigPath = join(appDir, "tsconfig.json");
	await sanitizeFile(tsconfigPath, (content) => {
		if (content.includes('"@features/*"')) return content;
		return content.replace(
			'"@/*": ["./src/*"]',
			'"@/*": ["./src/*"],\n      "@features/*": ["./src/features/*"]',
		);
	});
}

/**
 * 템플릿 프로젝트를 sanitize합니다.
 * 클론 직후, feature 설치 전에 실행됩니다.
 */
export async function sanitizeTemplate(projectDir: string): Promise<void> {
	// 1. ATLAS 마커가 있는 파일들 정리
	const markerFiles = [
		"apps/atlas-server/src/app.module.ts",
		"apps/atlas-server/src/trpc/router.ts",
		"apps/app/src/router.tsx",
		"packages/drizzle/src/schema/index.ts",
		"packages/drizzle/drizzle.config.ts",
		"packages/features/app-router.ts",
	];

	for (const file of markerFiles) {
		await sanitizeFile(join(projectDir, file), cleanAtlasMarkers);
	}

	// 2. schema-registry.ts 정리
	await sanitizeFile(
		join(projectDir, "packages/drizzle/src/schema-registry.ts"),
		cleanSchemaRegistry,
	);

	// 3. feature-i18n.ts 정리
	await sanitizeFile(
		join(projectDir, "apps/app/src/lib/feature-i18n.ts"),
		cleanFeatureI18n,
	);

	// 4. Layout shell 파일 정리
	await sanitizeLayoutShells(join(projectDir, "apps/app"));

	// 5. @features/* path alias 확인
	await ensureFeaturesPathAlias(join(projectDir, "apps/app"));
}
