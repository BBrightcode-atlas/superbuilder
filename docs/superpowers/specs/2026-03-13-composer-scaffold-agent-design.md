# Composer Scaffold + Agent 설계

> **요약**: Composer에서 선택한 feature spec을 기반으로 새 프로젝트를 생성하는 아키텍처.
> Template repo clone → Scaffold Engine이 뼈대 구성 → CLI Agent가 feature 설치.

**상태**: 설계 승인됨 (2026-03-13)

---

## 1. 배경 및 결정 사항

### 폐기 대상

| 항목 | 위치 | 이유 |
|------|------|------|
| Extractor (subtractive) | `packages/atlas-engine/src/extractor/` | 전체 복사 → 삭제 방식 폐기, additive 방식으로 전환 |
| Supabase Auth/Client | feature-atlas 내 `supabase.ts` 등 | Neon + Better Auth로 전환 완료 |
| agent-desk ExecutorService | `packages/features-server/features/agent-desk/` | 웹 대화창 기반, 완성도 낮음. CLI agent 방식 사용 |

### 핵심 결정

| 질문 | 결정 |
|------|------|
| Feature 소스 | superbuilder 모노레포 (B strategy). 추후 전용 repo 이동 |
| Path 처리 | Config 기반 mapping (superbuilder 경로 ↔ target 경로) |
| Spec 형식 | JSON (`superbuilder.json`), package.json과 유사한 역할 |
| Spec 구조 | 기존 FeatureSpec + ProjectRegistry 확장 |
| 실행 환경 | CLI Agent (Claude Code, Codex) — superset의 agent launcher 활용 |
| 접근법 | Scaffold + Agent Delegation (하이브리드) |
| Template 소스 | `BBrightcode-atlas/feature-atlas-template` (feature-atlas 복제 + 정리) |
| DB/Auth 스택 | Neon + Better Auth 단일 스택 (Supabase 완전 폐기) |

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  Composer UI (Desktop)                │
│  Feature 선택 → Config 설정 → ProjectSpec 생성       │
└──────────────────────┬──────────────────────────────┘
                       │ ProjectSpec JSON
                       ▼
┌─────────────────────────────────────────────────────┐
│              Scaffold Engine (atlas-engine)           │
│  1. Template repo clone                              │
│     (BBrightcode-atlas/feature-atlas-template)       │
│  2. ProjectSpec → superbuilder.json 주입             │
│  3. 설치 워크플로우 파일 생성                         │
│  4. .claude/rules + AGENTS.md 주입                   │
│  5. Git re-init (새 프로젝트로)                      │
└──────────────────────┬──────────────────────────────┘
                       │ 빈 template + 워크플로우
                       ▼
┌─────────────────────────────────────────────────────┐
│           CLI Agent (Claude Code / Codex)             │
│  워크플로우 읽고 실행:                               │
│  1. superbuilder에서 feature 파일 복사               │
│     (path mapping 참조)                              │
│  2. Marker 기반 connection 수정                      │
│  3. ProjectSpec 기반 커스터마이즈 (DB, Auth)         │
│  4. bun install + 빌드 검증                          │
│  5. Git commit                                       │
└──────────────────────┬──────────────────────────────┘
                       │ 완성된 프로젝트
                       ▼
┌─────────────────────────────────────────────────────┐
│           Deploy Pipeline (기존 Phase 2-3)           │
│  Neon DB 생성 → Vercel 배포 → Deployments 목록      │
└─────────────────────────────────────────────────────┘
```

### 3개 레포의 역할

| 레포 | 역할 |
|------|------|
| **superbuilder** (이 모노레포) | Feature 소스 코드 + Composer UI + Scaffold Engine |
| **BBrightcode-atlas/feature-atlas-template** | 빈 프로젝트 뼈대 (apps/app, apps/atlas-server, packages/\*, configs, markers) |
| **BBrightcode-atlas/sb-gen-{name}** | 생성된 프로젝트들 |

### 분업 원칙

| 영역 | 담당 | 이유 |
|------|------|------|
| Template clone, spec 생성, git init | Scaffold Engine (코드) | 결정론적, 매번 동일한 기본 구조 보장 |
| Feature 파일 복사, connection, 빌드 검증 | CLI Agent (워크플로우) | Edge case 처리, 유연한 통합, 자동 수정 |
| Neon/Vercel 배포 | 기존 파이프라인 | Phase 2-3에서 구현 완료 |

---

## 3. Template Repo

### 소스

`BBrightcodeDev/feature-atlas` (develop branch)를 `BBrightcode-atlas` org으로 복제 후 정리.

### Template 구조 (feature-atlas에서 features 제거 + Supabase 정리)

```
feature-atlas-template/
├── apps/
│   ├── app/                        # Vite + React 프론트엔드 셸
│   │   ├── src/
│   │   │   ├── router.tsx          # [ATLAS:IMPORTS] [ATLAS:ROUTES] markers
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── layouts/            # 앱 레이아웃 (셸)
│   │   │   ├── lib/trpc.ts
│   │   │   ├── pages/              # 기본 페이지 (landing 등)
│   │   │   └── features/           # 빈 디렉토리 (에이전트가 채움)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   ├── atlas-server/               # NestJS 백엔드 셸
│   │   ├── src/
│   │   │   ├── app.module.ts       # [ATLAS:IMPORTS] [ATLAS:MODULES] markers
│   │   │   ├── trpc/router.ts      # [ATLAS:IMPORTS] [ATLAS:ROUTERS] markers
│   │   │   ├── main.ts
│   │   │   └── config/env.ts
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   └── webpack.config.js
│   ├── agent-server/               # Hono AI 서버 셸
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── providers/          # model registry
│   │   │   ├── runtime/            # agent runtime
│   │   │   └── tools/              # [ATLAS:TOOLS] markers
│   │   └── package.json
│   └── feature-admin/              # Admin 셸
│       ├── src/
│       │   ├── router.tsx          # [ATLAS:ADMIN_IMPORTS] [ATLAS:ADMIN_ROUTES] markers
│       │   └── feature-config.ts   # [ATLAS:ADMIN_MENUS] markers
│       └── package.json
├── packages/
│   ├── features/                   # 빈 package (에이전트가 feature 설치)
│   │   └── package.json            # [ATLAS:EXPORTS] markers
│   ├── drizzle/                    # Drizzle 스키마 셸
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── core/           # auth.ts (Better Auth), profiles.ts, files.ts
│   │   │   │   ├── features/       # 빈 (에이전트가 채움)
│   │   │   │   └── index.ts        # [ATLAS:SCHEMAS] markers
│   │   │   └── utils/columns.ts    # baseColumns, softDelete 등
│   │   └── drizzle.config.ts       # [ATLAS:TABLES] markers
│   ├── core/                       # 공통 인프라
│   │   ├── auth/                   # Better Auth 기반 (Supabase 아님)
│   │   ├── trpc/
│   │   └── logger/
│   ├── shared/                     # 공유 유틸
│   ├── ui/                         # shadcn/ui 컴포넌트
│   └── widgets/                    # 빈 widgets package
│       └── package.json            # [ATLAS:WIDGET_EXPORTS] markers
├── registry/
│   └── features.json               # 빈 ProjectRegistry
├── .claude/
│   ├── rules/                      # Feature 개발 규칙 (scaffold이 주입)
│   └── commands/                   # 에이전트 커맨드 (scaffold이 주입)
├── .env.example                    # Neon + Better Auth 환경변수
├── CLAUDE.md
├── AGENTS.md
├── package.json
├── turbo.json
└── biome.json
```

### Template 정리 작업 (feature-atlas → template 변환 시)

| 제거/교체 대상 | 위치 (feature-atlas) | 조치 |
|---|---|---|
| `supabase.ts` | `apps/app/src/lib/supabase.ts` | 삭제 |
| `supabase.ts` | `apps/agent-server/src/lib/supabase.ts` | 삭제 |
| Supabase env vars | `.env.example` | `SUPABASE_*` → `DATABASE_URL` (Neon) + Better Auth vars |
| Supabase auth imports | `packages/core/auth/` | superbuilder의 현재 Better Auth 구조로 교체 |
| `@supabase/supabase-js` | 각 `package.json` | 의존성 제거 |
| Supabase RLS 참조 | schema, seed scripts | Drizzle + Better Auth 방식으로 교체 |
| Feature 코드 | `apps/app/src/features/*` | 전부 삭제, 빈 디렉토리만 유지 |
| Feature 코드 | `packages/features/*` (feature별) | 전부 삭제 |
| Feature schema | `packages/drizzle/src/schema/features/*` | 전부 삭제 |
| Connection 파일 내 feature 등록 | router.tsx, app.module.ts 등 | Feature 참조 제거, marker만 유지 |

### Template의 Auth/DB 스택

```
.env.example:
  DATABASE_URL=              # Neon connection string
  BETTER_AUTH_SECRET=
  BETTER_AUTH_URL=
  # (Supabase 관련 변수 없음)
```

---

## 4. ProjectSpec (superbuilder.json)

생성된 프로젝트 루트에 위치하는 프로젝트 전체 설정 파일.

```jsonc
{
  // 프로젝트 메타
  "name": "my-saas-app",
  "version": "0.1.0",
  "description": "AI-powered SaaS platform",

  // 소스 정보
  "source": {
    "type": "superbuilder",
    "repo": "BBrightcode-atlas/superbuilder",
    "branch": "develop",
    "templateRepo": "BBrightcode-atlas/feature-atlas-template",
    "templateVersion": "1.0.0",
    "createdAt": "2026-03-13T..."
  },

  // 인프라 설정
  "config": {
    "database": {
      "provider": "neon",
      "projectId": null,           // 배포 후 채워짐
      "connectionString": null
    },
    "auth": {
      "provider": "better-auth",
      "features": ["email", "google", "github"]
    },
    "deploy": {
      "provider": "vercel",
      "teamId": null,
      "projectId": null,
      "domain": null
    }
  },

  // 선택된 features
  "features": {
    "selected": ["auth", "blog", "community", "payment"],
    "resolved": ["auth", "blog", "community", "payment", "comment", "reaction"],
    "autoIncluded": ["comment", "reaction"]
  },

  // 설치 상태 추적 (registry 역할)
  "installed": {
    // 에이전트가 설치하면서 하나씩 채움
    "auth": { "version": "1.0.0", "installedAt": "2026-03-13T...", "status": "installed" },
    "blog": { "version": "1.0.0", "installedAt": "2026-03-13T...", "status": "installed" }
  },

  // Path mapping (superbuilder → 이 프로젝트)
  "pathMapping": {
    "server": {
      "from": "packages/features-server/features",
      "to": "packages/features"
    },
    "client": {
      "from": "apps/features-app/src/features",
      "to": "apps/app/src/features"
    },
    "admin": {
      "from": "apps/feature-admin/src/features",
      "to": "apps/feature-admin/src/features"
    },
    "schema": {
      "from": "packages/drizzle/src/schema/features",
      "to": "packages/drizzle/src/schema/features"
    },
    "widgets": {
      "from": "packages/widgets/src",
      "to": "packages/widgets/src"
    }
  }
}
```

### 기존 구조와의 관계

| 기존 | 새 구조 | 변화 |
|------|---------|------|
| `FeatureSpec` (features-cli) | `superbuilder.json > features` | slots 정보는 FeatureRegistry에서 분리 관리 |
| `ProjectRegistry` (features-cli) | `superbuilder.json > installed` | 동일 역할, 통합 |
| `SuperbuilderMetadata` (atlas-engine) | `superbuilder.json` 전체 | config/deploy 설정 추가 |
| pathMapping | 새로 추가 | superbuilder ↔ target 경로 변환 |

### FeatureRegistry (별도 파일 — superbuilder 모노레포에 위치)

```jsonc
// registry/features.json (superbuilder 모노레포)
{
  "blog": {
    "name": "블로그",
    "version": "1.0.0",
    "icon": "FileText",
    "group": "content",
    "type": "page",
    "dependencies": ["comment", "reaction"],
    "slots": {
      "server": { "module": "BlogModule", "path": "@repo/features/blog" },
      "client": { "routes": "createBlogRoutes", "path": "@features/blog" },
      "schema": { "tables": ["blog_posts", "blog_categories"] }
    }
  }
}
```

---

## 5. Scaffold Engine

`packages/atlas-engine`의 기존 extractor를 대체하는 새 모듈.

### 모듈 구조

```
packages/atlas-engine/src/
├── registry/              # 기존 유지 — feature 스캔/메타데이터
│   ├── scanner.ts
│   └── types.ts
├── resolver/              # 기존 유지 — 의존성 해결/토폴로지 정렬
│   └── resolver.ts
├── scaffold/              # 새로 작성 — extractor 대체
│   ├── scaffold.ts        # 메인 오케스트레이터
│   ├── template-clone.ts  # template repo clone + cleanup
│   ├── spec-writer.ts     # superbuilder.json 생성
│   ├── workflow-writer.ts # 설치 워크플로우 파일 생성
│   └── path-mapping.ts    # 경로 변환 유틸
├── extractor/             # 폐기 (삭제 또는 deprecated 마킹)
└── config.ts              # 기존 유지
```

### scaffold.ts — 메인 오케스트레이터

```typescript
interface ScaffoldInput {
  projectName: string;
  targetDir: string;
  config: ProjectConfig;        // DB, Auth, Deploy 설정
  resolved: ResolvedFeatures;   // resolver 결과
  registry: FeatureRegistry;    // feature 메타데이터
  sourceRepoPath: string;       // superbuilder 로컬 경로
}

interface ScaffoldResult {
  projectDir: string;
  spec: ProjectSpec;
}

async function scaffold(input: ScaffoldInput): Promise<ScaffoldResult> {
  // 1. Template clone
  const projectDir = await cloneTemplate({
    templateRepo: "BBrightcode-atlas/feature-atlas-template",
    targetDir: input.targetDir,
    projectName: input.projectName,
  });

  // 2. superbuilder.json 생성
  const spec = await writeProjectSpec(projectDir, {
    name: input.projectName,
    config: input.config,
    features: input.resolved,
    pathMapping: DEFAULT_PATH_MAPPING,
  });

  // 3. 설치 워크플로우 생성
  await writeInstallWorkflow(projectDir, {
    features: input.resolved,
    featureRegistry: input.registry,
    sourceRepo: input.sourceRepoPath,
  });

  // 4. .claude/rules 주입 (에이전트가 규칙 따르도록)
  await injectAgentRules(projectDir);

  // 5. Git init
  await initGitRepo(projectDir);

  return { projectDir, spec };
}
```

### template-clone.ts

```typescript
async function cloneTemplate(opts: {
  templateRepo: string;
  targetDir: string;
  projectName: string;
}): Promise<string> {
  // shallow clone using execFile (not exec, to avoid shell injection)
  await execFile("gh", [
    "repo", "clone", opts.templateRepo, opts.targetDir,
    "--", "--depth=1",
  ]);

  // .git 제거 (새 프로젝트이므로)
  await rm(join(opts.targetDir, ".git"), { recursive: true });

  // package.json name 업데이트
  await updatePackageName(opts.targetDir, opts.projectName);

  return opts.targetDir;
}
```

### path-mapping.ts

```typescript
const DEFAULT_PATH_MAPPING: PathMapping = {
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

function resolveSourcePath(
  mapping: PathMapping,
  slot: "server" | "client" | "admin" | "schema" | "widgets",
  featureName: string,
  sourceRepoPath: string,
): string {
  return join(sourceRepoPath, mapping[slot].from, featureName);
}

function resolveTargetPath(
  mapping: PathMapping,
  slot: "server" | "client" | "admin" | "schema" | "widgets",
  featureName: string,
  projectDir: string,
): string {
  return join(projectDir, mapping[slot].to, featureName);
}
```

---

## 6. 설치 워크플로우 (에이전트 실행)

Scaffold Engine이 생성하는 마크다운 워크플로우 파일. CLI 에이전트가 `/install-features` 커맨드로 실행.

### 파일 위치

```
생성된 프로젝트/
├── .claude/commands/
│   └── install-features.md    # /install-features 로 실행
├── .agents/commands/
│   └── install-features.md    # symlink → .claude/commands/
└── superbuilder.json          # 스펙 참조
```

### install-features.md 생성 예시

workflow-writer.ts가 resolved features 기반으로 동적 생성합니다.
아래는 생성되는 워크플로우 파일의 구조입니다:

```
# Feature 설치 워크플로우

이 프로젝트는 superbuilder에서 생성되었습니다.
아래 단계를 순서대로 실행하여 features를 설치하세요.

## 사전 조건

- superbuilder 소스 경로: {sourceRepo}
- 이 프로젝트의 superbuilder.json을 참조하세요

## 설치할 Features (토폴로지 순서)

1. auth (core)
2. comment (widget)
3. reaction (widget)
4. blog (page, depends: comment, reaction)
5. community (page, depends: comment, reaction)
6. payment (page)

## 각 Feature 설치 절차

### Feature마다 반복:

#### Step 1: Server 코드 복사
소스에서 타겟으로 디렉토리 복사:
- {sourceRepo}/packages/features-server/features/{name}/
  → ./packages/features/{name}/

#### Step 2: Client 코드 복사 (Page feature인 경우)
- {sourceRepo}/apps/features-app/src/features/{name}/
  → ./apps/app/src/features/{name}/

#### Step 3: Admin 코드 복사 (Admin이 있는 경우)
- {sourceRepo}/apps/feature-admin/src/features/{name}/
  → ./apps/feature-admin/src/features/{name}/

#### Step 4: Schema 복사
- {sourceRepo}/packages/drizzle/src/schema/features/{name}/
  → ./packages/drizzle/src/schema/features/{name}/

#### Step 5: Widget 복사 (Widget feature인 경우)
- {sourceRepo}/packages/widgets/src/{name}/
  → ./packages/widgets/src/{name}/

#### Step 6: Connection 파일 수정 (Marker 기반)

각 파일의 [ATLAS:*] marker 위치에 삽입:

Schema Index (packages/drizzle/src/schema/index.ts):
  // [ATLAS:SCHEMAS]
  export * from "./features/{name}";
  // [/ATLAS:SCHEMAS]

App Module (apps/atlas-server/src/app.module.ts):
  // [ATLAS:IMPORTS]
  import { {ModuleName} } from "@repo/features/{name}";
  // [/ATLAS:IMPORTS]
  // [ATLAS:MODULES]
  {ModuleName},
  // [/ATLAS:MODULES]

tRPC Router (apps/atlas-server/src/trpc/router.ts):
  // [ATLAS:IMPORTS]
  import { {routerName} } from "@repo/features/{name}";
  // [/ATLAS:IMPORTS]
  // [ATLAS:ROUTERS]
  {name}: {routerName},
  // [/ATLAS:ROUTERS]

Client Router (apps/app/src/router.tsx):
  // [ATLAS:IMPORTS]
  import { {createRoutes} } from "@features/{name}";
  // [/ATLAS:IMPORTS]
  // [ATLAS:ROUTES]
  ...{createRoutes}(rootRoute),
  // [/ATLAS:ROUTES]

Package Exports (packages/features/package.json):
  exports에 추가: "./{name}": "./{name}/index.ts"

Drizzle Config (drizzle.config.ts):
  // [ATLAS:TABLES]
  "{table_name1}", "{table_name2}",
  // [/ATLAS:TABLES]

#### Step 7: superbuilder.json 업데이트
installed 섹션에 추가:
  "{name}": { "version": "1.0.0", "installedAt": "현재시간", "status": "installed" }

## Import 경로 변환 규칙

복사한 파일 내부의 import를 아래 규칙에 따라 변환하세요:

| 기존 (superbuilder)                      | 변환 (이 프로젝트)    |
|------------------------------------------|----------------------|
| @superbuilder/features-server/{name}     | @repo/features/{name}|
| @superbuilder/features-db                | @repo/drizzle        |
| @superbuilder/features-client/core/*     | @repo/core/*         |
| @superbuilder/feature-ui/*               | @repo/ui/*           |
| @superbuilder/widgets/*                  | @repo/widgets/*      |

## Feature별 상세 정보

### auth
- type: page
- module: AuthModule
- router: authRouter
- routes: createAuthRoutes
- tables: [profiles, auth_users, auth_sessions, ...]

### blog
- type: page
- module: BlogModule
- router: blogRouter
- routes: createBlogRoutes
- tables: [blog_posts, blog_categories]
- dependencies: [comment, reaction]

(각 feature별 상세 — workflow-writer가 registry 기반으로 생성)

## 완료 후

1. bun install 실행
2. bun run typecheck 로 빌드 검증
3. 에러 있으면 수정
4. git add -A && git commit -m "feat: install features"
```

### workflow-writer.ts 구조

```typescript
function generateWorkflowMarkdown(opts: {
  features: ResolvedFeature[];
  featureRegistry: FeatureRegistry;
  sourceRepo: string;
}): string {
  const { features, featureRegistry, sourceRepo } = opts;

  let md = WORKFLOW_HEADER;

  // 토폴로지 순서 목록
  md += "## 설치할 Features (토폴로지 순서)\n\n";
  for (const [i, f] of features.entries()) {
    const spec = featureRegistry[f.name];
    md += `${i + 1}. ${f.name} (${spec.type}`;
    if (spec.dependencies.length) {
      md += `, depends: ${spec.dependencies.join(", ")}`;
    }
    md += ")\n";
  }

  // 공통 절차
  md += COMMON_STEPS_TEMPLATE;

  // Import 경로 변환 규칙
  md += IMPORT_MAPPING_TABLE;

  // Feature별 상세 (slots, connection 정보)
  md += "## Feature별 상세 정보\n\n";
  for (const f of features) {
    const spec = featureRegistry[f.name];
    md += generateFeatureDetail(f.name, spec, sourceRepo);
  }

  md += COMPLETION_STEPS;
  return md;
}
```

---

## 7. Desktop 연동 + 에이전트 실행 흐름

### Composer UI → Agent 실행 전체 시퀀스

```
사용자 흐름:

1. Atlas > Composer 페이지 진입
2. Feature 선택 (기존 UI 유지)
3. 의존성 확인 (resolver 결과 프리뷰)
4. 프로젝트 설정 (이름, 타겟 디렉토리)
5. "생성" 클릭
   │
   ├─ [프로그래매틱] Scaffold Engine 실행
   │   ├─ template clone
   │   ├─ superbuilder.json 주입
   │   ├─ 워크플로우 파일 생성
   │   └─ git init
   │
   ├─ [프로그래매틱] local-db에 프로젝트 저장
   │
   ├─ [자동] 생성된 디렉토리를 workspace로 열기
   │
   └─ [자동] CLI agent 실행
       ├─ Desktop agent launcher가 Claude Code 실행
       ├─ 초기 프롬프트: "/install-features"
       └─ Desktop 훅으로 진행 상태 수신

6. Pipeline Progress UI에서 실시간 상태 표시
   ├─ Scaffold: 완료
   ├─ Feature 설치: 진행 중 (auth → blog → ...)
   ├─ 빌드 검증: 대기
   └─ Git commit: 대기

7. 설치 완료 후
   ├─ Neon 연동 (기존 Phase 2)
   └─ Vercel 배포 (기존 Phase 3)
```

### tRPC Router 변경점

```typescript
// apps/desktop/src/lib/trpc/routers/atlas/composer.ts

// 기존: registry → resolve → extract (extractor)
// 변경: registry → resolve → scaffold (scaffold engine)
compose: publicProcedure.input(composeInput).mutation(async ({ input }) => {
  // 1. Registry + Resolve (기존 유지)
  const registry = await loadRegistry();
  const resolved = resolveFeatures(registry, input.selectedFeatures);

  // 2. Scaffold (새로운 부분 — extractor 대체)
  const result = await scaffold({
    projectName: input.projectName,
    targetDir: input.targetDir,
    config: input.config,
    resolved,
    registry,
    sourceRepoPath: getSuperbuilderPath(),
  });

  // 3. local-db 저장 (기존 유지)
  await saveAtlasProject(result);

  return result;
}),

// 새 mutation: scaffold 후 에이전트 실행 트리거
launchInstallAgent: publicProcedure
  .input(z.object({ projectDir: z.string() }))
  .mutation(async ({ input }) => {
    // Desktop의 agent launcher를 통해 CLI agent 실행
    // workspace open + 초기 프롬프트 "/install-features"
    return { launched: true, projectDir: input.projectDir };
  }),
```

### 기존 Composer UI 스텝퍼와의 호환

```
기존 6단계:                     변경 후:
1. Feature 선택       →        1. Feature 선택 (유지)
2. 의존성 확인        →        2. 의존성 확인 (유지)
3. 프로젝트 설정      →        3. 프로젝트 설정 (간소화 — Neon+BetterAuth 고정)
4. 프로젝트 생성      →        4. Scaffold 생성 (scaffold() 호출)
                               4.5 Feature 설치 (CLI agent 실행) — 새 단계
5. Neon 연동          →        5. Neon 연동 (유지)
6. Vercel 배포        →        6. Vercel 배포 (유지)
```

### 에이전트 진행 상태 모니터링

Desktop의 기존 notification hook 시스템 활용:

```
Claude Code 실행
  → hook: agent_start
  → hook: tool_call (Read, Write, Edit, Bash...)
  → hook: agent_stop

Desktop notification server
  → Composer UI의 PipelineProgress로 이벤트 전달
  → "auth 설치 중...", "blog 설치 중...", "빌드 검증 중..." 표시
```

에이전트가 superbuilder.json의 installed 섹션을 업데이트하므로,
파일 watch로 feature별 진행률 추적 가능.

---

## 8. Import Path 변환 주의사항

Feature 파일을 superbuilder에서 복사할 때, 내부 import 경로도 변환이 필요할 수 있음.

### 변환이 필요 없는 경우 (대부분)

| import 패턴 | 이유 |
|---|---|
| 상대 경로 (`./`, `../`) | 디렉토리 구조 유지되므로 동일 |

### 변환이 필요한 경우

| superbuilder import | template import | 처리 방법 |
|---|---|---|
| `@superbuilder/features-server/{name}` | `@repo/features/{name}` | 에이전트가 import 수정 |
| `@superbuilder/features-db` | `@repo/drizzle` | 에이전트가 import 수정 |
| `@superbuilder/features-client/*` | `@repo/core/*` | 에이전트가 import 수정 |
| `@superbuilder/feature-ui/*` | `@repo/ui/*` | 에이전트가 import 수정 |
| `@superbuilder/widgets/*` | `@repo/widgets/*` | 에이전트가 import 수정 |

이 변환은 워크플로우에 Import alias 매핑 테이블로 포함하여 에이전트가 처리.

---

## 9. 향후 확장

### Feature 업데이트 (Phase 5 — 미구현)

동일한 워크플로우 패턴으로 확장 가능:
- superbuilder.json의 installed 버전과 registry 최신 버전 비교
- diff 기반 업데이트 워크플로우 생성
- 에이전트가 변경분만 적용

### Feature 소스 분리 (B strategy 후속)

superbuilder에서 전용 features repo로 이동할 때:
- superbuilder.json의 source.repo만 변경
- pathMapping에서 from 경로만 업데이트
- Scaffold Engine과 워크플로우 구조는 동일하게 유지

### 프로그래매틱 전환 가능

에이전트가 처리하는 패턴이 안정되면, 자주 반복되는 작업을 코드로 전환 가능:
- 파일 복사: 단순 디렉토리 복사는 scaffold에서 처리
- Marker 삽입: features-cli의 insertAtMarker() 패턴 재활용
- 에이전트는 커스터마이즈, 에러 수정, edge case만 담당

---

## 부록: 관련 기존 코드

| 파일 | 역할 | 상태 |
|------|------|------|
| `packages/atlas-engine/src/extractor/` | 기존 extractor | 폐기 |
| `packages/atlas-engine/src/registry/` | Feature 스캔/메타데이터 | 유지 |
| `packages/atlas-engine/src/resolver/` | 의존성 해결 | 유지 |
| `packages/features-cli/src/utils/connector.ts` | Marker 기반 삽입 | 참고 (패턴 재활용) |
| `packages/features-cli/src/utils/registry.ts` | FeatureSpec, ProjectRegistry 타입 | 참고 (확장) |
| `apps/desktop/src/lib/trpc/routers/atlas/composer.ts` | Composer tRPC | 수정 필요 |
| `apps/desktop/src/lib/atlas-mcp-tools.ts` | Agent용 Neon/Vercel 도구 | 유지 |
| `apps/desktop/src/main/lib/agent-setup/` | CLI agent launcher | 활용 |
| `plans/atlas-composer-deploy-pipeline.md` | 전체 파이프라인 계획 | 업데이트 필요 |
