export interface FeatureDevelopmentPromptInput {
	featureName: string;
	spec: string;
	plan: string;
}

export interface CustomizationPromptInput {
	featureName: string;
	spec: string;
	plan: string;
	previousErrors: string;
	humanFeedback?: string;
}

export function buildFeatureDevelopmentPrompt(
	input: FeatureDevelopmentPromptInput,
): string {
	const { featureName, spec, plan } = input;
	return buildCorePrompt(featureName, spec, plan);
}

export function buildCustomizationPrompt(
	input: CustomizationPromptInput,
): string {
	const { featureName, spec, plan, previousErrors, humanFeedback } = input;

	const sections: string[] = [];

	sections.push(`## Previous Attempt Issues

${previousErrors}`);

	if (humanFeedback) {
		sections.push(`## Human Feedback

${humanFeedback}`);
	}

	sections.push(
		"Fix the issues above. The worktree already contains your previous work.",
	);

	const prefix = sections.join("\n\n");
	const core = buildCorePrompt(featureName, spec, plan);

	return `${prefix}

---

${core}`;
}

function buildCorePrompt(
	featureName: string,
	spec: string,
	plan: string,
): string {
	const camelCase = toCamelCase(featureName);

	return `# Feature Development: ${featureName}

You are developing a new feature '${featureName}' for the Superbuilder boilerplate.

## Approved Spec

${spec}

## Implementation Plan

${plan}

## Boilerplate Structure Rules

Follow the vertical slice pattern. Each feature is self-contained across these directories:

### Server — \`packages/features/${featureName}/\`
NestJS module + tRPC router:
- \`${featureName}.module.ts\` — NestJS module definition
- \`${featureName}.router.ts\` — tRPC router with procedures
- \`service/\` — Business logic services
- \`dto/\` — Data transfer objects / Zod schemas
- \`controller/\` — REST controllers (optional, only if REST endpoints needed)

### Client — \`apps/app/src/features/${featureName}/\`
React + TanStack Router:
- \`pages/\` — Page components
- \`components/\` — Feature-specific UI components
- \`hooks/\` — Feature-specific React hooks
- \`routes.tsx\` — TanStack route definitions

### Admin — \`apps/system-admin/src/features/${featureName}/\` (optional)
Only if the feature requires admin-facing UI.

### DB Schema — \`packages/drizzle/src/schema/features/${featureName}/\`
Drizzle ORM schema using \`pgTable\`.

### Widget — \`packages/widgets/src/${featureName}/\` (optional)
Only for widget-type features that render embeddable UI blocks.

## Marker Block Rules

The ATLAS marker system uses comment blocks to mark insertion points in shared files. When adding a new feature, insert your code before the closing tag of each relevant marker.

### Marker Locations

| File | Markers |
|------|---------|
| \`apps/atlas-server/src/app.module.ts\` | \`[ATLAS:IMPORTS]\`, \`[ATLAS:MODULES]\` |
| \`apps/atlas-server/src/trpc/router.ts\` | \`[ATLAS:IMPORTS]\`, \`[ATLAS:ROUTERS]\` |
| \`packages/features/app-router.ts\` | \`[ATLAS:IMPORTS]\`, \`[ATLAS:ROUTERS]\` |
| \`packages/drizzle/src/schema/index.ts\` | \`[ATLAS:SCHEMAS]\` |
| \`packages/drizzle/src/schema-registry.ts\` | \`[ATLAS:SCHEMA_IMPORTS]\`, \`[ATLAS:SCHEMA_SPREAD]\` |
| \`drizzle.config.ts\` | \`[ATLAS:TABLES]\` |
| \`apps/app/src/router.tsx\` | \`[ATLAS:IMPORTS]\`, \`[ATLAS:ROUTES]\` |

### Insertion Example

To add an import to a marker block, insert your line **before** the closing tag:

\`\`\`typescript
// [ATLAS:IMPORTS]
import { ExistingModule } from "./features/existing/existing.module";
import { ${featureName}Module } from "./features/${featureName}/${featureName}.module";  // <-- new
// [/ATLAS:IMPORTS]
\`\`\`

Always insert before the \`// [/ATLAS:MARKER_NAME]\` closing comment.

## superbuilder.json Update

Add a new feature entry to \`superbuilder.json\` with this structure:

\`\`\`json
"${featureName}": {
  "name": "${featureName}",
  "type": "page|widget|agent",
  "group": "content|commerce|community|system",
  "dependencies": ["profile"],
  "optionalDependencies": [],
  "dependents": [],
  "paths": {
    "server": "packages/features/${featureName}/",
    "client": "apps/app/src/features/${featureName}/",
    "schema": "packages/drizzle/src/schema/features/${featureName}/"
  },
  "connections": [
    {
      "file": "apps/atlas-server/src/app.module.ts",
      "markers": ["ATLAS:IMPORTS", "ATLAS:MODULES"]
    }
  ],
  "tables": ["table_name"],
  "router": {
    "key": "${camelCase}",
    "importName": "${camelCase}Router"
  }
}
\`\`\`

Set \`type\`, \`group\`, \`dependencies\`, \`tables\`, and \`connections\` based on the feature spec.

## Instructions

1. Read an existing feature for reference (e.g., \`packages/features/blog/\`) to match conventions
2. Create all required files following the vertical slice pattern above
3. Add marker entries to ALL connection files listed in the Marker Block Rules
4. Update \`superbuilder.json\` with the new feature entry
5. Run \`bun install\` and fix any import errors
6. Commit: \`git add -A && git commit -m "feat: add ${featureName} feature"\`
7. Push: \`git push -u origin feature/${featureName}\`
8. Do NOT create a PR`;
}

function toCamelCase(name: string): string {
	return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
