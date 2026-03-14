import { DYNAMIC_IMPORT_PATTERNS, STATIC_IMPORT_MAP } from "./import-map";

export function transformImportPath(importPath: string): string | null {
	if (STATIC_IMPORT_MAP[importPath]) {
		return STATIC_IMPORT_MAP[importPath];
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
	return source.replace(
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
}
