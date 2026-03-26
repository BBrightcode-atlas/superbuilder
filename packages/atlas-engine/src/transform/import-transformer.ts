import { DYNAMIC_IMPORT_PATTERNS, STATIC_IMPORT_MAP } from "./import-map";

export function transformImportPath(importPath: string): string | null {
	// Exact match first
	if (STATIC_IMPORT_MAP[importPath]) {
		return STATIC_IMPORT_MAP[importPath];
	}
	// Prefix match for subpaths (e.g. @superbuilder/core-ui/shadcn/card → @repo/ui/shadcn/card)
	for (const [from, to] of Object.entries(STATIC_IMPORT_MAP)) {
		if (importPath.startsWith(`${from}/`)) {
			return `${to}${importPath.slice(from.length)}`;
		}
	}
	for (const { pattern, replacement } of DYNAMIC_IMPORT_PATTERNS) {
		const match = importPath.match(pattern);
		if (match) {
			return importPath.replace(pattern, replacement);
		}
	}
	return null;
}

export function transformImports(source: string): string {
	let result = source.replace(
		/(?:from\s+|import\s*\()(['"])(@superbuilder\/[^'"]+)\1/g,
		(match, quote, importPath) => {
			const transformed = transformImportPath(importPath);
			if (transformed) {
				return match.replace(
					`${quote}${importPath}${quote}`,
					`${quote}${transformed}${quote}`,
				);
			}
			return match;
		},
	);

	// Rewrite relative schema imports (../schema, ../../schema, etc.)
	// In feature-json layout, server code lives in packages/features/{name}/
	// but schema lives in packages/drizzle/src/schema/features/{name}/
	// So relative ../schema or ../../schema imports must become @repo/drizzle
	result = result.replace(
		/(?:from\s+|import\s*\()(['"])(\.\.\/(?:\.\.\/)*schema(?:\/[^'"]*)?)\1/g,
		(match, quote, importPath) => {
			return match.replace(
				`${quote}${importPath}${quote}`,
				`${quote}@repo/drizzle${quote}`,
			);
		},
	);

	return result;
}
