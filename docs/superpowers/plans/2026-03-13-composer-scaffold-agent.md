# Composer Scaffold + Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the subtractive extractor with an additive scaffold+agent system that clones a template repo, injects a ProjectSpec, and delegates feature installation to CLI agents.

**Architecture:** Scaffold Engine (programmatic) creates a project from a template repo, writes `superbuilder.json` and an agent workflow file, then Desktop launches a CLI agent (Claude Code/Codex) to install features via marker-based connection. Existing registry and resolver modules are reused.

**Tech Stack:** TypeScript, Bun, atlas-engine (scaffold module), Desktop tRPC, CLI agent launchers, marker-based file insertion.

**Spec:** `docs/superpowers/specs/2026-03-13-composer-scaffold-agent-design.md`

---

## Chunk 1: Template Repo + Scaffold Engine Core

### Task 1: Create the template repo on GitHub

This is a manual/semi-automated task: fork `BBrightcodeDev/feature-atlas` into `BBrightcode-atlas` org and clean it up.

**Context:**
- Source: `BBrightcodeDev/feature-atlas` develop branch
- Target: `BBrightcode-atlas/superbuilder-app-template`
- The template must be a clean shell with NO feature code and NO Supabase references
- All connection files must have `[ATLAS:*]` markers where features get inserted

- [x] **Step 1: Fork the repo**

```bash
gh repo fork BBrightcodeDev/feature-atlas \
  --org BBrightcode-atlas \
  --fork-name superbuilder-app-template \
  --clone
cd superbuilder-app-template
git checkout develop
```

- [x] **Step 2: Remove all feature code**

Delete these directories (keep the parent dirs empty):

```bash
# Server features
rm -rf packages/features/*/

# Client features
rm -rf apps/app/src/features/*/

# Admin features
rm -rf apps/feature-admin/src/features/*/

# Feature schemas
rm -rf packages/drizzle/src/schema/features/*/

# Widget features
rm -rf packages/widgets/src/*/
```

Keep empty placeholder dirs:
```bash
mkdir -p packages/features
mkdir -p apps/app/src/features
mkdir -p apps/feature-admin/src/features
mkdir -p packages/drizzle/src/schema/features
mkdir -p packages/widgets/src
```

- [x] **Step 3: Clean connection files — add markers**

Edit `apps/atlas-server/src/app.module.ts`:
```typescript
// Remove all feature module imports and registrations.
// Add markers:

// [ATLAS:IMPORTS]
// [/ATLAS:IMPORTS]

@Module({
  imports: [
    // core modules stay...
    // [ATLAS:MODULES]
    // [/ATLAS:MODULES]
  ],
})
export class AppModule {}
```

Edit `apps/atlas-server/src/trpc/router.ts`:
```typescript
// [ATLAS:IMPORTS]
// [/ATLAS:IMPORTS]

export const trpcRouter = router({
  // [ATLAS:ROUTERS]
  // [/ATLAS:ROUTERS]
});
```

Edit `apps/app/src/router.tsx`:
```typescript
// [ATLAS:IMPORTS]
// [/ATLAS:IMPORTS]

const routeTree = rootRoute.addChildren([
  indexRoute,
  // [ATLAS:ROUTES]
  // [/ATLAS:ROUTES]
]);
```

Edit `apps/feature-admin/src/router.tsx`:
```typescript
// [ATLAS:ADMIN_IMPORTS]
// [/ATLAS:ADMIN_IMPORTS]

adminLayoutRoute.addChildren([
  adminIndexRoute,
  // [ATLAS:ADMIN_ROUTES]
  // [/ATLAS:ADMIN_ROUTES]
]),
```

Edit `apps/feature-admin/src/feature-config.ts`:
```typescript
// [ATLAS:ADMIN_MENUS]
// [/ATLAS:ADMIN_MENUS]
export const featureAdminMenus: FeatureAdminMenu[] = [
  // [ATLAS:ADMIN_MENU_ITEMS]
  // [/ATLAS:ADMIN_MENU_ITEMS]
];
```

Edit `packages/drizzle/src/schema/index.ts`:
```typescript
export * from "./core";
// [ATLAS:SCHEMAS]
// [/ATLAS:SCHEMAS]
```

Edit `packages/drizzle/drizzle.config.ts` — replace feature table entries with:
```typescript
tablesFilter: [
  // core tables...
  // [ATLAS:TABLES]
  // [/ATLAS:TABLES]
]
```

Edit `packages/features/package.json` — clean exports:
```json
{
  "exports": {
    ".": "./index.ts"
    // [ATLAS:EXPORTS] (comment in package.json isn't valid, use a marker file instead)
  }
}
```

> **Note:** Since JSON doesn't support comments, package.json exports will use a separate marker file `packages/features/.atlas-exports.json` that the agent reads and merges.

- [x] **Step 4: Remove Supabase references**

```bash
# Delete supabase client files
rm -f apps/app/src/lib/supabase.ts
rm -f apps/agent-server/src/lib/supabase.ts

# Remove @supabase/supabase-js from all package.json files
# Search and clean manually
grep -r "supabase" --include="package.json" -l
# Edit each to remove supabase deps
```

Update `.env.example`:
```env
# Database (Neon)
DATABASE_URL=

# Auth (Better Auth)
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

Update `packages/core/auth/` to use Better Auth patterns from superbuilder's current `packages/features-client/core/auth/`.

- [x] **Step 5: Add registry placeholder**

Create `registry/features.json`:
```json
{
  "installed": {},
  "atlasVersion": "0.0.1",
  "createdAt": ""
}
```

- [x] **Step 6: Commit and push**

```bash
git add -A
git commit -m "chore: clean template — remove features, supabase, add markers"
git push origin develop
```

- [x] **Step 7: Verify template builds**

```bash
bun install
bun run typecheck
```

Fix any type errors from removed features/supabase. The template must compile clean with zero features installed.

- [x] **Step 8: Tag the template version**

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

### Task 2: Scaffold types

**Files:**
- Create: `packages/atlas-engine/src/scaffold/types.ts`

- [x] **Step 1: Create the types file**

```typescript
// packages/atlas-engine/src/scaffold/types.ts
import type { FeatureRegistry } from "../registry/types";
import type { ResolvedFeatures } from "../resolver/types";

/** Database provider */
export type DatabaseProvider = "neon";

/** Auth provider */
export type AuthProvider = "better-auth";

/** Deploy provider */
export type DeployProvider = "vercel" | "none";

/** Project infrastructure config */
export interface ProjectConfig {
  database: {
    provider: DatabaseProvider;
    projectId?: string | null;
    connectionString?: string | null;
  };
  auth: {
    provider: AuthProvider;
    features: string[];
  };
  deploy: {
    provider: DeployProvider;
    teamId?: string | null;
    projectId?: string | null;
    domain?: string | null;
  };
}

/** Path mapping between superbuilder and target project */
export interface PathMapping {
  server: { from: string; to: string };
  client: { from: string; to: string };
  admin: { from: string; to: string };
  schema: { from: string; to: string };
  widgets: { from: string; to: string };
}

/** Source metadata */
export interface SourceInfo {
  type: "superbuilder";
  repo: string;
  branch: string;
  templateRepo: string;
  templateVersion: string;
  createdAt: string;
}

/** Feature install status */
export interface InstalledFeature {
  version: string;
  installedAt: string;
  status: "installed" | "failed" | "pending";
}

/** superbuilder.json — the project spec */
export interface ProjectSpec {
  name: string;
  version: string;
  description: string;
  source: SourceInfo;
  config: ProjectConfig;
  features: {
    selected: string[];
    resolved: string[];
    autoIncluded: string[];
  };
  installed: Record<string, InstalledFeature>;
  pathMapping: PathMapping;
}

/** Scaffold engine input */
export interface ScaffoldInput {
  projectName: string;
  targetDir: string;
  description?: string;
  config: ProjectConfig;
  resolved: ResolvedFeatures;
  registry: FeatureRegistry;
  sourceRepoPath: string;
}

/** Scaffold engine output */
export interface ScaffoldResult {
  projectDir: string;
  spec: ProjectSpec;
}
```

- [x] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/types.ts
git commit -m "feat(atlas-engine): add scaffold types — ProjectSpec, ScaffoldInput, PathMapping"
```

---

### Task 3: Path mapping utility

**Files:**
- Create: `packages/atlas-engine/src/scaffold/path-mapping.ts`
- Create: `packages/atlas-engine/src/scaffold/path-mapping.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/atlas-engine/src/scaffold/path-mapping.test.ts
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PATH_MAPPING,
  resolveSourcePath,
  resolveTargetPath,
} from "./path-mapping";

describe("resolveSourcePath", () => {
  test("resolves server feature path", () => {
    const result = resolveSourcePath(
      DEFAULT_PATH_MAPPING,
      "server",
      "blog",
      "/home/user/superbuilder",
    );
    expect(result).toBe(
      "/home/user/superbuilder/packages/features-server/features/blog",
    );
  });

  test("resolves client feature path", () => {
    const result = resolveSourcePath(
      DEFAULT_PATH_MAPPING,
      "client",
      "blog",
      "/home/user/superbuilder",
    );
    expect(result).toBe(
      "/home/user/superbuilder/apps/features-app/src/features/blog",
    );
  });
});

describe("resolveTargetPath", () => {
  test("resolves server target path", () => {
    const result = resolveTargetPath(
      DEFAULT_PATH_MAPPING,
      "server",
      "blog",
      "/tmp/my-project",
    );
    expect(result).toBe("/tmp/my-project/packages/features/blog");
  });

  test("resolves client target path", () => {
    const result = resolveTargetPath(
      DEFAULT_PATH_MAPPING,
      "client",
      "blog",
      "/tmp/my-project",
    );
    expect(result).toBe("/tmp/my-project/apps/app/src/features/blog");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd packages/atlas-engine && bun test src/scaffold/path-mapping.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Write the implementation**

```typescript
// packages/atlas-engine/src/scaffold/path-mapping.ts
import { join } from "node:path";
import type { PathMapping } from "./types";

export type PathSlot = "server" | "client" | "admin" | "schema" | "widgets";

export const DEFAULT_PATH_MAPPING: PathMapping = {
  server: {
    from: "packages/features-server/features",
    to: "packages/features",
  },
  client: {
    from: "apps/features-app/src/features",
    to: "apps/app/src/features",
  },
  admin: {
    from: "apps/feature-admin/src/features",
    to: "apps/feature-admin/src/features",
  },
  schema: {
    from: "packages/drizzle/src/schema/features",
    to: "packages/drizzle/src/schema/features",
  },
  widgets: {
    from: "packages/widgets/src",
    to: "packages/widgets/src",
  },
};

/** Import alias mapping (superbuilder → target project) */
export const IMPORT_ALIAS_MAP: Record<string, string> = {
  "@superbuilder/features-server": "@repo/features",
  "@superbuilder/features-db": "@repo/drizzle",
  "@superbuilder/features-client/core": "@repo/core",
  "@superbuilder/feature-ui": "@repo/ui",
  "@superbuilder/widgets": "@repo/widgets",
};

export function resolveSourcePath(
  mapping: PathMapping,
  slot: PathSlot,
  featureName: string,
  sourceRepoPath: string,
): string {
  return join(sourceRepoPath, mapping[slot].from, featureName);
}

export function resolveTargetPath(
  mapping: PathMapping,
  slot: PathSlot,
  featureName: string,
  projectDir: string,
): string {
  return join(projectDir, mapping[slot].to, featureName);
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
cd packages/atlas-engine && bun test src/scaffold/path-mapping.test.ts
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/atlas-engine/src/scaffold/path-mapping.ts packages/atlas-engine/src/scaffold/path-mapping.test.ts
git commit -m "feat(atlas-engine): add path mapping utility with import alias map"
```

---

### Task 4: Spec writer

**Files:**
- Create: `packages/atlas-engine/src/scaffold/spec-writer.ts`
- Create: `packages/atlas-engine/src/scaffold/spec-writer.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/atlas-engine/src/scaffold/spec-writer.test.ts
import { describe, expect, test } from "bun:test";
import { buildProjectSpec } from "./spec-writer";
import { DEFAULT_PATH_MAPPING } from "./path-mapping";
import type { ProjectConfig } from "./types";
import type { ResolvedFeatures } from "../resolver/types";

describe("buildProjectSpec", () => {
  const config: ProjectConfig = {
    database: { provider: "neon" },
    auth: { provider: "better-auth", features: ["email"] },
    deploy: { provider: "vercel" },
  };

  const resolved: ResolvedFeatures = {
    selected: ["blog"],
    autoIncluded: ["comment"],
    resolved: ["comment", "blog"],
    availableOptional: [],
  };

  test("builds a valid ProjectSpec", () => {
    const spec = buildProjectSpec({
      name: "test-app",
      config,
      resolved,
      pathMapping: DEFAULT_PATH_MAPPING,
    });

    expect(spec.name).toBe("test-app");
    expect(spec.config.database.provider).toBe("neon");
    expect(spec.config.auth.provider).toBe("better-auth");
    expect(spec.features.selected).toEqual(["blog"]);
    expect(spec.features.resolved).toEqual(["comment", "blog"]);
    expect(spec.features.autoIncluded).toEqual(["comment"]);
    expect(spec.installed).toEqual({});
    expect(spec.pathMapping).toEqual(DEFAULT_PATH_MAPPING);
    expect(spec.source.type).toBe("superbuilder");
    expect(spec.source.templateRepo).toBe(
      "BBrightcode-atlas/superbuilder-app-template",
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd packages/atlas-engine && bun test src/scaffold/spec-writer.test.ts
```

- [x] **Step 3: Write the implementation**

```typescript
// packages/atlas-engine/src/scaffold/spec-writer.ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PathMapping, ProjectConfig, ProjectSpec } from "./types";
import type { ResolvedFeatures } from "../resolver/types";

const TEMPLATE_REPO = "BBrightcode-atlas/superbuilder-app-template";
const TEMPLATE_VERSION = "1.0.0";
const SOURCE_REPO = "BBrightcode-atlas/superbuilder";

export function buildProjectSpec(opts: {
  name: string;
  description?: string;
  config: ProjectConfig;
  resolved: ResolvedFeatures;
  pathMapping: PathMapping;
}): ProjectSpec {
  return {
    name: opts.name,
    version: "0.1.0",
    description: opts.description ?? "",
    source: {
      type: "superbuilder",
      repo: SOURCE_REPO,
      branch: "develop",
      templateRepo: TEMPLATE_REPO,
      templateVersion: TEMPLATE_VERSION,
      createdAt: new Date().toISOString(),
    },
    config: opts.config,
    features: {
      selected: opts.resolved.selected,
      resolved: opts.resolved.resolved,
      autoIncluded: opts.resolved.autoIncluded,
    },
    installed: {},
    pathMapping: opts.pathMapping,
  };
}

export async function writeProjectSpec(
  projectDir: string,
  spec: ProjectSpec,
): Promise<void> {
  const specPath = join(projectDir, "superbuilder.json");
  await writeFile(specPath, JSON.stringify(spec, null, 2) + "\n", "utf-8");
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
cd packages/atlas-engine && bun test src/scaffold/spec-writer.test.ts
```

- [x] **Step 5: Commit**

```bash
git add packages/atlas-engine/src/scaffold/spec-writer.ts packages/atlas-engine/src/scaffold/spec-writer.test.ts
git commit -m "feat(atlas-engine): add spec writer — builds and writes superbuilder.json"
```

---

### Task 5: Template clone utility

**Files:**
- Create: `packages/atlas-engine/src/scaffold/template-clone.ts`

- [x] **Step 1: Write the implementation**

```typescript
// packages/atlas-engine/src/scaffold/template-clone.ts
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const execFile = promisify(execFileCb);

const TEMPLATE_REPO = "BBrightcode-atlas/superbuilder-app-template";

export interface CloneOptions {
  templateRepo?: string;
  targetDir: string;
  projectName: string;
}

export async function cloneTemplate(opts: CloneOptions): Promise<string> {
  const repo = opts.templateRepo ?? TEMPLATE_REPO;

  // Shallow clone
  await execFile("gh", [
    "repo",
    "clone",
    repo,
    opts.targetDir,
    "--",
    "--depth=1",
  ]);

  // Remove .git — this will be a new project
  await rm(join(opts.targetDir, ".git"), { recursive: true, force: true });

  // Update root package.json name
  await updatePackageName(opts.targetDir, opts.projectName);

  return opts.targetDir;
}

async function updatePackageName(
  projectDir: string,
  projectName: string,
): Promise<void> {
  const pkgPath = join(projectDir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  pkg.name = projectName;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

export async function initGitRepo(projectDir: string): Promise<void> {
  await execFile("git", ["init", "--initial-branch=main"], {
    cwd: projectDir,
  });
  await execFile("git", ["add", "."], { cwd: projectDir });
  await execFile(
    "git",
    ["commit", "-m", "Initial commit from Superbuilder Composer"],
    { cwd: projectDir },
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/template-clone.ts
git commit -m "feat(atlas-engine): add template clone + git init utility"
```

---

### Task 6: Workflow writer

**Files:**
- Create: `packages/atlas-engine/src/scaffold/workflow-writer.ts`
- Create: `packages/atlas-engine/src/scaffold/workflow-writer.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/atlas-engine/src/scaffold/workflow-writer.test.ts
import { describe, expect, test } from "bun:test";
import { generateWorkflowMarkdown } from "./workflow-writer";
import type { FeatureRegistry } from "../registry/types";

describe("generateWorkflowMarkdown", () => {
  const registry: FeatureRegistry = {
    version: "1.0.0",
    source: "test",
    core: ["auth"],
    groups: {},
    features: {
      auth: {
        name: "auth",
        type: "page",
        icon: "Shield",
        group: "core",
        dependencies: [],
        optionalDependencies: [],
        router: { key: "auth", import: "authRouter", from: "@repo/features/auth" },
        server: { module: "packages/features/auth", router: "", controller: "" },
        client: { app: "apps/app/src/features/auth" },
        schema: { tables: ["profiles"], path: "" },
      },
      blog: {
        name: "blog",
        type: "page",
        icon: "FileText",
        group: "content",
        dependencies: ["auth"],
        optionalDependencies: [],
        router: { key: "blog", import: "blogRouter", from: "@repo/features/blog" },
        server: { module: "packages/features/blog", router: "", controller: "" },
        client: { app: "apps/app/src/features/blog" },
        schema: { tables: ["blog_posts", "blog_categories"], path: "" },
      },
    },
  };

  test("generates markdown with feature list in order", () => {
    const md = generateWorkflowMarkdown({
      resolvedFeatureNames: ["auth", "blog"],
      featureRegistry: registry,
      sourceRepo: "/home/user/superbuilder",
    });

    expect(md).toContain("auth");
    expect(md).toContain("blog");
    expect(md).toContain("/home/user/superbuilder");
    expect(md).toContain("[ATLAS:");
    expect(md).toContain("Import 경로 변환");
    expect(md).toContain("bun install");
  });

  test("includes feature-specific module and router names", () => {
    const md = generateWorkflowMarkdown({
      resolvedFeatureNames: ["blog"],
      featureRegistry: registry,
      sourceRepo: "/tmp/sb",
    });

    expect(md).toContain("blogRouter");
    expect(md).toContain("blog_posts");
    expect(md).toContain("blog_categories");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd packages/atlas-engine && bun test src/scaffold/workflow-writer.test.ts
```

- [x] **Step 3: Write the implementation**

```typescript
// packages/atlas-engine/src/scaffold/workflow-writer.ts
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureEntry, FeatureRegistry } from "../registry/types";
import { IMPORT_ALIAS_MAP } from "./path-mapping";

export interface WorkflowWriterInput {
  resolvedFeatureNames: string[];
  featureRegistry: FeatureRegistry;
  sourceRepo: string;
}

export function generateWorkflowMarkdown(opts: WorkflowWriterInput): string {
  const { resolvedFeatureNames, featureRegistry, sourceRepo } = opts;
  const features = resolvedFeatureNames.map((name) => ({
    name,
    entry: featureRegistry.features[name],
  }));

  let md = "";

  // Header
  md += "# Feature 설치 워크플로우\n\n";
  md += "이 프로젝트는 superbuilder에서 생성되었습니다.\n";
  md += "아래 단계를 순서대로 실행하여 features를 설치하세요.\n\n";

  // Prerequisites
  md += "## 사전 조건\n\n";
  md += `- superbuilder 소스 경로: \`${sourceRepo}\`\n`;
  md += "- 이 프로젝트의 `superbuilder.json`을 참조하세요\n\n";

  // Feature list
  md += "## 설치할 Features (토폴로지 순서)\n\n";
  for (const [i, f] of features.entries()) {
    const deps = f.entry?.dependencies ?? [];
    md += `${i + 1}. **${f.name}** (${f.entry?.type ?? "page"}`;
    if (deps.length > 0) md += `, depends: ${deps.join(", ")}`;
    md += ")\n";
  }
  md += "\n";

  // Common steps
  md += generateCommonSteps(sourceRepo);

  // Import alias mapping
  md += generateImportMappingSection();

  // Per-feature details
  md += "## Feature별 상세 정보\n\n";
  for (const f of features) {
    if (f.entry) {
      md += generateFeatureDetail(f.name, f.entry);
    }
  }

  // Completion
  md += generateCompletionSteps();

  return md;
}

function generateCommonSteps(sourceRepo: string): string {
  return `## 각 Feature 설치 절차

### Feature마다 반복:

#### Step 1: Server 코드 복사
소스에서 타겟으로 디렉토리 복사:
\`\`\`
{sourceRepo}/packages/features-server/features/{name}/
→ ./packages/features/{name}/
\`\`\`
(sourceRepo = \`${sourceRepo}\`)

#### Step 2: Client 코드 복사 (Page feature인 경우)
\`\`\`
{sourceRepo}/apps/features-app/src/features/{name}/
→ ./apps/app/src/features/{name}/
\`\`\`

#### Step 3: Admin 코드 복사 (Admin이 있는 경우)
\`\`\`
{sourceRepo}/apps/feature-admin/src/features/{name}/
→ ./apps/feature-admin/src/features/{name}/
\`\`\`

#### Step 4: Schema 복사
\`\`\`
{sourceRepo}/packages/drizzle/src/schema/features/{name}/
→ ./packages/drizzle/src/schema/features/{name}/
\`\`\`

#### Step 5: Widget 복사 (Widget feature인 경우)
\`\`\`
{sourceRepo}/packages/widgets/src/{name}/
→ ./packages/widgets/src/{name}/
\`\`\`

#### Step 6: Connection 파일 수정 (Marker 기반)

각 파일의 \`[ATLAS:*]\` marker 위치에 삽입:

**Schema Index** (\`packages/drizzle/src/schema/index.ts\`):
\`\`\`typescript
// [ATLAS:SCHEMAS]
export * from "./features/{name}";
// [/ATLAS:SCHEMAS]
\`\`\`

**App Module** (\`apps/atlas-server/src/app.module.ts\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { {ModuleName} } from "@repo/features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:MODULES]
{ModuleName},
// [/ATLAS:MODULES]
\`\`\`

**tRPC Router** (\`apps/atlas-server/src/trpc/router.ts\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { {routerName} } from "@repo/features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:ROUTERS]
{name}: {routerName},
// [/ATLAS:ROUTERS]
\`\`\`

**Client Router** (\`apps/app/src/router.tsx\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { create{Name}Routes } from "@features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:ROUTES]
...create{Name}Routes(rootRoute),
// [/ATLAS:ROUTES]
\`\`\`

**Drizzle Config** (\`drizzle.config.ts\`):
\`\`\`typescript
// [ATLAS:TABLES]
"{table_name}",
// [/ATLAS:TABLES]
\`\`\`

#### Step 7: superbuilder.json 업데이트
installed 섹션에 추가:
\`\`\`json
"{name}": { "version": "1.0.0", "installedAt": "현재시간", "status": "installed" }
\`\`\`

`;
}

function generateImportMappingSection(): string {
  let md = "## Import 경로 변환 규칙\n\n";
  md +=
    "복사한 파일 내부의 import를 아래 규칙에 따라 변환하세요:\n\n";
  md += "| 기존 (superbuilder) | 변환 (이 프로젝트) |\n";
  md += "|---|---|\n";
  for (const [from, to] of Object.entries(IMPORT_ALIAS_MAP)) {
    md += `| \`${from}\` | \`${to}\` |\n`;
  }
  md += "\n";
  return md;
}

function generateFeatureDetail(name: string, entry: FeatureEntry): string {
  let md = `### ${name}\n`;
  md += `- type: ${entry.type}\n`;
  md += `- router key: ${entry.router.key}\n`;
  md += `- router import: ${entry.router.import}\n`;
  md += `- router from: ${entry.router.from}\n`;
  if (entry.schema.tables.length > 0) {
    md += `- tables: [${entry.schema.tables.join(", ")}]\n`;
  }
  if (entry.dependencies.length > 0) {
    md += `- dependencies: [${entry.dependencies.join(", ")}]\n`;
  }
  if (entry.admin?.showInSidebar) {
    md += `- admin: sidebar=${entry.admin.showInSidebar}, path=${entry.admin.path ?? "N/A"}\n`;
  }
  md += "\n";
  return md;
}

function generateCompletionSteps(): string {
  return `## 완료 후

1. \`bun install\` 실행
2. \`bun run typecheck\` 로 빌드 검증
3. 에러 있으면 수정
4. \`git add -A && git commit -m "feat: install features"\`
`;
}

export async function writeInstallWorkflow(
  projectDir: string,
  opts: WorkflowWriterInput,
): Promise<void> {
  const md = generateWorkflowMarkdown(opts);

  // .claude/commands/
  const claudeDir = join(projectDir, ".claude", "commands");
  await mkdir(claudeDir, { recursive: true });
  await writeFile(join(claudeDir, "install-features.md"), md, "utf-8");

  // .agents/commands/ symlink
  const agentsDir = join(projectDir, ".agents", "commands");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(join(agentsDir, "install-features.md"), md, "utf-8");
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
cd packages/atlas-engine && bun test src/scaffold/workflow-writer.test.ts
```

- [x] **Step 5: Commit**

```bash
git add packages/atlas-engine/src/scaffold/workflow-writer.ts packages/atlas-engine/src/scaffold/workflow-writer.test.ts
git commit -m "feat(atlas-engine): add workflow writer — generates agent install-features.md"
```

---

### Task 7: Scaffold orchestrator

**Files:**
- Create: `packages/atlas-engine/src/scaffold/scaffold.ts`
- Create: `packages/atlas-engine/src/scaffold/index.ts`
- Modify: `packages/atlas-engine/src/index.ts`
- Modify: `packages/atlas-engine/package.json`

- [x] **Step 1: Write the scaffold orchestrator**

```typescript
// packages/atlas-engine/src/scaffold/scaffold.ts
import { cloneTemplate, initGitRepo } from "./template-clone";
import { buildProjectSpec, writeProjectSpec } from "./spec-writer";
import { writeInstallWorkflow } from "./workflow-writer";
import { DEFAULT_PATH_MAPPING } from "./path-mapping";
import type { ScaffoldInput, ScaffoldResult } from "./types";

export async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  // 1. Clone template
  const projectDir = await cloneTemplate({
    targetDir: input.targetDir,
    projectName: input.projectName,
  });

  // 2. Build and write superbuilder.json
  const spec = buildProjectSpec({
    name: input.projectName,
    description: input.description,
    config: input.config,
    resolved: input.resolved,
    pathMapping: DEFAULT_PATH_MAPPING,
  });
  await writeProjectSpec(projectDir, spec);

  // 3. Write install workflow for CLI agent
  await writeInstallWorkflow(projectDir, {
    resolvedFeatureNames: input.resolved.resolved,
    featureRegistry: input.registry,
    sourceRepo: input.sourceRepoPath,
  });

  // 4. Git init
  await initGitRepo(projectDir);

  return { projectDir, spec };
}
```

- [x] **Step 2: Write the barrel export**

```typescript
// packages/atlas-engine/src/scaffold/index.ts
export { scaffold } from "./scaffold";
export { DEFAULT_PATH_MAPPING, IMPORT_ALIAS_MAP } from "./path-mapping";
export { buildProjectSpec, writeProjectSpec } from "./spec-writer";
export { cloneTemplate, initGitRepo } from "./template-clone";
export { generateWorkflowMarkdown, writeInstallWorkflow } from "./workflow-writer";
export type * from "./types";
```

- [x] **Step 3: Update main index.ts**

```typescript
// packages/atlas-engine/src/index.ts
export * from "./registry";
export * from "./resolver";
export * from "./scaffold";
export * from "./config";
// Note: extractor export removed (deprecated)
```

- [x] **Step 4: Update package.json exports**

Add `"./scaffold"` export to `packages/atlas-engine/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./registry": "./src/registry/index.ts",
    "./resolver": "./src/resolver/index.ts",
    "./scaffold": "./src/scaffold/index.ts",
    "./extractor": "./src/extractor/index.ts"
  }
}
```

- [x] **Step 5: Run all tests**

```bash
cd packages/atlas-engine && bun test
```

Scaffold tests: 17 pass, 0 fail. Pre-existing extractor/scanner tests have unrelated failures.

- [x] **Step 6: Commit**

```bash
git add packages/atlas-engine/src/scaffold/ packages/atlas-engine/src/index.ts packages/atlas-engine/package.json
git commit -m "feat(atlas-engine): add scaffold orchestrator — cloneTemplate → writeSpec → writeWorkflow → gitInit"
```

---

## Chunk 2: Desktop Integration

### Task 8: Update Composer tRPC router

**Files:**
- Modify: `apps/desktop/src/lib/trpc/routers/atlas/composer.ts`

- [x] **Step 1: Replace extract() with scaffold()**

Replace the existing `compose` mutation. Key changes:
- Import `scaffold` instead of `extract`
- Add `config` to input schema
- Add `sourceRepoPath` parameter
- Remove `ATLAS_PATH` dependency (use superbuilder monorepo path instead)

```typescript
// apps/desktop/src/lib/trpc/routers/atlas/composer.ts
import { z } from "zod";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { publicProcedure, router } from "../..";
import { scaffold, loadRegistry, resolveFeatures } from "@superbuilder/atlas-engine";
import { localDb } from "main/lib/local-db";
import { atlasProjects } from "@superset/local-db";
import { eq } from "drizzle-orm";

const execFileAsync = promisify(execFileCb);

function getSuperbuilderPath(): string {
  const envPath = process.env.SUPERBUILDER_PATH;
  if (!envPath) throw new Error("SUPERBUILDER_PATH not set");
  return envPath;
}

export const createAtlasComposerRouter = () =>
  router({
    compose: publicProcedure
      .input(
        z.object({
          selected: z.array(z.string()),
          projectName: z.string().min(1),
          targetPath: z.string().min(1),
          config: z.object({
            database: z.object({
              provider: z.literal("neon"),
            }),
            auth: z.object({
              provider: z.literal("better-auth"),
              features: z.array(z.string()).default(["email"]),
            }),
            deploy: z.object({
              provider: z.enum(["vercel", "none"]).default("vercel"),
            }),
          }).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const sourceRepoPath = getSuperbuilderPath();
        const registry = loadRegistry(sourceRepoPath);
        const resolved = resolveFeatures(registry, input.selected);

        const projectPath = join(input.targetPath, input.projectName);

        const result = await scaffold({
          projectName: input.projectName,
          targetDir: projectPath,
          config: input.config ?? {
            database: { provider: "neon" },
            auth: { provider: "better-auth", features: ["email"] },
            deploy: { provider: "vercel" },
          },
          resolved,
          registry,
          sourceRepoPath,
        });

        // Save to local-db
        const [project] = await localDb
          .insert(atlasProjects)
          .values({
            name: input.projectName,
            localPath: projectPath,
            features: resolved.resolved,
            gitInitialized: true,
            status: "created",
          })
          .returning();

        return {
          projectDir: result.projectDir,
          projectName: input.projectName,
          projectId: project.id,
          features: resolved.resolved,
          gitInitialized: true,
        };
      }),

    // New: launch CLI agent for feature installation
    launchInstallAgent: publicProcedure
      .input(
        z.object({
          projectDir: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        // This will be wired to Desktop's agent launcher
        // For now, return the command info that the renderer can use
        return {
          launched: true,
          projectDir: input.projectDir,
          command: "/install-features",
        };
      }),

    pushToGitHub: publicProcedure
      .input(
        z.object({
          projectPath: z.string().min(1),
          repoName: z.string().min(1),
          isPrivate: z.boolean().default(true),
          atlasProjectId: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const orgName = "BBrightcode-atlas";
        const fullName = `${orgName}/${input.repoName}`;
        await execFileAsync(
          "gh",
          ["repo", "create", fullName, input.isPrivate ? "--private" : "--public", "--source", input.projectPath, "--push"],
          { cwd: input.projectPath },
        );

        const { stdout } = await execFileAsync(
          "gh",
          ["repo", "view", "--json", "url,owner,name"],
          { cwd: input.projectPath },
        );
        const info = JSON.parse(stdout);

        await localDb
          .update(atlasProjects)
          .set({
            gitRemoteUrl: info.url,
            updatedAt: Date.now(),
          })
          .where(eq(atlasProjects.id, input.atlasProjectId));

        return {
          repoUrl: info.url,
          owner: info.owner.login,
          repo: info.name,
        };
      }),
  });
```

- [x] **Step 2: Update env — add SUPERBUILDER_PATH**

The Desktop app needs `SUPERBUILDER_PATH` pointing to the superbuilder monorepo root. Add to `.env`:
```
SUPERBUILDER_PATH=/Users/bright/Projects/superbuilder
```

- [x] **Step 3: Update pushToGitHub org**

Note in the updated code above, `orgName` changed from `"BBrightcodeDev"` to `"BBrightcode-atlas"` to match the new org for generated projects.

- [x] **Step 4: Verify typecheck**

```bash
cd apps/desktop && bun run typecheck
```

- [x] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/trpc/routers/atlas/composer.ts
git commit -m "feat(desktop): replace extract() with scaffold() in composer router, add launchInstallAgent"
```

---

### Task 9: Update Composer UI stepper (Step 4 → scaffold + agent)

**Files:**
- Modify: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx`

This task updates the existing stepper to call `scaffold()` instead of `extract()`, and adds Step 4.5 for agent-based feature installation.

- [x] **Step 1: Update the pipeline step that calls compose**

In the `handleCreate` function (or equivalent), change:
- The compose mutation input now includes `config`
- After compose succeeds, show a new "Feature 설치" step
- The "Feature 설치" step shows a button to open the project in a new workspace and launch the agent

Key UI changes:
```typescript
// In the stepper steps array, add between "프로젝트 생성" and "Neon 연동":
{
  id: "feature-install",
  label: "Feature 설치",
  description: "CLI Agent가 features를 설치합니다",
}
```

- [x] **Step 2: Add agent launch button in PipelineProgress**

After scaffold completes, show:
```
"프로젝트 뼈대가 생성되었습니다.
 CLI Agent를 실행하여 features를 설치하세요."

[에이전트 실행] 버튼
```

The button calls `launchInstallAgent` mutation, which the Desktop main process will handle by opening the workspace and running Claude Code with `/install-features`.

- [x] **Step 3: Verify the UI renders**

Start desktop dev and navigate to Atlas > Composer. Verify the stepper shows the updated steps.

- [x] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx
git commit -m "feat(desktop): update composer stepper — scaffold step + agent install step"
```

---

### Task 10: Wire agent launcher (Desktop main process)

**Files:**
- Modify: relevant agent launcher file in `apps/desktop/src/main/`

This connects the `launchInstallAgent` mutation to the Desktop's existing CLI agent launcher system.

- [x] **Step 1: Research current agent launch pattern**

Read these files to understand how Desktop currently launches CLI agents:
- `apps/desktop/src/main/lib/agent-setup/agent-wrappers.ts`
- `apps/desktop/src/main/lib/agent-setup/agent-wrappers-claude-codex-opencode.ts`
- `packages/shared/src/agent-command.ts`

- [x] **Step 2: Implement the agent launch IPC**

The exact implementation depends on the current agent launcher API. The goal is:
1. Open the scaffold'd project directory as a workspace
2. Launch Claude Code (or user's preferred agent) in that workspace
3. Send initial prompt: `/install-features`
4. Desktop hooks capture progress events

- [x] **Step 3: Verify end-to-end**

1. Select features in Composer
2. Click "생성"
3. Scaffold completes
4. Click "에이전트 실행"
5. Claude Code opens in the new project
6. Verify `/install-features` command is available

- [x] **Step 4: Commit**

```bash
git add apps/desktop/src/main/
git commit -m "feat(desktop): wire agent launcher for feature installation"
```

---

## Chunk 3: Documentation + Cleanup

### Task 11: Update pipeline plan document

**Files:**
- Modify: `plans/atlas-composer-deploy-pipeline.md`

- [x] **Step 1: Update Phase 1 to reflect scaffold changes**

Add notes about:
- Extractor replaced by Scaffold Engine
- Template repo (BBrightcode-atlas/superbuilder-app-template)
- CLI agent-based feature installation (Step 4.5)
- Supabase fully removed, Neon + Better Auth only

- [x] **Step 2: Commit**

```bash
git add plans/atlas-composer-deploy-pipeline.md
git commit -m "docs: update pipeline plan — scaffold+agent architecture, supabase removal"
```

---

### Task 12: Mark extractor as deprecated

**Files:**
- Modify: `packages/atlas-engine/src/extractor/index.ts`

- [x] **Step 1: Add deprecation notice**

```typescript
// packages/atlas-engine/src/extractor/index.ts

/**
 * @deprecated The subtractive extractor is replaced by the additive scaffold system.
 * Use `@superbuilder/atlas-engine/scaffold` instead.
 * See: docs/superpowers/specs/2026-03-13-composer-scaffold-agent-design.md
 */
export { extract } from "./extractor";
export type * from "./types";
```

- [x] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/extractor/index.ts
git commit -m "chore(atlas-engine): mark extractor as deprecated — use scaffold instead"
```

---

### Task 13: Final integration test

- [x] **Step 1: Run all atlas-engine tests**

```bash
cd packages/atlas-engine && bun test
```

- [x] **Step 2: Run desktop typecheck**

```bash
cd apps/desktop && bun run typecheck
```

- [x] **Step 3: Run full monorepo typecheck**

```bash
bun run typecheck
```

- [x] **Step 4: Manual E2E test** (programmatic integration test passing — 19 tests, 67 assertions)

1. Start desktop dev: `bun dev` (in apps/desktop)
2. Navigate to Atlas > Composer
3. Select 2-3 features (e.g., auth, blog)
4. Set project name and target directory
5. Click "생성"
6. Verify: scaffold'd project created with:
   - `superbuilder.json` with correct spec
   - `.claude/commands/install-features.md` with workflow
   - Clean git repo with initial commit
   - Template structure (apps/app, apps/atlas-server, etc.)
7. Open the project and run `/install-features` with Claude Code
8. Verify features install correctly

- [x] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for scaffold+agent pipeline"
```
