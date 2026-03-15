# Superset Monorepo Guide

Guidelines for agents and developers working in this repository.

## Structure

Bun + Turbo monorepo with:
- **Apps**:
  - `apps/web` - Main web application (app.superset.sh)
  - `apps/marketing` - Marketing site (superset.sh)
  - `apps/admin` - Admin dashboard
  - `apps/api` - API backend
  - `apps/desktop` - Electron desktop application
  - `apps/docs` - Documentation site
  - `apps/mobile` - React Native mobile app (Expo)
- **Packages**:
  - `packages/ui` - Shared UI components (shadcn/ui + TailwindCSS v4).
    - Add components: `npx shadcn@latest add <component>` (run in `packages/ui/`)
  - `packages/db` - Drizzle ORM database schema
  - `packages/auth` - Authentication
  - `packages/agent` - Agent logic
  - `packages/trpc` - Shared tRPC definitions
  - `packages/shared` - Shared utilities
  - `packages/mcp` - MCP integration
  - `packages/desktop-mcp` - Desktop MCP server
  - `packages/local-db` - Local SQLite database
  - `packages/durable-session` - Durable session management
  - `packages/email` - Email templates/sending
  - `packages/scripts` - CLI tooling
  - `packages/atlas-engine` - Feature manifest 읽기, 의존성 해석, 프로젝트 scaffold
- **Tooling**:
  - `tooling/typescript` - Shared TypeScript configs

## Tech Stack

- **Package Manager**: Bun (no npm/yarn/pnpm)
- **Build System**: Turborepo
- **Database**: Drizzle ORM + Neon PostgreSQL
- **UI**: React + TailwindCSS v4 + shadcn/ui
- **Code Quality**: Biome (formatting + linting at root)
- **Next.js**: Version 16 - NEVER create `middleware.ts`. Next.js 16 renamed middleware to `proxy.ts`. Always use `proxy.ts` for request interception.

## Common Commands

```bash
# Development
bun dev                    # Start all dev servers
bun test                   # Run tests
bun build                  # Build all packages

# Code Quality
bun run lint               # Check for lint issues (no changes)
bun run lint:fix           # Fix auto-fixable lint issues
bun run format             # Format code only
bun run format:check       # Check formatting only (CI)
bun run typecheck          # Type check all packages

# Maintenance
bun run clean              # Clean root node_modules
bun run clean:workspaces   # Clean all workspace node_modules
```

## Code Quality

**Biome runs at root level** (not per-package) for speed:
- `biome check --write --unsafe` = format + lint + organize imports + fix all auto-fixable issues
- `biome check` = check only (no changes)
- `biome format` = format only
- Use `bun run lint:fix` to fix all issues automatically

## Agent Rules
1. **Type safety** - avoid `any` unless necessary
2. **Prefer `gh` CLI** - when performing git operations (PRs, issues, checkout, etc.), prefer the GitHub CLI (`gh`) over raw `git` commands where possible
7. **GitHub repo 삭제 금지** — `gh repo delete`는 **이 세션에서 직접 생성한 테스트용 임시 repo**(`compose-e2e-*` 등)만 삭제 가능하다. `superbuilder`, `superbuilder-features`, `superbuilder-app-boilerplate` 및 **그 외 모든 기존 repo는 절대 삭제하지 않는다.** 연관 없는 repo, 모르는 repo, 확인되지 않은 repo는 삭제 대상이 아니다.
3. **Shared command source** - keep command definitions in `.agents/commands/` only. `.claude/commands` and `.cursor/commands` should be symlinks to `../.agents/commands`. (`packages/chat` discovers slash commands from `.claude/commands`.)
4. **Workspace MCP config** - keep shared MCP servers in `.mcp.json`; `.cursor/mcp.json` should link to `../.mcp.json`. Codex uses `.codex/config.toml` (run with `CODEX_HOME=.codex codex ...`). OpenCode uses `opencode.json` and should mirror the same MCP set using OpenCode's `remote`/`local` schema.
5. **Mastracode fork workflow** - for Superset's internal `mastracode` fork bundle and release process, follow `docs/mastracode-fork-workflow.md`.
6. **Desktop git env** - in `apps/desktop`, do not import `simple-git` directly for runtime use or call raw `execFile("git", ...)`. Use the helpers in `apps/desktop/src/lib/trpc/routers/workspaces/utils/git-client.ts` so git resolves with shell-derived env/PATH.
8. **main 브랜치 직접 머지 금지** — agent는 develop 브랜치까지만 push/머지한다. `main`으로의 머지는 사람이 직접 수행한다. PR 생성은 가능하지만 머지는 하지 않는다.

## Boilerplate & Feature Rules

**Feature 코드는 이 레포에 없다.** 모든 피처 코드는 별도의 boilerplate 레포(`BBrightcode-atlas/superbuilder-app-boilerplate`)에 존재한다. 이 레포(superbuilder)는 피처를 **생성, 관리, 조합**하는 도구이다.

### Source of Truth
- **`superbuilder.json`** (boilerplate repo, `develop` branch) = 피처 카탈로그의 유일한 source of truth
- Superbuilder는 GitHub API (`gh api`)로 이 파일을 읽기만 한다
- 피처 메타데이터를 superbuilder 코드에 하드코딩하지 않는다

### atlas-engine (`packages/atlas-engine`)
- **manifest/** — `superbuilder.json` 읽기 (`remote.ts`: gh api, `local.ts`: 파일)
- **resolver/** — 의존성 해석 + 토폴로지 정렬
- **scaffold/** — boilerplate clone → 피처 제거 → 새 프로젝트 생성
- **scaffold/register.ts** — 피처 코드를 boilerplate에 등록 (PR 생성)

### Feature Lifecycle
1. **조회**: `fetchRemoteManifest()` → `manifest.features` (1분 캐시)
2. **등록**: `registerToBoilerplate()` → boilerplate에 코드 복사 + marker 삽입 + manifest 업데이트 + PR
3. **제거**: `removeFeatures()` → 디렉토리 삭제 + marker 제거 + manifest 업데이트 (역의존성 캐스케이드)
4. **프로젝트 생성**: `scaffold()` → boilerplate clone → 불필요 피처 제거 → git init

### Marker 블록 규칙
```typescript
// [ATLAS:IMPORTS]
import { BlogModule } from "@repo/features/blog";
// [/ATLAS:IMPORTS]
```
- 피처 등록 시: 닫는 태그 앞에 삽입 (중복 방지)
- 피처 제거 시: 정확한 매칭으로 해당 줄 삭제

### Desktop Atlas Routers (`apps/desktop/src/lib/trpc/routers/atlas/`)
- `registry.ts` — manifest 조회 (캐시)
- `resolver.ts` — 의존성 해석
- `composer.ts` — 프로젝트 생성 (scaffold)
- `feature-studio.ts` — Feature Studio 워크플로우 + boilerplate 등록

### 상세 설계
- 조회/등록 흐름: `docs/architecture/subsystems/feature-lifecycle.md`
- 개발 파이프라인: `docs/architecture/subsystems/feature-development-pipeline.md`
- 승인 워크플로우: `docs/architecture/subsystems/feature-approval-workflow.md`

### 승인 체계 (3단계)
1. **spec_plan 승인** — Spec/Plan 검토 → approved: agent 코드 개발 시작
2. **human_qa 승인** — 구현 결과 검토 → approved: 등록 대기
3. **registration 승인** — 최종 등록 검토 → approved: boilerplate PR 생성

### 역할 분리
- **서버 (packages/trpc)**: DB 상태 관리, CRUD, artifact 저장, 상태 전이 가드
- **Desktop (atlas routers)**: 오케스트레이션 — spec/plan 생성, worktree, agent launch, 검증, PR 생성
- **respondToApproval**: 승인 응답 + **다음 상태 자동 전이** (approved → nextStatus)

### CLI 진입점
파이프라인은 하나. CLI 사용 경로만 2가지:
1. **Desktop UI** → Desktop tRPC router가 CLI agent launch
2. **외부 CLI** → claude/codex에서 직접 서버 API 호출 (향후, 복잡 시 생략)

현재 오케스트레이션은 Desktop feature-studio.ts에 있음. 외부 CLI 진입점이 필요하면 핸들러 함수들을 atlas-engine/pipeline으로 추출.

### Feature 개발 흐름 (CLI Agent)
1. Feature Studio에서 spec/plan 생성 → 승인
2. Boilerplate repo의 **git worktree** 생성 (`~/.superbuilder/worktrees/{name}/`)
3. CLI agent (claude/codex)가 **worktree를 cwd**로 피처 코드 작성
4. Agent가 marker 블록 삽입 + superbuilder.json 업데이트 + commit/push
5. 자동 검증 (typecheck + lint) → Human QA
6. 승인 시 boilerplate에 PR 생성 → 머지 → 피처 등록 완료

## 3-Repo 아키텍처

3개 레포로 관심사를 분리한다. 상세는 `docs/architecture/three-repo-architecture.md` 참조.

| 레포 | 역할 | 작업 브랜치 | 안정 브랜치 |
|------|------|-----------|-----------|
| `BBrightcode-atlas/superbuilder` | 빌더 도구 (Desktop, atlas-engine, Registry) | `develop` | `main` |
| `BBrightcode-atlas/superbuilder-features` | Feature 코드 저장소 (feature 패키지, Core Contract, Dev Kit) | `main` | `main` |
| `BBrightcode-atlas/superbuilder-app-boilerplate` | 앱 템플릿 (빈 셸 + `[ATLAS:*]` 마커) | `develop` | `develop` |

### 브랜치 구조 (superbuilder)

| 브랜치 | 추적 | 역할 |
|--------|------|------|
| `develop` | `origin/develop` | 작업 브랜치 — 모든 개발은 여기서 |
| `main` | `origin/main` | 안정 브랜치 — develop에서 PR로 머지 |
| `main_superset` | `upstream/main` | superset 원본 추적 전용 — 직접 수정 금지 |

Upstream sync: `/sync-upstream` 스킬 사용. `main_superset` ← upstream/main → sync branch → develop 머지.

### 크로스 레포 작업 시 주의사항
- Feature 코드는 superbuilder-features에만 존재한다. superbuilder 레포에 feature 코드를 넣지 않는다
- `superbuilder.json` (boilerplate)은 레거시 source of truth. 신규 feature는 `feature.json` 기반으로 작성한다
- Import 경로: feature 개발 시 `@superbuilder/*`, scaffold 후 `@repo/*`로 자동 변환
- Submodule: `superbuilder/features/` → superbuilder-features (로컬 개발용)

## atlas-engine 모듈 가이드

`packages/atlas-engine/src/` 내 4개 모듈:

### 모듈 구조
- **manifest/** — feature.json 스캔 (`scanFeatureManifests`), FeatureRegistry 변환 (`manifestsToRegistry`), 원격 manifest 조회 (`fetchRemoteManifest`)
- **connection/** — provides → 코드 스니펫 도출 (`deriveConnections`), 마커에 삽입 (`insertAtMarker`), 통합 실행 (`applyConnections`)
- **transform/** — `@superbuilder/*` → `@repo/*` import 경로 변환 (`transformImports`)
- **scaffold/** — boilerplate clone + feature 제거 (`scaffold`), boilerplate 등록 (`registerToBoilerplate`), 경로 매핑 (`resolveFeatureJsonSourcePath`, `resolveFeatureJsonTargetPath`)

### 테스트
- 프레임워크: `bun:test` (Bun 내장)
- 실행: `bun test` (packages/atlas-engine에서)
- 테스트 파일 (`*.test.ts`)은 tsconfig에서 제외되어 있다

## 레퍼런스 문서
- 3-Repo 아키텍처: `docs/architecture/three-repo-architecture.md`
- [ATLAS:*] 마커 레퍼런스: `docs/architecture/subsystems/marker-reference.md`
- feature.json 스키마: `docs/architecture/subsystems/feature-json-schema.md`
- Composer → Scaffold 파이프라인: `docs/architecture/subsystems/composer-scaffold-pipeline.md`

---

## Project Structure

All projects in this repo should be structured like this:

```
app/
├── page.tsx
├── dashboard/
│   ├── page.tsx
│   ├── components/
│   │   └── MetricsChart/
│   │       ├── MetricsChart.tsx
│   │       ├── MetricsChart.test.tsx      # Tests co-located
│   │       ├── index.ts
│   │       └── constants.ts
│   ├── hooks/                             # Hooks used only in dashboard
│   │   └── useMetrics/
│   │       ├── useMetrics.ts
│   │       ├── useMetrics.test.ts
│   │       └── index.ts
│   ├── utils/                             # Utils used only in dashboard
│   │   └── formatData/
│   │       ├── formatData.ts
│   │       ├── formatData.test.ts
│   │       └── index.ts
│   ├── stores/                            # Stores used only in dashboard
│   │   └── dashboardStore/
│   │       ├── dashboardStore.ts
│   │       └── index.ts
│   └── providers/                         # Providers for dashboard context
│       └── DashboardProvider/
│           ├── DashboardProvider.tsx
│           └── index.ts
└── components/
    ├── Sidebar/
    │   ├── Sidebar.tsx
    │   ├── Sidebar.test.tsx               # Tests co-located
    │   ├── index.ts
    │   ├── components/                    # Used 2+ times IN Sidebar
    │   │   └── SidebarButton/             # Shared by SidebarNav + SidebarFooter
    │   │       ├── SidebarButton.tsx
    │   │       ├── SidebarButton.test.tsx
    │   │       └── index.ts
    │   ├── SidebarNav/
    │   │   ├── SidebarNav.tsx
    │   │   └── index.ts
    │   └── SidebarFooter/
    │       ├── SidebarFooter.tsx
    │       └── index.ts
    └── HeroSection/
        ├── HeroSection.tsx
        ├── HeroSection.test.tsx           # Tests co-located
        ├── index.ts
        └── components/                    # Used ONLY by HeroSection
            └── HeroCanvas/
                ├── HeroCanvas.tsx
                ├── HeroCanvas.test.tsx
                ├── HeroCanvas.stories.tsx
                ├── index.ts
                └── config.ts

components/                                # Used in 2+ pages (last resort)
└── Header/
```

1. **One folder per component**: `ComponentName/ComponentName.tsx` + `index.ts` for barrel export
2. **Co-locate by usage**: If used once, nest under parent's `components/`. If used 2+ times, promote to **highest shared parent's** `components/` (or `components/` as last resort)
3. **One component per file**: No multi-component files
4. **Co-locate dependencies**: Utils, hooks, constants, config, tests, stories live next to the file using them

### Exception: shadcn/ui Components

The `src/components/ui/` and `src/components/ai-elements` directories contain shadcn/ui components. These use **kebab-case single files** (e.g., `button.tsx`, `base-node.tsx`) instead of the folder structure above. This is intentional—shadcn CLI expects this format for updates via `bunx shadcn@latest add`.

## Database Rules

** IMPORTANT ** - Never touch the production database unless explicitly asked to. Even then, confirm with the user first.

- Schema in `packages/db/src/`
- Use Drizzle ORM for all database operations

## DB migrations
- Always spin up a new neon branch to create migrations. Update our root .env files to point at the neon branch locally.
- Use drizzle to manage the migration. You can see the schema at packages/db/src/schema. Never run a migration yourself.
- Create migrations by changing drizzle schema then running `bunx drizzle-kit generate --name="<sample_name_snake_case>"`
- `NEON_ORG_ID` and `NEON_PROJECT_ID` env vars are set in .env
- list_projects tool requires org_id passed in
- **NEVER manually edit files in `packages/db/drizzle/`** - this includes `.sql` migration files, `meta/_journal.json`, and snapshot files. These are auto-generated by Drizzle. If you need to create a migration, only modify the schema files in `packages/db/src/schema/` and ask the user to run `drizzle-kit generate`.
