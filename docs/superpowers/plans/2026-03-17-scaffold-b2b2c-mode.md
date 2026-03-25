# Scaffold Engine B2B2C 모드 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 SaaS scaffold를 전혀 수정하지 않고, B2B2C 모드 전용 scaffold/pipeline 함수를 별도 파일로 구현

**Architecture:** 기존 함수들을 import해서 공통 단계를 재사용하고, 변경이 필요한 5개 단계만 신규 파일에 구현. `*-b2b2c.ts` 패턴.

**Tech Stack:** TypeScript, Node.js fs/path, atlas-engine 기존 모듈

**Target:** `/Users/bbright/Projects/superbuilder/packages/atlas-engine/src/`

**Spec:** `docs/superpowers/specs/2026-03-17-scaffold-b2b2c-mode-design.md`

---

## Chunk 1: 타입 확장 + Landing slot 매핑 + Feature 복사

### Task 1: Provides 타입에 landing 추가

**Files:**
- Modify: `packages/atlas-engine/src/manifest/types.ts`

> 이건 기존 파일을 수정하지만, 타입 추가만이므로 기존 동작에 영향 없음.

- [ ] **Step 1: Provides 인터페이스에 landing 추가**

`manifest/types.ts`의 `Provides` 인터페이스에 landing 필드 추가:

```typescript
export interface Provides {
  server?: ServerProvides;
  client?: ClientProvides;
  admin?: AdminProvides;
  schema?: SchemaProvides;
  widget?: WidgetProvides;
  landing?: LandingProvides;  // 추가
}
```

- [ ] **Step 2: LandingProvides 인터페이스 정의**

같은 파일에 추가:

```typescript
export interface LandingProvides {
  pages: LandingPage[];
}

export interface LandingPage {
  path: string;
  ssr: boolean;
  template: "widget-page" | "custom";
  widget?: {
    package: string;
    component: string;
    initialDataProcedure?: string;
  };
  metadata?: {
    title: string;
    description?: string;
  };
}
```

- [ ] **Step 3: 테스트**

```bash
cd /Users/bbright/Projects/superbuilder && bun test packages/atlas-engine
```
기존 테스트가 깨지지 않는지 확인.

- [ ] **Step 4: Commit**

```bash
git add packages/atlas-engine/src/manifest/types.ts
git commit -m "feat(atlas-engine): add LandingProvides type to Provides interface"
```

---

### Task 2: Landing path mapping

**Files:**
- Create: `packages/atlas-engine/src/scaffold/path-mapping-b2b2c.ts`

- [ ] **Step 1: B2B2C slot 타입 + 매핑 정의**

```typescript
// packages/atlas-engine/src/scaffold/path-mapping-b2b2c.ts
import { join } from "node:path";

/** B2B2C에서 사용하는 slot — client 제외, landing 추가 */
export type B2B2CPathSlot = "server" | "admin" | "schema" | "widgets" | "landing";

interface PathEntry {
  from: string;
  to: string;
}

export const B2B2C_PATH_MAPPING: Record<B2B2CPathSlot, PathEntry> = {
  server: { from: "src/server", to: "packages/features" },
  admin: { from: "src/admin", to: "apps/admin/src/features" },
  schema: { from: "src/schema", to: "packages/drizzle/src/schema/features" },
  widgets: { from: "src/widget", to: "packages/widgets/src" },
  landing: { from: "src/landing", to: "apps/landing/src/features" },
};

export function resolveB2B2CSourcePath(
  featuresRepoPath: string,
  featureId: string,
  slot: B2B2CPathSlot,
): string {
  return join(featuresRepoPath, featureId, B2B2C_PATH_MAPPING[slot].from);
}

export function resolveB2B2CTargetPath(
  projectDir: string,
  featureId: string,
  slot: B2B2CPathSlot,
): string {
  return join(projectDir, B2B2C_PATH_MAPPING[slot].to, featureId);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/path-mapping-b2b2c.ts
git commit -m "feat(atlas-engine): add B2B2C path mapping with landing slot"
```

---

### Task 3: B2B2C feature copy

**Files:**
- Create: `packages/atlas-engine/src/scaffold/copy-features-b2b2c.ts`

- [ ] **Step 1: copyFeaturesB2B2C 구현**

기존 `copyFeaturesToTemplate()`와 동일한 패턴이지만 B2B2C slot 사용:

```typescript
// packages/atlas-engine/src/scaffold/copy-features-b2b2c.ts
import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import {
  type B2B2CPathSlot,
  resolveB2B2CSourcePath,
  resolveB2B2CTargetPath,
} from "./path-mapping-b2b2c";

const B2B2C_SLOTS: B2B2CPathSlot[] = ["server", "admin", "schema", "widgets", "landing"];

export async function copyFeaturesB2B2C(opts: {
  templateDir: string;
  featuresSourceDir: string;
  featureIds: string[];
  manifests: FeatureManifest[];
}): Promise<void> {
  for (const featureId of opts.featureIds) {
    for (const slot of B2B2C_SLOTS) {
      const srcDir = resolveB2B2CSourcePath(opts.featuresSourceDir, featureId, slot);
      if (!existsSync(srcDir)) continue;

      const tgtDir = resolveB2B2CTargetPath(opts.templateDir, featureId, slot);
      await mkdir(dirname(tgtDir), { recursive: true });
      await cp(srcDir, tgtDir, { recursive: true });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/copy-features-b2b2c.ts
git commit -m "feat(atlas-engine): add B2B2C feature copy (landing slot, no client)"
```

---

## Chunk 2: Landing connection deriver + apply + page generator

### Task 4: Landing connection deriver

**Files:**
- Create: `packages/atlas-engine/src/connection/deriver-b2b2c.ts`

- [ ] **Step 1: B2B2C deriver 구현**

기존 `deriveConnections()`를 호출한 뒤, client 관련 필드를 제거하고 landing 필드를 추가:

```typescript
// packages/atlas-engine/src/connection/deriver-b2b2c.ts
import type { Provides } from "../manifest/types";
import { deriveConnections } from "./deriver";
import type { DerivedConnections } from "./types";

export interface B2B2CDerivedConnections extends DerivedConnections {
  // Landing 마커 스니펫
  landingImports?: string;
  landingSitemap?: string;
  landingLlmsImports?: string;
  landingLlmsPages?: string;
  landingProviderImports?: string;
}

export function deriveConnectionsB2B2C(
  featureId: string,
  provides: Provides,
): B2B2CDerivedConnections {
  // 기존 deriver로 server/admin/schema/widget 생성
  const base = deriveConnections(featureId, provides);

  // client 관련 필드 제거
  const conn: B2B2CDerivedConnections = { ...base };
  delete conn.clientRoutesImport;
  delete conn.clientRoutesSpread;

  // landing 스니펫 생성
  if (provides.landing?.pages) {
    const pages = provides.landing.pages;

    // LANDING_IMPORTS — 각 페이지 위젯의 import
    const imports = pages
      .filter((p) => p.template === "widget-page" && p.widget)
      .map((p) => {
        const pkg = p.widget!.package.replace("@superbuilder/", "@repo/");
        return `import { ${p.widget!.component} } from "${pkg}";`;
      });
    if (imports.length > 0) {
      conn.landingImports = imports.join("\n");
    }

    // LANDING_SITEMAP — URL 엔트리
    const sitemapEntries = pages
      .map((p) => `  { url: "${p.path}", lastModified: new Date() },`)
      .join("\n");
    if (sitemapEntries) {
      conn.landingSitemap = sitemapEntries;
    }

    // LANDING_LLMS_PAGES — 페이지 링크
    const llmsPages = pages
      .filter((p) => p.metadata)
      .map(
        (p) =>
          `  { title: "${p.metadata!.title}", url: "${p.path}", description: "${p.metadata!.description ?? ""}" },`,
      )
      .join("\n");
    if (llmsPages) {
      conn.landingLlmsPages = llmsPages;
    }
  }

  return conn;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/connection/deriver-b2b2c.ts
git commit -m "feat(atlas-engine): add B2B2C connection deriver with landing markers"
```

---

### Task 5: B2B2C apply connections

**Files:**
- Create: `packages/atlas-engine/src/connection/apply-connections-b2b2c.ts`

- [ ] **Step 1: applyConnectionsB2B2C 구현**

기존 MARKER_MAP에서 client 마커를 제외하고, landing 마커를 추가:

```typescript
// packages/atlas-engine/src/connection/apply-connections-b2b2c.ts
import { join } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import { insertAtMarker } from "./applier";
import { deriveConnectionsB2B2C, type B2B2CDerivedConnections } from "./deriver-b2b2c";
import { registerWidgetExport } from "./widget-export";

interface MarkerTarget {
  file: string;
  marker: string;
}

// SaaS 마커에서 client 제외 + landing 추가
const B2B2C_MARKER_MAP: Record<string, MarkerTarget> = {
  // Server (동일)
  nestModuleImport: { file: "apps/server/src/app.module.ts", marker: "IMPORTS" },
  nestModuleRef: { file: "apps/server/src/app.module.ts", marker: "MODULES" },
  trpcRouterImport: { file: "apps/server/src/trpc/router.ts", marker: "IMPORTS" },
  trpcRouterKey: { file: "apps/server/src/trpc/router.ts", marker: "ROUTERS" },
  trpcTypeImport: { file: "packages/features/app-router.ts", marker: "IMPORTS" },
  trpcTypeKey: { file: "packages/features/app-router.ts", marker: "ROUTERS" },
  // Client — 제외 (B2B2C에서 app 사용 안 함)
  // clientRoutesImport: 제외
  // clientRoutesSpread: 제외
  // Admin (동일)
  adminRoutesImport: { file: "apps/admin/src/router.tsx", marker: "IMPORTS" },
  adminRoutesSpread: { file: "apps/admin/src/router.tsx", marker: "ADMIN_ROUTES" },
  // Schema (동일)
  schemaExport: { file: "packages/drizzle/src/schema/index.ts", marker: "SCHEMA_EXPORTS" },
  // Landing (신규)
  landingImports: { file: "apps/landing/src/app/layout.tsx", marker: "LANDING_IMPORTS" },
  landingSitemap: { file: "apps/landing/src/app/sitemap.ts", marker: "LANDING_SITEMAP" },
  landingLlmsImports: { file: "apps/landing/src/app/llms.txt/route.ts", marker: "LANDING_LLMS_IMPORTS" },
  landingLlmsPages: { file: "apps/landing/src/app/llms.txt/route.ts", marker: "LANDING_LLMS_PAGES" },
  landingProviderImports: { file: "apps/landing/src/providers.tsx", marker: "LANDING_PROVIDER_IMPORTS" },
};

export function applyConnectionsB2B2C(
  templateDir: string,
  manifest: FeatureManifest,
): void {
  const connections = deriveConnectionsB2B2C(manifest.id, manifest.provides);

  for (const [field, target] of Object.entries(B2B2C_MARKER_MAP)) {
    const value = connections[field as keyof B2B2CDerivedConnections];
    if (typeof value === "string") {
      const filePath = join(templateDir, target.file);
      insertAtMarker(filePath, target.marker, value);
    }
  }

  if (connections.widgetExport) {
    registerWidgetExport(templateDir, manifest.id, connections.widgetExport);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/connection/apply-connections-b2b2c.ts
git commit -m "feat(atlas-engine): add B2B2C apply-connections (no client, with landing)"
```

---

### Task 6: Landing page generator

**Files:**
- Create: `packages/atlas-engine/src/scaffold/landing-page-generator.ts`

- [ ] **Step 1: 페이지 생성 함수 구현**

`provides.landing.pages` 배열을 순회하며 Next.js page.tsx 파일 생성:

```typescript
// packages/atlas-engine/src/scaffold/landing-page-generator.ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FeatureManifest, LandingPage } from "../manifest/types";

export async function generateLandingPages(
  templateDir: string,
  manifests: FeatureManifest[],
): Promise<void> {
  for (const manifest of manifests) {
    const pages = manifest.provides.landing?.pages;
    if (!pages) continue;

    for (const page of pages) {
      if (page.template === "custom") {
        console.log(
          `ℹ Feature "${manifest.id}"의 ${page.path} 페이지는 custom template입니다. 수동 구현 필요.`,
        );
        continue;
      }

      const pagePath = join(
        templateDir,
        "apps/landing/src/app/(public)",
        page.path,
        "page.tsx",
      );

      const content = generateWidgetPageContent(page, manifest.id);
      await mkdir(dirname(pagePath), { recursive: true });
      await writeFile(pagePath, content, "utf-8");
    }
  }
}

function generateWidgetPageContent(page: LandingPage, featureId: string): string {
  const widget = page.widget!;
  const pkg = widget.package.replace("@superbuilder/", "@repo/");
  const title = page.metadata?.title ?? featureId;
  const description = page.metadata?.description ?? "";

  if (page.ssr && widget.initialDataProcedure) {
    // RSC + serverTrpc prefetch
    const procedureChain = widget.initialDataProcedure
      .split(".")
      .map((part) => `.${part}`)
      .join("");
    return `import type { Metadata } from "next";
import { serverTrpc } from "@/lib/trpc";
import { ${widget.component} } from "${pkg}";

export const metadata: Metadata = {
  title: "${title}",
  description: "${description}",
};

export default async function ${toPascalCase(featureId)}Page() {
  const data = await serverTrpc${procedureChain}.query();
  return (
    <main>
      <${widget.component} initialData={data} />
    </main>
  );
}
`;
  }

  // Client-only (no SSR)
  return `import type { Metadata } from "next";
import { ${widget.component} } from "${pkg}";

export const metadata: Metadata = {
  title: "${title}",
  description: "${description}",
};

export default function ${toPascalCase(featureId)}Page() {
  return (
    <main>
      <${widget.component} />
    </main>
  );
}
`;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/landing-page-generator.ts
git commit -m "feat(atlas-engine): add landing page generator for B2B2C mode"
```

---

## Chunk 3: scaffoldB2B2C 오케스트레이터 + composePipelineB2B2C

### Task 7: scaffoldB2B2C 오케스트레이터

**Files:**
- Create: `packages/atlas-engine/src/scaffold/scaffold-b2b2c.ts`

- [ ] **Step 1: scaffoldB2B2C 구현**

기존 scaffold.ts의 공통 로직을 재구현하고, 변경 부분만 B2B2C 모듈 사용:

```typescript
// packages/atlas-engine/src/scaffold/scaffold-b2b2c.ts
import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { applyConnectionsB2B2C } from "../connection/apply-connections-b2b2c";
import { scanFeatureManifests } from "../manifest/scanner";
import { copyFeaturesB2B2C } from "./copy-features-b2b2c";
import { generateLandingPages } from "./landing-page-generator";
import { transformDirectory } from "./transform-files";
import type { ScaffoldInput, ScaffoldResult } from "./types";
import { updateFeatureExports } from "./update-package-exports";

const execFile = promisify(execFileCb);
const DEFAULT_TEMPLATE = "BBrightcode-atlas/superbuilder-app-template";
const DEFAULT_FEATURES_REPO = "BBrightcode-atlas/superbuilder-features";

/**
 * B2B2C 모드 프로젝트 생성
 *
 * SaaS scaffold와 동일한 공통 단계 + B2B2C 전용 단계:
 * - client slot 제외, landing slot 추가
 * - landing 마커 처리
 * - landing 페이지 생성 (provides.landing.pages)
 * - admin APP_MODE = "b2b2c" 설정
 */
export async function scaffoldB2B2C(input: ScaffoldInput): Promise<ScaffoldResult> {
  const templateRepo = input.templateRepo ?? DEFAULT_TEMPLATE;

  // ── 공통 단계 1~4: Clone + Clean ──
  await execFile("gh", ["repo", "clone", templateRepo, input.targetDir, "--", "--depth=1"]);
  await rm(join(input.targetDir, ".git"), { recursive: true, force: true });
  await updatePackageName(input.targetDir, input.projectName);
  await updateSuperbuilderJson(input.targetDir, input.projectName);

  // ── 공통 단계 5~7: Features source + Scan + Filter ──
  const featuresDir = await resolveFeaturesSource(input);
  const allManifests = scanFeatureManifests(featuresDir);
  const selectedManifests = allManifests.filter((m) =>
    input.featuresToKeep.includes(m.id),
  );

  // ── B2B2C 경고: client만 있고 landing 없는 feature ──
  for (const manifest of selectedManifests) {
    if (manifest.provides.client && !manifest.provides.landing) {
      console.warn(
        `⚠ Feature "${manifest.id}"는 provides.landing이 없어 B2B2C 모드에서 공개 UI가 생성되지 않습니다.\n  admin에서만 사용 가능합니다.`,
      );
    }
  }

  // ── B2B2C 단계 8: Feature 코드 복사 (client 제외, landing 포함) ──
  await copyFeaturesB2B2C({
    templateDir: input.targetDir,
    featuresSourceDir: featuresDir,
    featureIds: input.featuresToKeep,
    manifests: selectedManifests,
  });

  // ── B2B2C 단계 9: Import 변환 (client dir 제외, landing dir 추가) ──
  await transformDirectory(join(input.targetDir, "packages/features"));
  // apps/app/src/features — 건너뜀 (B2B2C에서 미사용)
  await transformDirectory(join(input.targetDir, "apps/admin/src/features"));
  await transformDirectory(join(input.targetDir, "packages/drizzle/src/schema/features"));
  await transformDirectory(join(input.targetDir, "packages/widgets/src"));
  await transformDirectory(join(input.targetDir, "apps/landing/src/features"));

  // ── B2B2C 단계 10: Connection 적용 (client 마커 제외, landing 마커 추가) ──
  for (const manifest of selectedManifests) {
    applyConnectionsB2B2C(input.targetDir, manifest);
  }

  // ── B2B2C 단계 11: Landing 페이지 생성 ──
  await generateLandingPages(input.targetDir, selectedManifests);

  // ── B2B2C 단계 12: Admin APP_MODE 설정 ──
  await setAdminMode(input.targetDir, "b2b2c");

  // ── 공통 단계 13: Package exports 업데이트 ──
  await updateFeatureExports(input.targetDir, input.featuresToKeep, selectedManifests);

  // ── 공통 단계 14: .claude/settings.json ──
  await writeClaudeSettings(input.targetDir);

  // ── 공통 단계 15: Git init + commit ──
  await execFile("git", ["init", "--initial-branch=main"], { cwd: input.targetDir });
  await execFile("git", ["add", "."], { cwd: input.targetDir });
  await execFile("git", ["commit", "-m", "Initial commit from Superbuilder Composer (B2B2C)"], {
    cwd: input.targetDir,
  });

  return {
    projectDir: input.targetDir,
    installedFeatures: input.featuresToKeep,
    manifests: selectedManifests,
  };
}

// ── 헬퍼 함수 (scaffold.ts와 동일, 공유 불가하므로 복제) ──

async function resolveFeaturesSource(input: ScaffoldInput): Promise<string> {
  if (input.featuresSourceDir && existsSync(input.featuresSourceDir)) {
    return input.featuresSourceDir;
  }
  const envPath = process.env.SUPERBUILDER_FEATURES_PATH;
  if (envPath) {
    const featuresPath = join(envPath, "features");
    if (existsSync(featuresPath)) return featuresPath;
    if (existsSync(envPath)) return envPath;
  }
  const repo = input.featuresRepo ?? DEFAULT_FEATURES_REPO;
  const tmpDir = join(tmpdir(), `superbuilder-features-${Date.now()}`);
  await execFile("gh", ["repo", "clone", repo, tmpDir, "--", "--depth=1"]);
  return join(tmpDir, "features");
}

async function updateSuperbuilderJson(dir: string, projectName: string): Promise<void> {
  const jsonPath = join(dir, "superbuilder.json");
  try {
    const raw = await readFile(jsonPath, "utf-8");
    const data = JSON.parse(raw);
    data.project = { ...data.project, name: projectName };
    await writeFile(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  } catch {
    // non-fatal
  }
}

async function updatePackageName(dir: string, name: string): Promise<void> {
  const pkgPath = join(dir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  pkg.name = name;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

async function setAdminMode(dir: string, mode: "saas" | "b2b2c"): Promise<void> {
  const filePath = join(dir, "apps/admin/src/lib/project.ts");
  try {
    const content = await readFile(filePath, "utf-8");
    const updated = content.replace(
      /export const APP_MODE:\s*AppMode\s*=\s*"saas"/,
      `export const APP_MODE: AppMode = "${mode}"`,
    );
    await writeFile(filePath, updated, "utf-8");
  } catch {
    // file missing — non-fatal
  }
}

async function writeClaudeSettings(dir: string): Promise<void> {
  const claudeDir = join(dir, ".claude");
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        permissions: {
          allow: ["Bash(*)", "Read(*)", "Write(*)", "Edit(*)", "Glob(*)", "Grep(*)"],
          deny: [],
        },
      },
      null,
      "\t",
    ),
    "utf-8",
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/scaffold/scaffold-b2b2c.ts
git commit -m "feat(atlas-engine): add scaffoldB2B2C orchestrator"
```

---

### Task 8: composePipelineB2B2C

**Files:**
- Create: `packages/atlas-engine/src/pipeline/compose-b2b2c.ts`

- [ ] **Step 1: composePipelineB2B2C 구현**

기존 `composePipeline()`을 복제하되:
1. `scaffold()` → `scaffoldB2B2C()` 호출
2. Vercel app 배포 건너뜀
3. CORS_ORIGINS에서 app URL 제외
4. Landing에 서버 URL env 추가 (tRPC/auth 연동용)

```typescript
// packages/atlas-engine/src/pipeline/compose-b2b2c.ts
import { join } from "node:path";
import { scaffoldB2B2C } from "../scaffold/scaffold-b2b2c";
import { writeEnvFile } from "./env";
import { pushToGitHub } from "./github";
import { installFeatures } from "./install";
import { createNeonProject } from "./neon";
import { seedInitialData } from "./seed";
import type {
  ComposeCallbacks,
  ComposeInput,
  ComposeOptions,
  ComposeProjectRecord,
  ComposeResult,
  GitHubResult,
  NeonResult,
  SeedResult,
  VercelResult,
} from "./types";
import { deployToVercel, vercelFetch } from "./vercel";

const DEFAULT_OPTS: Required<
  Pick<ComposeOptions, "neon" | "github" | "vercel" | "install" | "private" | "githubOrg">
> = {
  neon: true,
  github: true,
  vercel: true,
  install: false,
  private: true,
  githubOrg: "BBrightcode-atlas",
};

/**
 * B2B2C 모드 compose pipeline.
 *
 * SaaS pipeline과의 차이:
 * 1. scaffoldB2B2C() 사용
 * 2. Vercel app 배포 건너뜀
 * 3. CORS_ORIGINS에 app URL 없음
 * 4. Landing에 서버 URL + auth 관련 env 추가
 */
export async function composePipelineB2B2C(
  input: ComposeInput,
  callbacks?: ComposeCallbacks,
): Promise<ComposeResult> {
  const opts = { ...DEFAULT_OPTS, ...input.options };
  const cb = callbacks ?? input.callbacks;
  const projectDir = join(input.targetPath, input.projectName);

  const record: ComposeProjectRecord = {
    name: input.projectName,
    status: "scaffolding",
    features: input.features,
    ownerEmail: opts.ownerEmail,
  };

  const saveProject = async () => {
    try { await cb?.onProjectSave?.(record); } catch { /* non-fatal */ }
  };
  await saveProject();

  // ── Step 1: scaffoldB2B2C (FATAL) ──
  cb?.onStep?.("resolve", "start", "피처 의존성 해석 중...");
  cb?.onStep?.("scaffold", "start", "B2B2C 프로젝트 스캐폴딩 중...");
  const scaffoldResult = await scaffoldB2B2C({
    projectName: input.projectName,
    targetDir: projectDir,
    featuresToKeep: input.features,
    templateRepo: opts.boilerplateRepo,
    featuresSourceDir: opts.featuresSourceDir,
    featuresRepo: opts.featuresRepo,
  });
  cb?.onStep?.("resolve", "done", `${input.features.length}개 피처 요청`);
  cb?.onStep?.("scaffold", "done", `B2B2C: ${scaffoldResult.installedFeatures.length}개 피처 설치`);
  record.features = scaffoldResult.installedFeatures;
  record.status = "provisioning";
  await saveProject();

  // ── Step 2: neon (동일) ──
  let neonResult: NeonResult | undefined;
  if (opts.neon) {
    cb?.onStep?.("neon", "start", "Neon DB 프로젝트 생성 중...");
    try {
      neonResult = await createNeonProject({
        projectName: input.projectName,
        orgId: opts.neonOrgId,
        apiKey: opts.neonApiKey,
      });
      record.neonProjectId = neonResult.projectId;
      await saveProject();
      cb?.onStep?.("neon", "done", `Neon DB 생성 완료: ${neonResult.projectId}`);
    } catch (e) {
      cb?.onStep?.("neon", "error", e instanceof Error ? e.message : String(e));
    }
  } else {
    cb?.onStep?.("neon", "skip");
  }

  // ── Step 3: github (동일) ──
  let githubResult: GitHubResult | undefined;
  if (opts.github) {
    cb?.onStep?.("github", "start", "GitHub 레포 생성 중...");
    try {
      githubResult = await pushToGitHub({
        projectDir,
        repoName: input.projectName,
        org: opts.githubOrg,
        private: opts.private,
      });
      record.githubRepoUrl = githubResult.repoUrl;
      await saveProject();
      cb?.onStep?.("github", "done", `GitHub: ${githubResult.repoUrl}`);
    } catch (e) {
      cb?.onStep?.("github", "error", e instanceof Error ? e.message : String(e));
    }
  } else {
    cb?.onStep?.("github", "skip");
  }

  // ── Step 4: vercel (B2B2C: app 배포 건너뜀) ──
  let vercelServerResult: VercelResult | undefined;
  let vercelAdminResult: VercelResult | undefined;
  let vercelLandingResult: VercelResult | undefined;
  const { randomBytes } = await import("node:crypto");
  const betterAuthSecret = randomBytes(32).toString("base64");

  if (opts.vercel && githubResult) {
    record.status = "deploying";
    await saveProject();
    cb?.onStep?.("vercel", "start", "B2B2C Vercel 배포 중 (app 제외)...");
    try {
      const envVars: Record<string, string> = { BETTER_AUTH_SECRET: betterAuthSecret };
      if (neonResult?.databaseUrl) envVars.DATABASE_URL = neonResult.databaseUrl;

      // 1) Server
      const serverProjectName = `${input.projectName}-api`;
      const serverUrl = `https://${serverProjectName}.vercel.app`;
      const adminUrl = `https://${input.projectName}-admin.vercel.app`;
      const landingUrl = `https://${input.projectName}-landing.vercel.app`;

      // B2B2C: CORS에 app 없음, landing 추가
      const serverEnvVars: Record<string, string> = {
        ...envVars,
        CORS_ORIGINS: `${serverUrl},${adminUrl},${landingUrl}`,
        BETTER_AUTH_URL: serverUrl,
        APP_NAME: input.projectName,
        NODE_ENV: "production",
      };
      cb?.onLog?.("Vercel: 서버(API) 배포 중...");
      vercelServerResult = await deployToVercel({
        repoUrl: githubResult.repoUrl,
        projectName: serverProjectName,
        envVars: serverEnvVars,
        token: opts.vercelToken,
        teamId: opts.vercelTeamId,
        framework: null,
        rootDirectory: "apps/server",
        buildCommand: "nest build",
        outputDirectory: ".",
      });
      cb?.onLog?.(`서버 배포: ${vercelServerResult.deploymentUrl}`);

      // 2) Admin (동일)
      cb?.onLog?.("Vercel: Admin 배포 중...");
      try {
        vercelAdminResult = await deployToVercel({
          repoUrl: githubResult.repoUrl,
          projectName: `${input.projectName}-admin`,
          envVars: {
            ...envVars,
            VITE_API_URL: vercelServerResult.deploymentUrl,
            VITE_APP_NAME: input.projectName,
          },
          token: opts.vercelToken,
          teamId: opts.vercelTeamId,
          rootDirectory: "apps/admin",
        });
        cb?.onLog?.(`Admin 배포: ${vercelAdminResult.deploymentUrl}`);
      } catch (e) {
        cb?.onLog?.(`Admin 배포 실패 (non-fatal): ${e instanceof Error ? e.message : e}`);
      }

      // 3) Landing (B2B2C: tRPC + auth env 포함)
      cb?.onLog?.("Vercel: Landing 배포 중...");
      try {
        vercelLandingResult = await deployToVercel({
          repoUrl: githubResult.repoUrl,
          projectName: `${input.projectName}-landing`,
          envVars: {
            ...envVars,
            NEXT_PUBLIC_APP_NAME: input.projectName,
            NEXT_PUBLIC_API_URL: vercelServerResult.deploymentUrl,
            API_URL: vercelServerResult.deploymentUrl,
          },
          token: opts.vercelToken,
          teamId: opts.vercelTeamId,
          framework: "nextjs",
          rootDirectory: "apps/landing",
        });
        cb?.onLog?.(`Landing 배포: ${vercelLandingResult.deploymentUrl}`);
      } catch (e) {
        cb?.onLog?.(`Landing 배포 실패 (non-fatal): ${e instanceof Error ? e.message : e}`);
      }

      record.vercelServerProjectId = vercelServerResult.projectId;
      record.vercelServerUrl = vercelServerResult.deploymentUrl;
      if (vercelAdminResult) {
        record.vercelAdminProjectId = vercelAdminResult.projectId;
        record.vercelAdminUrl = vercelAdminResult.deploymentUrl;
      }
      if (vercelLandingResult) {
        record.vercelLandingProjectId = vercelLandingResult.projectId;
        record.vercelLandingUrl = vercelLandingResult.deploymentUrl;
      }
      await saveProject();
      cb?.onStep?.("vercel", "done",
        `API: ${vercelServerResult.deploymentUrl} | Admin: ${vercelAdminResult?.deploymentUrl ?? "skip"} | Landing: ${vercelLandingResult?.deploymentUrl ?? "skip"}`);
    } catch (e) {
      cb?.onStep?.("vercel", "error", e instanceof Error ? e.message : String(e));
    }
  } else {
    cb?.onStep?.("vercel", "skip");
  }

  // ── Step 5~8: env, install, dbMigrate, seed (동일) ──
  cb?.onStep?.("env", "start", ".env 생성 중...");
  try {
    await writeEnvFile(projectDir, {
      DATABASE_URL: neonResult?.databaseUrl,
      NEON_PROJECT_ID: neonResult?.projectId,
      BETTER_AUTH_URL: vercelServerResult?.deploymentUrl,
      BETTER_AUTH_SECRET: betterAuthSecret,
      VITE_API_URL: vercelServerResult?.deploymentUrl,
      VITE_APP_NAME: input.projectName,
      APP_NAME: input.projectName,
    });
    cb?.onStep?.("env", "done");
  } catch (e) {
    cb?.onStep?.("env", "error", e instanceof Error ? e.message : String(e));
  }

  let installed = false;
  if (opts.install) {
    cb?.onStep?.("install", "start", "의존성 설치 중...");
    try {
      await installFeatures({ projectDir });
      installed = true;
      cb?.onStep?.("install", "done");
    } catch (e) {
      cb?.onStep?.("install", "error", e instanceof Error ? e.message : String(e));
    }
  } else {
    cb?.onStep?.("install", "skip");
  }

  let dbMigrated = false;
  if (neonResult?.databaseUrl) {
    cb?.onStep?.("dbMigrate" as any, "start", "DB 마이그레이션 중...");
    try {
      const { execFile: execCb } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(execCb);
      await execAsync("pnpm", ["exec", "drizzle-kit", "push", "--force"], {
        cwd: join(projectDir, "packages", "drizzle"),
        timeout: 60_000,
        env: { ...process.env, DATABASE_URL: neonResult.databaseUrl },
      });
      dbMigrated = true;
      cb?.onStep?.("dbMigrate" as any, "done");
    } catch (e) {
      cb?.onStep?.("dbMigrate" as any, "error", e instanceof Error ? e.message : String(e));
    }
  }

  let seedResult: SeedResult | undefined;
  if (neonResult && dbMigrated) {
    cb?.onStep?.("seed", "start", "초기 데이터 시딩 중...");
    try {
      seedResult = await seedInitialData({
        projectDir,
        ownerEmail: opts.ownerEmail,
        ownerPassword: opts.ownerPassword,
      });
      cb?.onStep?.("seed", "done");
    } catch (e) {
      cb?.onStep?.("seed", "error", e instanceof Error ? e.message : String(e));
    }
  } else {
    cb?.onStep?.("seed", "skip");
  }

  record.status = "deployed";
  await saveProject();

  return {
    projectDir,
    projectName: input.projectName,
    installedFeatures: scaffoldResult.installedFeatures,
    neon: neonResult,
    github: githubResult,
    // B2B2C: vercel (app) = undefined
    vercelServer: vercelServerResult,
    vercelAdmin: vercelAdminResult,
    vercelLanding: vercelLandingResult,
    installed,
    seed: seedResult,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/pipeline/compose-b2b2c.ts
git commit -m "feat(atlas-engine): add composePipelineB2B2C (no app deploy, landing env)"
```

---

### Task 9: Export 추가 + 테스트

**Files:**
- Modify: `packages/atlas-engine/src/index.ts` (또는 해당 barrel export)

- [ ] **Step 1: 기존 index.ts 확인 후 B2B2C 함수 export 추가**

```bash
cat packages/atlas-engine/src/index.ts
```

B2B2C 함수들을 export:
```typescript
export { scaffoldB2B2C } from "./scaffold/scaffold-b2b2c";
export { composePipelineB2B2C } from "./pipeline/compose-b2b2c";
```

- [ ] **Step 2: 기존 테스트 실행**

```bash
cd /Users/bbright/Projects/superbuilder && bun test packages/atlas-engine
```

기존 테스트가 깨지지 않는지 확인.

- [ ] **Step 3: typecheck**

```bash
cd /Users/bbright/Projects/superbuilder && bun run typecheck --filter atlas-engine
```

- [ ] **Step 4: Commit**

```bash
git add packages/atlas-engine/src/
git commit -m "feat(atlas-engine): export B2B2C scaffold and compose pipeline"
```
