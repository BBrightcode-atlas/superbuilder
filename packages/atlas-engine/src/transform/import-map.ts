/**
 * Import maps are now empty — features use @repo/* natively.
 * Kept as empty maps so transform-files.ts continues to compile.
 * The relative-path schema rewrite in import-transformer.ts still applies.
 */
export const STATIC_IMPORT_MAP: Record<string, string> = {};

export const DYNAMIC_IMPORT_PATTERNS: Array<{
	pattern: RegExp;
	replacement: string;
}> = [];
