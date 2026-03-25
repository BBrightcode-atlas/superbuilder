# Plan B: Atlas Engine feature.json Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Atlas Engine to read `feature.json` manifests from `superbuilder-features/features/*/`, auto-derive connections from `provides`, and transform `@superbuilder/core-*` imports at scaffold time.

**Architecture:** Add a `manifest-scanner` module that reads `feature.json` files and converts them to existing `FeatureRegistry` format. Add a `connection-deriver` module that generates extension point code from `provides`. Update `path-mapping` to support the new feature source structure. Add an `import-transformer` module for `@superbuilder/core-*` → `@repo/*` rewriting.

**Tech Stack:** TypeScript, Vitest, Node.js fs APIs

**Spec:** `docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md` (Sections 4, 5, 7)

**Depends on:** Plan A (superbuilder-features repo exists with core packages)

---

## 🤖 에이전트 실행 가이드

| 항목 | 값 |
|------|-----|
| **작업 레포** | `superbuilder` (Task 1-15, 20-22) + `superbuilder-app-template` (Task 16-19) |
| **작업 디렉토리** | Task 1-15, 20-22: `/Users/bright/Projects/superbuilder/packages/atlas-engine`, Task 16-19: `/Users/bright/Projects/superbuilder-app-template` |
| **브랜치** | `superbuilder`: `develop`, `superbuilder-app-template`: `main` |
| **사전 조건** | Plan A 완료 필요 (scanner가 `superbuilder-features/features/*/feature.json`을 읽으므로). 단, **Task 1-15 (순수 엔진 코드)는 Plan A 없이도 단위 테스트 실행 가능** — 테스트가 자체 fixture를 생성하기 때문 |
| **병렬 실행** | Plan A와 **병렬 가능** (Task 1-15는 독립적). Task 16-19 (boilerplate 마커)도 독립적. Task 20-22 (통합 테스트)만 Plan A 완료 필요 |
| **완료 기준** | `packages/atlas-engine`에 scanner/adapter/deriver/transformer/applier/applyConnections 모듈 추가, boilerplate에 `[ATLAS:*]` 마커 삽입, 통합 테스트 통과 |

### 레포별 작업 범위

```
superbuilder (packages/atlas-engine/)
├── Task 1-15:  엔진 모듈 (scanner, adapter, deriver, transformer, applier, applyConnections)
├── Task 20-21: 통합 테스트 + 배럴 export
└── Task 22:    최종 빌드 검증

superbuilder-app-template
└── Task 16-19: [ATLAS:*] 마커 삽입 (app.module.ts, router.ts 등 6개 파일)
```

---

## File Structure

### New files (packages/atlas-engine/src/)

```
packages/atlas-engine/src/
├── manifest/                              # NEW module
│   ├── index.ts                           # barrel export
│   ├── types.ts                           # FeatureManifest, Provides types
│   ├── scanner.ts                         # scanFeatureManifests() — reads feature.json files
│   ├── scanner.test.ts                    # scanner tests
│   ├── adapter.ts                         # manifestToRegistry() — converts manifests to FeatureRegistry
│   └── adapter.test.ts                    # adapter tests
├── connection/                            # NEW module
│   ├── index.ts                           # barrel export
│   ├── types.ts                           # DerivedConnections type
│   ├── deriver.ts                         # deriveConnections() — provides → connection code
│   ├── deriver.test.ts                    # deriver tests
│   ├── applier.ts                         # applyConnections() — insert at [ATLAS:*] markers
│   ├── applier.test.ts                    # applier + widget-export tests
│   ├── widget-export.ts                   # registerWidgetExport() — JSON manipulation
│   ├── apply-connections.ts               # applyConnections() — orchestrator
│   └── apply-connections.test.ts          # orchestrator tests
├── transform/                             # NEW module
│   ├── index.ts                           # barrel export
│   ├── import-transformer.ts              # transformImports() — @superbuilder/core-* → @repo/*
│   ├── import-transformer.test.ts         # transformer tests
│   └── import-map.ts                      # IMPORT_MAP constant
```

### Modified files

```
packages/atlas-engine/src/
├── scaffold/
│   └── path-mapping.ts                    # ADD: feature-json source path resolver
├── index.ts                               # ADD: new module exports
```

---

## Chunk 1: Manifest Scanner & Registry Adapter

### Task 1: Define feature.json types

**Files:**
- Create: `packages/atlas-engine/src/manifest/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/atlas-engine/src/manifest/types.ts

/** feature.json — self-describing feature manifest */
export interface FeatureManifest {
  id: string;
  name: string;
  version: string;
  type: "page" | "widget" | "agent";
  group: "core" | "content" | "commerce" | "community" | "system" | "template";
  icon: string;
  description?: string;

  dependencies: string[];
  optionalDependencies?: string[];

  provides: Provides;
}

/** What the feature provides to extension points */
export interface Provides {
  server?: ServerProvides;
  client?: ClientProvides;
  admin?: AdminProvides;
  schema?: SchemaProvides;
  widget?: WidgetProvides;
}

export interface ServerProvides {
  /** NestJS Module class name (e.g. "BlogModule") */
  module: string;
  /** tRPC router variable name (e.g. "blogRouter") */
  router: string;
  /** tRPC router key in the merged router object (e.g. "blog") */
  routerKey: string;
}

export interface ClientProvides {
  /** Route factory function name (e.g. "createBlogRoutes") */
  routes: string;
}

export interface AdminProvides {
  /** Admin route factory function name (e.g. "createBlogAdminRoutes") */
  routes: string;
  /** Sidebar menu config */
  menu?: AdminMenuConfig;
}

export interface AdminMenuConfig {
  label: string;
  icon: string;
  order: number;
}

export interface SchemaProvides {
  /** DB table names managed by this feature */
  tables: string[];
}

export interface WidgetProvides {
  /** Main component name (e.g. "CommentSection") */
  component: string;
  /** Props the widget accepts */
  props?: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/manifest/types.ts
git commit -m "feat(atlas-engine): add feature.json manifest types"
```

---

### Task 2: Write manifest scanner tests

**Files:**
- Create: `packages/atlas-engine/src/manifest/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/atlas-engine/src/manifest/scanner.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { scanFeatureManifests } from "./scanner";

const TEST_DIR = join(__dirname, "__test_fixtures__");

function writeManifest(featureId: string, manifest: Record<string, unknown>) {
  const dir = join(TEST_DIR, "features", featureId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "feature.json"), JSON.stringify(manifest, null, 2));
}

beforeEach(() => {
  mkdirSync(join(TEST_DIR, "features"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("scanFeatureManifests", () => {
  it("returns empty array when features dir is empty", () => {
    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toEqual([]);
  });

  it("reads a single feature.json manifest", () => {
    writeManifest("blog", {
      id: "blog",
      name: "블로그",
      version: "1.0.0",
      type: "page",
      group: "content",
      icon: "FileText",
      dependencies: [],
      provides: {
        server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
        client: { routes: "createBlogRoutes" },
        schema: { tables: ["blog_posts"] },
      },
    });

    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("blog");
    expect(result[0].provides.server?.module).toBe("BlogModule");
  });

  it("reads multiple manifests sorted by id", () => {
    writeManifest("comment", {
      id: "comment", name: "댓글", version: "1.0.0", type: "widget",
      group: "content", icon: "MessageSquare", dependencies: [],
      provides: { server: { module: "CommentModule", router: "commentRouter", routerKey: "comment" } },
    });
    writeManifest("blog", {
      id: "blog", name: "블로그", version: "1.0.0", type: "page",
      group: "content", icon: "FileText", dependencies: ["comment"],
      provides: { server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" } },
    });

    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("blog");
    expect(result[1].id).toBe("comment");
  });

  it("skips directories without feature.json", () => {
    mkdirSync(join(TEST_DIR, "features", "broken"), { recursive: true });
    writeManifest("blog", {
      id: "blog", name: "블로그", version: "1.0.0", type: "page",
      group: "content", icon: "FileText", dependencies: [],
      provides: { server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" } },
    });

    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("blog");
  });

  it("skips dotfiles and _prefixed directories", () => {
    mkdirSync(join(TEST_DIR, "features", ".hidden"), { recursive: true });
    writeFileSync(join(TEST_DIR, "features", ".hidden", "feature.json"), "{}");
    mkdirSync(join(TEST_DIR, "features", "_internal"), { recursive: true });
    writeFileSync(join(TEST_DIR, "features", "_internal", "feature.json"), "{}");

    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toEqual([]);
  });

  it("returns empty array when features dir does not exist", () => {
    const result = scanFeatureManifests("/nonexistent/path/features");
    expect(result).toEqual([]);
  });

  it("skips directories with malformed feature.json", () => {
    const dir = join(TEST_DIR, "features", "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "feature.json"), "{ invalid json }");
    writeManifest("blog", {
      id: "blog", name: "블로그", version: "1.0.0", type: "page",
      group: "content", icon: "FileText", dependencies: [],
      provides: { server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" } },
    });

    const result = scanFeatureManifests(join(TEST_DIR, "features"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("blog");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/manifest/scanner.test.ts`
Expected: FAIL — `Cannot find module './scanner'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/manifest/scanner.test.ts
git commit -m "test(atlas-engine): add manifest scanner tests"
```

---

### Task 3: Implement manifest scanner

**Files:**
- Create: `packages/atlas-engine/src/manifest/scanner.ts`

- [ ] **Step 1: Implement the scanner**

```typescript
// packages/atlas-engine/src/manifest/scanner.ts
import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import type { FeatureManifest } from "./types";

/**
 * Scan a features directory for feature.json manifests.
 *
 * Reads each subdirectory of `featuresDir`, looks for a `feature.json` file,
 * parses it, and returns an array of manifests sorted by id.
 *
 * Skips directories that:
 * - start with `.` or `_`
 * - don't contain a feature.json
 * - have .gitkeep only
 */
export function scanFeatureManifests(featuresDir: string): FeatureManifest[] {
  if (!existsSync(featuresDir)) return [];

  const entries = readdirSync(featuresDir, { withFileTypes: true });
  const manifests: FeatureManifest[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const manifestPath = join(featuresDir, entry.name, "feature.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const content = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(content) as FeatureManifest;

      // Ensure optionalDependencies defaults to empty array
      if (!manifest.optionalDependencies) {
        manifest.optionalDependencies = [];
      }

      manifests.push(manifest);
    } catch {
      // Skip malformed manifests
      console.warn(`Warning: Failed to parse ${manifestPath}`);
    }
  }

  return manifests.sort((a, b) => a.id.localeCompare(b.id));
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/manifest/scanner.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/manifest/scanner.ts
git commit -m "feat(atlas-engine): implement manifest scanner"
```

---

### Task 4: Write registry adapter tests

**Files:**
- Create: `packages/atlas-engine/src/manifest/adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/atlas-engine/src/manifest/adapter.test.ts
import { describe, it, expect } from "vitest";
import { manifestsToRegistry } from "./adapter";
import type { FeatureManifest } from "./types";

const blogManifest: FeatureManifest = {
  id: "blog",
  name: "블로그",
  version: "1.0.0",
  type: "page",
  group: "content",
  icon: "FileText",
  dependencies: ["comment"],
  optionalDependencies: [],
  provides: {
    server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
    client: { routes: "createBlogRoutes" },
    admin: {
      routes: "createBlogAdminRoutes",
      menu: { label: "블로그", icon: "FileText", order: 10 },
    },
    schema: { tables: ["blog_posts", "blog_categories"] },
  },
};

const commentManifest: FeatureManifest = {
  id: "comment",
  name: "댓글",
  version: "1.0.0",
  type: "widget",
  group: "content",
  icon: "MessageSquare",
  dependencies: [],
  optionalDependencies: [],
  provides: {
    server: { module: "CommentModule", router: "commentRouter", routerKey: "comment" },
    widget: { component: "CommentSection", props: ["targetType", "targetId"] },
    schema: { tables: ["comments"] },
  },
};

describe("manifestsToRegistry", () => {
  it("converts manifests to FeatureRegistry format", () => {
    const registry = manifestsToRegistry([blogManifest, commentManifest]);

    expect(registry.version).toBe("1.0.0");
    expect(registry.source).toBe("superbuilder-features");
    expect(Object.keys(registry.features)).toEqual(["blog", "comment"]);
  });

  it("maps server provides to router and server paths", () => {
    const registry = manifestsToRegistry([blogManifest]);
    const blog = registry.features.blog;

    expect(blog.router).toEqual({
      key: "blog",
      import: "blogRouter",
      from: "@repo/features/blog",
    });
    expect(blog.server.module).toBe("packages/features/blog/blog.module.ts");
  });

  it("maps client provides to client paths", () => {
    const registry = manifestsToRegistry([blogManifest]);
    const blog = registry.features.blog;

    expect(blog.client.app).toBe("apps/app/src/features/blog/");
  });

  it("maps admin provides to admin config", () => {
    const registry = manifestsToRegistry([blogManifest]);
    const blog = registry.features.blog;

    expect(blog.admin).toEqual({
      showInSidebar: true,
      path: "/admin/blog",
      label: "블로그",
      order: 10,
    });
  });

  it("maps schema provides to schema paths", () => {
    const registry = manifestsToRegistry([blogManifest]);
    const blog = registry.features.blog;

    expect(blog.schema.tables).toEqual(["blog_posts", "blog_categories"]);
    expect(blog.schema.path).toContain("blog");
  });

  it("maps widget provides to widget paths", () => {
    const registry = manifestsToRegistry([commentManifest]);
    const comment = registry.features.comment;

    expect(comment.widget).toEqual({
      path: expect.stringContaining("comment"),
      export: "@repo/widgets/comment",
    });
  });

  it("preserves dependencies", () => {
    const registry = manifestsToRegistry([blogManifest, commentManifest]);
    expect(registry.features.blog.dependencies).toEqual(["comment"]);
    expect(registry.features.comment.dependencies).toEqual([]);
  });

  it("includes standard groups", () => {
    const registry = manifestsToRegistry([blogManifest]);
    expect(registry.groups).toHaveProperty("core");
    expect(registry.groups).toHaveProperty("content");
    expect(registry.groups).toHaveProperty("commerce");
  });

  it("returns empty registry for empty input", () => {
    const registry = manifestsToRegistry([]);
    expect(Object.keys(registry.features)).toHaveLength(0);
    expect(registry.core).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/manifest/adapter.test.ts`
Expected: FAIL — `Cannot find module './adapter'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/manifest/adapter.test.ts
git commit -m "test(atlas-engine): add registry adapter tests"
```

---

### Task 5: Implement registry adapter

**Files:**
- Create: `packages/atlas-engine/src/manifest/adapter.ts`

- [ ] **Step 1: Implement the adapter**

```typescript
// packages/atlas-engine/src/manifest/adapter.ts
import type {
  FeatureRegistry,
  FeatureEntry,
  FeatureType,
  FeatureGroup,
} from "../registry/types";
import type { FeatureManifest } from "./types";

/**
 * Convert an array of FeatureManifests into a FeatureRegistry.
 *
 * This bridges the new feature.json format to the existing FeatureRegistry
 * type used by the resolver, extractor, and scaffold engine.
 */
export function manifestsToRegistry(
  manifests: FeatureManifest[],
): FeatureRegistry {
  const features: Record<string, FeatureEntry> = {};

  for (const manifest of manifests) {
    features[manifest.id] = manifestToEntry(manifest);
  }

  // Detect core features (profile, role-permission if present)
  const coreFeatures = manifests
    .filter((m) => m.group === "core")
    .map((m) => m.id);

  return {
    version: "1.0.0",
    source: "superbuilder-features",
    features,
    core: coreFeatures,
    groups: {
      core: { label: "코어", order: 0 },
      content: { label: "콘텐츠", order: 1 },
      commerce: { label: "상거래", order: 2 },
      community: { label: "커뮤니티", order: 3 },
      system: { label: "시스템", order: 4 },
      template: { label: "템플릿", order: 5 },
    },
  };
}

function manifestToEntry(manifest: FeatureManifest): FeatureEntry {
  const { id, provides } = manifest;

  const entry: FeatureEntry = {
    name: manifest.name,
    type: manifest.type as FeatureType,
    icon: manifest.icon,
    group: manifest.group as FeatureGroup,
    description: manifest.description,
    dependencies: manifest.dependencies,
    optionalDependencies: manifest.optionalDependencies ?? [],

    // Router mapping from provides.server
    router: provides.server
      ? {
          key: provides.server.routerKey,
          import: provides.server.router,
          from: `@repo/features/${id}`,
        }
      : { key: id, import: `${toCamelCase(id)}Router`, from: `@repo/features/${id}` },

    // Server paths (target project paths)
    server: {
      module: `packages/features/${id}/${id}.module.ts`,
      router: `packages/features/${id}/${id}.router.ts`,
      controller: `packages/features/${id}/controller/`,
    },

    // Client paths
    client: {
      ...(provides.client ? { app: `apps/app/src/features/${id}/` } : {}),
      ...(provides.admin ? { admin: `apps/system-admin/src/features/${id}/` } : {}),
    },

    // Schema paths
    schema: {
      tables: provides.schema?.tables ?? [],
      path: provides.schema
        ? `packages/drizzle/src/schema/features/${id}/`
        : "",
    },

    // Widget paths (widget features only)
    ...(provides.widget
      ? {
          widget: {
            path: `packages/widgets/src/${id}/`,
            export: `@repo/widgets/${id}`,
          },
        }
      : {}),

    // Admin config
    ...(provides.admin?.menu
      ? {
          admin: {
            showInSidebar: true,
            path: `/admin/${id}`,
            label: provides.admin.menu.label,
            order: provides.admin.menu.order,
          },
        }
      : {}),
  };

  return entry;
}

/** Convert kebab-case to camelCase */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/manifest/adapter.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/manifest/adapter.ts
git commit -m "feat(atlas-engine): implement registry adapter for feature.json"
```

---

### Task 6: Create manifest module barrel export

**Files:**
- Create: `packages/atlas-engine/src/manifest/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
// packages/atlas-engine/src/manifest/index.ts
export { scanFeatureManifests } from "./scanner";
export { manifestsToRegistry } from "./adapter";
export type {
  FeatureManifest,
  Provides,
  ServerProvides,
  ClientProvides,
  AdminProvides,
  AdminMenuConfig,
  SchemaProvides,
  WidgetProvides,
} from "./types";
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/manifest/index.ts
git commit -m "feat(atlas-engine): add manifest module barrel export"
```

---

## Chunk 2: Connection Deriver & Applier

### Task 7: Define connection types

**Files:**
- Create: `packages/atlas-engine/src/connection/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/atlas-engine/src/connection/types.ts

/**
 * Auto-derived connection code snippets.
 *
 * Each field corresponds to code that gets inserted at [ATLAS:*] markers
 * in template files, or JSON manipulation for widget exports.
 *
 * All string values use TARGET project namespace (@repo/*, @features/*),
 * not @superbuilder/* source namespace.
 */
export interface DerivedConnections {
  /** import { XxxModule } from "@repo/features/xxx"; */
  nestModuleImport?: string;
  /** XxxModule, */
  nestModuleRef?: string;
  /** import { xxxRouter } from "@repo/features/xxx"; */
  trpcRouterImport?: string;
  /** xxx: xxxRouter, */
  trpcRouterKey?: string;
  /** import { xxxRouter } from "./xxx"; (for app-router.ts type file) */
  trpcTypeImport?: string;
  /** xxx: xxxRouter, (same key for type file) */
  trpcTypeKey?: string;
  /** import { createXxxRoutes } from "@features/xxx"; */
  clientRoutesImport?: string;
  /** ...createXxxRoutes(rootRoute), */
  clientRoutesSpread?: string;
  /** import { createXxxAdminRoutes } from "./features/xxx"; */
  adminRoutesImport?: string;
  /** ...createXxxAdminRoutes(adminLayoutRoute), */
  adminRoutesSpread?: string;
  /** Admin menu config object */
  adminMenu?: string;
  /** export * from "./features/xxx"; */
  schemaExport?: string;
  /** "table_name1", "table_name2" */
  tablesFilter?: string;
  /** Widget export { subpath, entry } for JSON manipulation */
  widgetExport?: { subpath: string; entry: string };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/connection/types.ts
git commit -m "feat(atlas-engine): add connection types"
```

---

### Task 8: Write connection deriver tests

**Files:**
- Create: `packages/atlas-engine/src/connection/deriver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/atlas-engine/src/connection/deriver.test.ts
import { describe, it, expect } from "vitest";
import { deriveConnections } from "./deriver";
import type { Provides } from "../manifest/types";

describe("deriveConnections", () => {
  it("derives NestJS module connections from server provides", () => {
    const provides: Provides = {
      server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
    };

    const result = deriveConnections("blog", provides);

    expect(result.nestModuleImport).toBe(
      'import { BlogModule } from "@repo/features/blog";',
    );
    expect(result.nestModuleRef).toBe("BlogModule,");
  });

  it("derives tRPC router connections from server provides", () => {
    const provides: Provides = {
      server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
    };

    const result = deriveConnections("blog", provides);

    expect(result.trpcRouterImport).toBe(
      'import { blogRouter } from "@repo/features/blog";',
    );
    expect(result.trpcRouterKey).toBe("blog: blogRouter,");
    expect(result.trpcTypeImport).toBe(
      'import { blogRouter } from "./blog";',
    );
    expect(result.trpcTypeKey).toBe("blog: blogRouter,");
  });

  it("derives client route connections from client provides", () => {
    const provides: Provides = {
      client: { routes: "createBlogRoutes" },
    };

    const result = deriveConnections("blog", provides);

    expect(result.clientRoutesImport).toBe(
      'import { createBlogRoutes } from "@features/blog";',
    );
    expect(result.clientRoutesSpread).toBe(
      "...createBlogRoutes(rootRoute),",
    );
  });

  it("derives admin connections from admin provides", () => {
    const provides: Provides = {
      admin: {
        routes: "createBlogAdminRoutes",
        menu: { label: "블로그", icon: "FileText", order: 10 },
      },
    };

    const result = deriveConnections("blog", provides);

    expect(result.adminRoutesImport).toBe(
      'import { createBlogAdminRoutes } from "./features/blog";',
    );
    expect(result.adminRoutesSpread).toBe(
      "...createBlogAdminRoutes(adminLayoutRoute),",
    );
    expect(result.adminMenu).toContain('"label"');
    expect(result.adminMenu).toContain("블로그");
  });

  it("derives schema connections from schema provides", () => {
    const provides: Provides = {
      schema: { tables: ["blog_posts", "blog_categories"] },
    };

    const result = deriveConnections("blog", provides);

    expect(result.schemaExport).toBe('export * from "./features/blog";');
    expect(result.tablesFilter).toBe('"blog_posts", "blog_categories"');
  });

  it("derives widget export from widget provides", () => {
    const provides: Provides = {
      widget: { component: "CommentSection", props: ["targetType", "targetId"] },
    };

    const result = deriveConnections("comment", provides);

    expect(result.widgetExport).toEqual({
      subpath: "./comment",
      entry: "./src/comment/index.ts",
    });
  });

  it("returns empty object when provides is empty", () => {
    const result = deriveConnections("empty", {});
    expect(result).toEqual({});
  });

  it("handles full provides with all sections", () => {
    const provides: Provides = {
      server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
      client: { routes: "createBlogRoutes" },
      admin: {
        routes: "createBlogAdminRoutes",
        menu: { label: "Blog", icon: "FileText", order: 10 },
      },
      schema: { tables: ["blog_posts"] },
    };

    const result = deriveConnections("blog", provides);

    expect(result.nestModuleImport).toBeDefined();
    expect(result.trpcRouterImport).toBeDefined();
    expect(result.clientRoutesImport).toBeDefined();
    expect(result.adminRoutesImport).toBeDefined();
    expect(result.schemaExport).toBeDefined();
    expect(result.tablesFilter).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/deriver.test.ts`
Expected: FAIL — `Cannot find module './deriver'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/connection/deriver.test.ts
git commit -m "test(atlas-engine): add connection deriver tests"
```

---

### Task 9: Implement connection deriver

**Files:**
- Create: `packages/atlas-engine/src/connection/deriver.ts`

- [ ] **Step 1: Implement the deriver**

```typescript
// packages/atlas-engine/src/connection/deriver.ts
import type { Provides } from "../manifest/types";
import type { DerivedConnections } from "./types";

/**
 * Derive connection code snippets from a feature's `provides` declaration.
 *
 * All generated code uses TARGET project namespace (@repo/*, @features/*),
 * not the @superbuilder/* source namespace.
 *
 * @param featureId - Feature directory name (e.g. "blog")
 * @param provides - Feature's provides declaration from feature.json
 * @returns Connection snippets for each extension point
 */
export function deriveConnections(
  featureId: string,
  provides: Provides,
): DerivedConnections {
  const connections: DerivedConnections = {};

  if (provides.server) {
    const { module: mod, router, routerKey } = provides.server;

    // NestJS module registration
    connections.nestModuleImport =
      `import { ${mod} } from "@repo/features/${featureId}";`;
    connections.nestModuleRef = `${mod},`;

    // tRPC router — runtime (apps/server/src/trpc/router.ts)
    connections.trpcRouterImport =
      `import { ${router} } from "@repo/features/${featureId}";`;
    connections.trpcRouterKey = `${routerKey}: ${router},`;

    // tRPC router — type (packages/features/app-router.ts)
    connections.trpcTypeImport =
      `import { ${router} } from "./${featureId}";`;
    connections.trpcTypeKey = `${routerKey}: ${router},`;
  }

  if (provides.client) {
    connections.clientRoutesImport =
      `import { ${provides.client.routes} } from "@features/${featureId}";`;
    connections.clientRoutesSpread =
      `...${provides.client.routes}(rootRoute),`;
  }

  if (provides.admin) {
    connections.adminRoutesImport =
      `import { ${provides.admin.routes} } from "./features/${featureId}";`;
    connections.adminRoutesSpread =
      `...${provides.admin.routes}(adminLayoutRoute),`;

    if (provides.admin.menu) {
      connections.adminMenu = JSON.stringify(
        {
          id: featureId,
          ...provides.admin.menu,
          path: `/admin/${featureId}`,
        },
        null,
        2,
      );
    }
  }

  if (provides.schema) {
    connections.schemaExport =
      `export * from "./features/${featureId}";`;
    connections.tablesFilter = provides.schema.tables
      .map((t) => `"${t}"`)
      .join(", ");
  }

  if (provides.widget) {
    connections.widgetExport = {
      subpath: `./${featureId}`,
      entry: `./src/${featureId}/index.ts`,
    };
  }

  return connections;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/deriver.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/connection/deriver.ts
git commit -m "feat(atlas-engine): implement connection deriver"
```

---

### Task 10: Write connection applier tests

**Files:**
- Create: `packages/atlas-engine/src/connection/applier.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/atlas-engine/src/connection/applier.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { insertAtMarker } from "./applier";
import { registerWidgetExport } from "./widget-export";

const TEST_DIR = join(__dirname, "__test_applier_fixtures__");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("insertAtMarker", () => {
  it("inserts content before the closing marker", () => {
    const filePath = join(TEST_DIR, "test.ts");
    writeFileSync(filePath, [
      "// header",
      "// [ATLAS:IMPORTS]",
      "// [/ATLAS:IMPORTS]",
      "// footer",
    ].join("\n"));

    insertAtMarker(filePath, "IMPORTS", 'import { Foo } from "foo";');

    const result = readFileSync(filePath, "utf-8");
    expect(result).toContain('import { Foo } from "foo";');
    expect(result).toContain("// [ATLAS:IMPORTS]");
    expect(result).toContain("// [/ATLAS:IMPORTS]");
  });

  it("inserts multiple lines between markers", () => {
    const filePath = join(TEST_DIR, "test.ts");
    writeFileSync(filePath, [
      "// [ATLAS:MODULES]",
      "// [/ATLAS:MODULES]",
    ].join("\n"));

    insertAtMarker(filePath, "MODULES", "FooModule,");
    insertAtMarker(filePath, "MODULES", "BarModule,");

    const result = readFileSync(filePath, "utf-8");
    expect(result).toContain("FooModule,");
    expect(result).toContain("BarModule,");
  });

  it("does nothing when marker is not found", () => {
    const filePath = join(TEST_DIR, "test.ts");
    const original = "// no markers here";
    writeFileSync(filePath, original);

    insertAtMarker(filePath, "MISSING", "content");

    const result = readFileSync(filePath, "utf-8");
    expect(result).toBe(original);
  });

  it("preserves existing content between markers", () => {
    const filePath = join(TEST_DIR, "test.ts");
    writeFileSync(filePath, [
      "// [ATLAS:IMPORTS]",
      'import { Existing } from "existing";',
      "// [/ATLAS:IMPORTS]",
    ].join("\n"));

    insertAtMarker(filePath, "IMPORTS", 'import { New } from "new";');

    const result = readFileSync(filePath, "utf-8");
    expect(result).toContain('import { Existing } from "existing";');
    expect(result).toContain('import { New } from "new";');
  });
});

describe("registerWidgetExport", () => {
  it("adds subpath export to package.json", () => {
    const pkgPath = join(TEST_DIR, "packages", "widgets");
    mkdirSync(pkgPath, { recursive: true });
    writeFileSync(
      join(pkgPath, "package.json"),
      JSON.stringify({
        name: "@repo/widgets",
        exports: { ".": "./src/index.ts" },
      }, null, 2),
    );

    registerWidgetExport(TEST_DIR, "comment", {
      subpath: "./comment",
      entry: "./src/comment/index.ts",
    });

    const result = JSON.parse(readFileSync(join(pkgPath, "package.json"), "utf-8"));
    expect(result.exports["./comment"]).toBe("./src/comment/index.ts");
    expect(result.exports["."]).toBe("./src/index.ts"); // existing preserved
  });

  it("creates exports field if missing", () => {
    const pkgPath = join(TEST_DIR, "packages", "widgets");
    mkdirSync(pkgPath, { recursive: true });
    writeFileSync(
      join(pkgPath, "package.json"),
      JSON.stringify({ name: "@repo/widgets" }, null, 2),
    );

    registerWidgetExport(TEST_DIR, "reaction", {
      subpath: "./reaction",
      entry: "./src/reaction/index.ts",
    });

    const result = JSON.parse(readFileSync(join(pkgPath, "package.json"), "utf-8"));
    expect(result.exports["./reaction"]).toBe("./src/reaction/index.ts");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/applier.test.ts`
Expected: FAIL — `Cannot find module './applier'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/connection/applier.test.ts
git commit -m "test(atlas-engine): add connection applier tests"
```

---

### Task 11: Implement connection applier and widget export

**Files:**
- Create: `packages/atlas-engine/src/connection/applier.ts`
- Create: `packages/atlas-engine/src/connection/widget-export.ts`

- [ ] **Step 1: Implement the marker applier**

```typescript
// packages/atlas-engine/src/connection/applier.ts
import { readFileSync, writeFileSync } from "fs";

/**
 * Insert content before the closing [/ATLAS:{marker}] tag in a file.
 *
 * Looks for `// [/ATLAS:{marker}]` and inserts the content line before it.
 * If the marker is not found, the file is unchanged.
 */
export function insertAtMarker(
  filePath: string,
  marker: string,
  content: string,
): void {
  const original = readFileSync(filePath, "utf-8");
  const closingTag = `[/ATLAS:${marker}]`;

  const closingIdx = original.indexOf(closingTag);
  if (closingIdx === -1) return;

  // Find the start of the line containing the closing tag
  let lineStart = closingIdx;
  while (lineStart > 0 && original[lineStart - 1] !== "\n") {
    lineStart--;
  }

  // Get indentation of the closing tag line
  const closingLine = original.substring(lineStart, closingIdx);
  const indent = closingLine.match(/^(\s*)/)?.[1] ?? "";

  // Insert content before the closing tag line
  const insertion = `${indent}${content}\n`;
  const result =
    original.substring(0, lineStart) +
    insertion +
    original.substring(lineStart);

  writeFileSync(filePath, result, "utf-8");
}
```

- [ ] **Step 2: Implement widget export registration**

```typescript
// packages/atlas-engine/src/connection/widget-export.ts
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Register a widget export in packages/widgets/package.json.
 *
 * Adds a new subpath export entry to the `exports` field via JSON manipulation.
 * This is NOT a code marker insertion — it's direct JSON file editing.
 */
export function registerWidgetExport(
  templateDir: string,
  featureId: string,
  widgetExport: { subpath: string; entry: string },
): void {
  const pkgPath = join(templateDir, "packages/widgets/package.json");
  const raw = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);

  pkg.exports = pkg.exports || {};
  pkg.exports[widgetExport.subpath] = widgetExport.entry;

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}
```

- [ ] **Step 3: Run applier tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/applier.test.ts`
Expected: All 6 tests PASS (4 applier + 2 widget-export)

- [ ] **Step 4: Commit**

```bash
git add packages/atlas-engine/src/connection/applier.ts packages/atlas-engine/src/connection/widget-export.ts
git commit -m "feat(atlas-engine): implement connection applier and widget export"
```

---

### Task 12: Create connection module barrel export

**Files:**
- Create: `packages/atlas-engine/src/connection/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
// packages/atlas-engine/src/connection/index.ts
export { deriveConnections } from "./deriver";
export { insertAtMarker } from "./applier";
export { registerWidgetExport } from "./widget-export";
export type { DerivedConnections } from "./types";
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/connection/index.ts
git commit -m "feat(atlas-engine): add connection module barrel export"
```

---

### Task 13: Write applyConnections orchestrator test

**Files:**
- Create: `packages/atlas-engine/src/connection/apply-connections.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/atlas-engine/src/connection/apply-connections.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { applyConnections } from "./apply-connections";
import type { FeatureManifest } from "../manifest/types";

const TEST_DIR = join(__dirname, "__test_apply_fixtures__");

const blogManifest: FeatureManifest = {
  id: "blog",
  name: "블로그",
  version: "1.0.0",
  type: "page",
  group: "content",
  icon: "FileText",
  dependencies: [],
  optionalDependencies: [],
  provides: {
    server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
    client: { routes: "createBlogRoutes" },
    admin: {
      routes: "createBlogAdminRoutes",
      menu: { label: "블로그", icon: "FileText", order: 10 },
    },
    schema: { tables: ["blog_posts"] },
  },
};

function createTemplateFile(relativePath: string, content: string) {
  const fullPath = join(TEST_DIR, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });

  // Create minimal template files with markers
  createTemplateFile("apps/atlas-server/src/app.module.ts", [
    "// [ATLAS:IMPORTS]",
    "// [/ATLAS:IMPORTS]",
    "@Module({",
    "  imports: [",
    "    // [ATLAS:MODULES]",
    "    // [/ATLAS:MODULES]",
    "  ],",
    "})",
  ].join("\n"));

  createTemplateFile("apps/atlas-server/src/trpc/router.ts", [
    "// [ATLAS:IMPORTS]",
    "// [/ATLAS:IMPORTS]",
    "export const trpcRouter = router({",
    "  // [ATLAS:ROUTERS]",
    "  // [/ATLAS:ROUTERS]",
    "});",
  ].join("\n"));

  createTemplateFile("packages/features/app-router.ts", [
    "// [ATLAS:IMPORTS]",
    "// [/ATLAS:IMPORTS]",
    "const _appRouter = router({",
    "  // [ATLAS:ROUTERS]",
    "  // [/ATLAS:ROUTERS]",
    "});",
  ].join("\n"));

  createTemplateFile("apps/app/src/router.tsx", [
    "// [ATLAS:IMPORTS]",
    "// [/ATLAS:IMPORTS]",
    "const routeTree = rootRoute.addChildren([",
    "  // [ATLAS:ROUTES]",
    "  // [/ATLAS:ROUTES]",
    "]);",
  ].join("\n"));

  createTemplateFile("apps/system-admin/src/router.tsx", [
    "// [ATLAS:IMPORTS]",
    "// [/ATLAS:IMPORTS]",
    "adminLayoutRoute.addChildren([",
    "  // [ATLAS:ADMIN_ROUTES]",
    "  // [/ATLAS:ADMIN_ROUTES]",
    "]),",
  ].join("\n"));

  createTemplateFile("packages/drizzle/src/schema/index.ts", [
    "// [ATLAS:SCHEMA_EXPORTS]",
    "// [/ATLAS:SCHEMA_EXPORTS]",
  ].join("\n"));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("applyConnections", () => {
  it("inserts NestJS module import and ref at markers", () => {
    applyConnections(TEST_DIR, blogManifest);

    const appModule = readFileSync(
      join(TEST_DIR, "apps/atlas-server/src/app.module.ts"), "utf-8",
    );
    expect(appModule).toContain('import { BlogModule } from "@repo/features/blog"');
    expect(appModule).toContain("BlogModule,");
  });

  it("inserts tRPC router at both runtime and type files", () => {
    applyConnections(TEST_DIR, blogManifest);

    const runtimeRouter = readFileSync(
      join(TEST_DIR, "apps/atlas-server/src/trpc/router.ts"), "utf-8",
    );
    expect(runtimeRouter).toContain('import { blogRouter } from "@repo/features/blog"');
    expect(runtimeRouter).toContain("blog: blogRouter,");

    const typeRouter = readFileSync(
      join(TEST_DIR, "packages/features/app-router.ts"), "utf-8",
    );
    expect(typeRouter).toContain('import { blogRouter } from "./blog"');
    expect(typeRouter).toContain("blog: blogRouter,");
  });

  it("inserts client routes at app router markers", () => {
    applyConnections(TEST_DIR, blogManifest);

    const appRouter = readFileSync(
      join(TEST_DIR, "apps/app/src/router.tsx"), "utf-8",
    );
    expect(appRouter).toContain('import { createBlogRoutes } from "@features/blog"');
    expect(appRouter).toContain("...createBlogRoutes(rootRoute),");
  });

  it("inserts admin routes at admin router markers", () => {
    applyConnections(TEST_DIR, blogManifest);

    const adminRouter = readFileSync(
      join(TEST_DIR, "apps/system-admin/src/router.tsx"), "utf-8",
    );
    expect(adminRouter).toContain('import { createBlogAdminRoutes } from "./features/blog"');
    expect(adminRouter).toContain("...createBlogAdminRoutes(adminLayoutRoute),");
  });

  it("inserts schema exports", () => {
    applyConnections(TEST_DIR, blogManifest);

    const schemaIndex = readFileSync(
      join(TEST_DIR, "packages/drizzle/src/schema/index.ts"), "utf-8",
    );
    expect(schemaIndex).toContain('export * from "./features/blog"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/apply-connections.test.ts`
Expected: FAIL — `Cannot find module './apply-connections'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/connection/apply-connections.test.ts
git commit -m "test(atlas-engine): add applyConnections orchestrator tests"
```

---

### Task 14: Implement applyConnections orchestrator

**Files:**
- Create: `packages/atlas-engine/src/connection/apply-connections.ts`

- [ ] **Step 1: Implement the orchestrator**

```typescript
// packages/atlas-engine/src/connection/apply-connections.ts
import { join } from "path";
import { deriveConnections } from "./deriver";
import { insertAtMarker } from "./applier";
import { registerWidgetExport } from "./widget-export";
import type { FeatureManifest } from "../manifest/types";

/**
 * Marker-to-file mapping.
 *
 * Each connection field maps to a specific (file, marker) pair
 * in the template project.
 */
interface MarkerTarget {
  file: string;
  marker: string;
}

const MARKER_MAP: Record<string, MarkerTarget> = {
  nestModuleImport: {
    file: "apps/atlas-server/src/app.module.ts",
    marker: "IMPORTS",
  },
  nestModuleRef: {
    file: "apps/atlas-server/src/app.module.ts",
    marker: "MODULES",
  },
  trpcRouterImport: {
    file: "apps/atlas-server/src/trpc/router.ts",
    marker: "IMPORTS",
  },
  trpcRouterKey: {
    file: "apps/atlas-server/src/trpc/router.ts",
    marker: "ROUTERS",
  },
  trpcTypeImport: {
    file: "packages/features/app-router.ts",
    marker: "IMPORTS",
  },
  trpcTypeKey: {
    file: "packages/features/app-router.ts",
    marker: "ROUTERS",
  },
  clientRoutesImport: {
    file: "apps/app/src/router.tsx",
    marker: "IMPORTS",
  },
  clientRoutesSpread: {
    file: "apps/app/src/router.tsx",
    marker: "ROUTES",
  },
  adminRoutesImport: {
    file: "apps/system-admin/src/router.tsx",
    marker: "IMPORTS",
  },
  adminRoutesSpread: {
    file: "apps/system-admin/src/router.tsx",
    marker: "ADMIN_ROUTES",
  },
  schemaExport: {
    file: "packages/drizzle/src/schema/index.ts",
    marker: "SCHEMA_EXPORTS",
  },
  tablesFilter: {
    file: "packages/drizzle/drizzle.config.ts",
    marker: "TABLES_FILTER",
  },
  adminMenu: {
    file: "apps/system-admin/src/feature-config.ts",
    marker: "FEATURE_MENUS",
  },
};

/**
 * Apply all auto-derived connections for a feature to template files.
 *
 * 1. Calls deriveConnections() to generate code snippets from provides
 * 2. Maps each snippet to the correct (file, marker) pair
 * 3. Calls insertAtMarker() for each
 * 4. Calls registerWidgetExport() for widget features
 *
 * @param templateDir - Root of the scaffolded project
 * @param manifest - Feature manifest from feature.json
 */
export function applyConnections(
  templateDir: string,
  manifest: FeatureManifest,
): void {
  const connections = deriveConnections(manifest.id, manifest.provides);

  // Apply each connection to its marker target
  for (const [field, value] of Object.entries(connections)) {
    if (field === "widgetExport" || !value || typeof value !== "string") continue;

    const target = MARKER_MAP[field];
    if (!target) continue;

    const filePath = join(templateDir, target.file);
    insertAtMarker(filePath, target.marker, value);
  }

  // Handle widget export separately (JSON manipulation, not marker)
  if (connections.widgetExport) {
    registerWidgetExport(templateDir, manifest.id, connections.widgetExport);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/connection/apply-connections.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/connection/apply-connections.ts
git commit -m "feat(atlas-engine): implement applyConnections orchestrator"
```

---

### Task 15: Update connection barrel export with orchestrator

**Files:**
- Modify: `packages/atlas-engine/src/connection/index.ts` (from Task 12)

- [ ] **Step 1: Update the barrel export**

Replace the barrel export content from Task 12 with:

```typescript
// packages/atlas-engine/src/connection/index.ts
export { deriveConnections } from "./deriver";
export { insertAtMarker } from "./applier";
export { registerWidgetExport } from "./widget-export";
export { applyConnections } from "./apply-connections";
export type { DerivedConnections } from "./types";
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/connection/index.ts
git commit -m "feat(atlas-engine): export applyConnections from connection module"
```

---

## Chunk 3: Import Transformer & Path Mapping

### Task 16: Define import map constant

**Files:**
- Create: `packages/atlas-engine/src/transform/import-map.ts`

- [ ] **Step 1: Create the import map**

```typescript
// packages/atlas-engine/src/transform/import-map.ts

/**
 * Import transformation rules for feature-json based features.
 *
 * Maps @superbuilder/core-* imports in feature source code (superbuilder-features repo)
 * to @repo/* imports in the target (scaffolded) project.
 *
 * NOTE: This is separate from the existing IMPORT_ALIAS_MAP in path-mapping.ts.
 * - IMPORT_ALIAS_MAP: legacy boilerplate-internal aliases (@superbuilder/features-server → @repo/features)
 * - STATIC_IMPORT_MAP: new feature-json core contract aliases (@superbuilder/core-* → @repo/*)
 *
 * Once all features migrate to feature-json format, IMPORT_ALIAS_MAP can be deprecated.
 * Both maps are applied during scaffold — STATIC_IMPORT_MAP for feature source files,
 * IMPORT_ALIAS_MAP for any remaining legacy template references.
 *
 * Static entries are applied first. Dynamic patterns with {name}
 * are applied after for feature cross-references.
 */
export const STATIC_IMPORT_MAP: Record<string, string> = {
  "@superbuilder/core-auth": "@repo/core/auth",
  "@superbuilder/core-trpc": "@repo/core/trpc",
  "@superbuilder/core-db": "@repo/drizzle",
  "@superbuilder/core-schema": "@repo/drizzle",
  "@superbuilder/core-logger": "@repo/core/logger",
  "@superbuilder/core-ui": "@repo/ui",
};

/**
 * Dynamic import patterns for feature cross-references.
 *
 * These are applied using regex matching with the feature name
 * extracted from the import path.
 */
export const DYNAMIC_IMPORT_PATTERNS: Array<{
  /** Regex to match source import path */
  pattern: RegExp;
  /** Replacement function. $1 = feature name */
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/transform/import-map.ts
git commit -m "feat(atlas-engine): add import transformation map"
```

---

### Task 17: Write import transformer tests

**Files:**
- Create: `packages/atlas-engine/src/transform/import-transformer.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/atlas-engine/src/transform/import-transformer.test.ts
import { describe, it, expect } from "vitest";
import { transformImports, transformImportPath } from "./import-transformer";

describe("transformImportPath", () => {
  it("transforms static core imports", () => {
    expect(transformImportPath("@superbuilder/core-auth")).toBe("@repo/core/auth");
    expect(transformImportPath("@superbuilder/core-trpc")).toBe("@repo/core/trpc");
    expect(transformImportPath("@superbuilder/core-db")).toBe("@repo/drizzle");
    expect(transformImportPath("@superbuilder/core-schema")).toBe("@repo/drizzle");
    expect(transformImportPath("@superbuilder/core-logger")).toBe("@repo/core/logger");
    expect(transformImportPath("@superbuilder/core-ui")).toBe("@repo/ui");
  });

  it("transforms feature cross-reference imports", () => {
    expect(transformImportPath("@superbuilder/feature-blog")).toBe("@repo/features/blog");
    expect(transformImportPath("@superbuilder/feature-comment/widget")).toBe("@repo/widgets/comment");
    expect(transformImportPath("@superbuilder/feature-blog/schema")).toBe("@repo/drizzle");
    expect(transformImportPath("@superbuilder/feature-blog/common")).toBe("@repo/features/blog");
  });

  it("returns null for non-superbuilder imports", () => {
    expect(transformImportPath("react")).toBeNull();
    expect(transformImportPath("@tanstack/react-query")).toBeNull();
    expect(transformImportPath("./local-file")).toBeNull();
    expect(transformImportPath("../sibling")).toBeNull();
  });
});

describe("transformImports", () => {
  it("transforms import statements in TypeScript source", () => {
    const source = `
import { authenticatedAtom } from "@superbuilder/core-auth";
import { publicProcedure } from "@superbuilder/core-trpc";
import { profiles } from "@superbuilder/core-schema";
import { useState } from "react";
`.trim();

    const result = transformImports(source);

    expect(result).toContain('"@repo/core/auth"');
    expect(result).toContain('"@repo/core/trpc"');
    expect(result).toContain('"@repo/drizzle"');
    expect(result).toContain('"react"');
    expect(result).not.toContain("@superbuilder");
  });

  it("transforms both single and double quotes", () => {
    const source = `
import { a } from '@superbuilder/core-auth';
import { b } from "@superbuilder/core-db";
`.trim();

    const result = transformImports(source);

    expect(result).toContain("'@repo/core/auth'");
    expect(result).toContain('"@repo/drizzle"');
  });

  it("transforms dynamic imports", () => {
    const source = `const mod = await import("@superbuilder/core-ui");`;
    const result = transformImports(source);
    expect(result).toContain('"@repo/ui"');
  });

  it("transforms feature cross-references", () => {
    const source = `import { CommentSection } from "@superbuilder/feature-comment/widget";`;
    const result = transformImports(source);
    expect(result).toContain('"@repo/widgets/comment"');
  });

  it("transforms export * from with superbuilder paths", () => {
    const source = `export * from "@superbuilder/core-schema";`;
    const result = transformImports(source);
    expect(result).toBe(`export * from "@repo/drizzle";`);
  });

  it("transforms export { } from with superbuilder paths", () => {
    const source = `export { BlogService } from "@superbuilder/feature-blog";`;
    const result = transformImports(source);
    expect(result).toBe(`export { BlogService } from "@repo/features/blog";`);
  });

  it("preserves non-superbuilder imports unchanged", () => {
    const source = `
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { helper } from "./utils";
`.trim();

    const result = transformImports(source);
    expect(result).toBe(source);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/transform/import-transformer.test.ts`
Expected: FAIL — `Cannot find module './import-transformer'`

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/transform/import-transformer.test.ts
git commit -m "test(atlas-engine): add import transformer tests"
```

---

### Task 18: Implement import transformer

**Files:**
- Create: `packages/atlas-engine/src/transform/import-transformer.ts`

- [ ] **Step 1: Implement the transformer**

```typescript
// packages/atlas-engine/src/transform/import-transformer.ts
import { STATIC_IMPORT_MAP, DYNAMIC_IMPORT_PATTERNS } from "./import-map";

/**
 * Transform a single import path from @superbuilder/* to @repo/*.
 *
 * Returns the transformed path, or null if no transformation applies.
 */
export function transformImportPath(importPath: string): string | null {
  // Check static map first
  if (STATIC_IMPORT_MAP[importPath]) {
    return STATIC_IMPORT_MAP[importPath];
  }

  // Check dynamic patterns
  for (const { pattern, replacement } of DYNAMIC_IMPORT_PATTERNS) {
    const match = importPath.match(pattern);
    if (match) {
      return importPath.replace(pattern, replacement);
    }
  }

  return null;
}

/**
 * Transform all @superbuilder/* imports in a TypeScript/TSX source string.
 *
 * Handles:
 * - import { ... } from "path";
 * - import { ... } from 'path';
 * - import("path")
 * - export { ... } from "path";
 * - export * from "path";
 */
export function transformImports(source: string): string {
  // Match import/export from strings and dynamic imports
  // Captures the quote character to preserve it
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/transform/import-transformer.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/transform/import-transformer.ts
git commit -m "feat(atlas-engine): implement import transformer"
```

---

### Task 19: Create transform module barrel export

**Files:**
- Create: `packages/atlas-engine/src/transform/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
// packages/atlas-engine/src/transform/index.ts
export { transformImports, transformImportPath } from "./import-transformer";
export { STATIC_IMPORT_MAP, DYNAMIC_IMPORT_PATTERNS } from "./import-map";
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/transform/index.ts
git commit -m "feat(atlas-engine): add transform module barrel export"
```

---

### Task 20: Add feature-json source path support to path-mapping

**Files:**
- Modify: `packages/atlas-engine/src/scaffold/path-mapping.ts`

- [ ] **Step 1: Read existing file**

Read: `packages/atlas-engine/src/scaffold/path-mapping.ts`

- [ ] **Step 2: Add feature-json path mapping**

Add the following after the existing `IMPORT_ALIAS_MAP`:

```typescript
/**
 * Feature-json source path mapping.
 *
 * Maps feature package entrypoint directories to target project paths.
 * Used when the source is superbuilder-features/features/{name}/src/*
 * instead of the legacy boilerplate-internal paths.
 */
export const FEATURE_JSON_PATH_MAPPING: PathMapping = {
  server: {
    from: "src/server",
    to: "packages/features",
  },
  client: {
    from: "src/client",
    to: "apps/app/src/features",
  },
  admin: {
    from: "src/admin",
    to: "apps/system-admin/src/features",
  },
  schema: {
    from: "src/schema",
    to: "packages/drizzle/src/schema/features",
  },
  widgets: {
    from: "src/widget",
    to: "packages/widgets/src",
  },
};

/**
 * Resolve source path for a feature-json based feature.
 *
 * @param featuresRepoPath - Path to superbuilder-features/features/ directory
 * @param featureId - Feature directory name
 * @param slot - Which slot (server, client, admin, schema, widgets)
 */
export function resolveFeatureJsonSourcePath(
  featuresRepoPath: string,
  featureId: string,
  slot: PathSlot,
): string {
  return join(featuresRepoPath, featureId, FEATURE_JSON_PATH_MAPPING[slot].from);
}

/**
 * Resolve target path for a feature-json based feature.
 *
 * @param projectDir - Scaffolded project root
 * @param featureId - Feature directory name
 * @param slot - Which slot
 */
export function resolveFeatureJsonTargetPath(
  projectDir: string,
  featureId: string,
  slot: PathSlot,
): string {
  return join(projectDir, FEATURE_JSON_PATH_MAPPING[slot].to, featureId);
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/scaffold/path-mapping.ts
git commit -m "feat(atlas-engine): add feature-json source path mapping"
```

---

### Task 21: Update engine barrel export

**Files:**
- Modify: `packages/atlas-engine/src/index.ts`

- [ ] **Step 1: Read existing file**

Read: `packages/atlas-engine/src/index.ts`

- [ ] **Step 2: Add new module exports**

Add the following to the existing exports:

```typescript
// Manifest (feature.json)
export {
  scanFeatureManifests,
  manifestsToRegistry,
} from "./manifest";
export type {
  FeatureManifest,
  Provides,
} from "./manifest";

// Connection (auto-derived)
export {
  deriveConnections,
  insertAtMarker,
  registerWidgetExport,
  applyConnections,
} from "./connection";
export type { DerivedConnections } from "./connection";

// Transform (import rewriting)
export {
  transformImports,
  transformImportPath,
  STATIC_IMPORT_MAP,
} from "./transform";
```

- [ ] **Step 3: Commit**

```bash
git add packages/atlas-engine/src/index.ts
git commit -m "feat(atlas-engine): export manifest, connection, and transform modules"
```

---

### Task 22: Run all tests and verify

**Files:** (no new files)

- [ ] **Step 1: Run all atlas-engine tests**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/`
Expected: All new tests pass, existing tests still pass

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/bright/Projects/superbuilder && cd packages/atlas-engine && bun run typecheck 2>&1 | tail -20`
Expected: No type errors

- [ ] **Step 3: Verify no existing tests broken**

Run: `cd /Users/bright/Projects/superbuilder && bun test packages/atlas-engine/src/registry/ packages/atlas-engine/src/scaffold/ packages/atlas-engine/src/resolver/`
Expected: All existing tests still pass

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(atlas-engine): verify all tests pass"
```

- [ ] **Step 5: Push**

```bash
git push origin develop
```
