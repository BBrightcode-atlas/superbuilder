export const STATIC_IMPORT_MAP: Record<string, string> = {
  "@superbuilder/core-auth": "@repo/core/auth",
  "@superbuilder/core-trpc": "@repo/core/trpc",
  "@superbuilder/core-db": "@repo/drizzle",
  "@superbuilder/core-schema": "@repo/drizzle",
  "@superbuilder/core-logger": "@repo/core/logger",
  "@superbuilder/core-ui": "@repo/ui",
};

export const DYNAMIC_IMPORT_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  {
    pattern: /^@superbuilder\/feature-([^/]+)\/widget$/,
    replacement: "@repo/widgets/$1",
  },
  {
    pattern: /^@superbuilder\/feature-([^/]+)\/schema$/,
    replacement: "@repo/drizzle",
  },
  {
    pattern: /^@superbuilder\/feature-([^/]+)\/common$/,
    replacement: "@repo/features/$1",
  },
  {
    pattern: /^@superbuilder\/feature-([^/]+)$/,
    replacement: "@repo/features/$1",
  },
];
