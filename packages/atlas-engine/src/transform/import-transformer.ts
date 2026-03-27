/**
 * Transform imports in feature source files during scaffold.
 *
 * After the @superbuilder/* → @repo/* migration, the only remaining transform
 * is rewriting relative schema imports. Feature code in superbuilder-features
 * uses relative paths (../../schema) to import its own schema, but after
 * scaffold the schema lives in packages/drizzle/src/schema/features/{name}/
 * while server code lives in packages/features/{name}/, so relative paths break.
 */
export function transformImports(source: string): string {
	// Rewrite relative schema imports (../schema, ../../schema, etc.)
	// to @repo/drizzle/schema which re-exports all feature schemas via ATLAS markers
	return source.replace(
		/(?:from\s+|import\s*\()(['"])(\.\.\/(?:\.\.\/)*schema(?:\/[^'"]*)?)\1/g,
		(match, quote, _importPath) => {
			return match.replace(
				`${quote}${_importPath}${quote}`,
				`${quote}@repo/drizzle/schema${quote}`,
			);
		},
	);
}
