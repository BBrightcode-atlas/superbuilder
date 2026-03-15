# 3-Repo 아키텍처 가이드

## 1. 개요

Superbuilder 시스템은 3개의 GitHub 레포지토리로 구성된다. 각 레포는 명확한 역할을 가지며, 관심사 분리를 통해 독립적으로 발전할 수 있다.

### 레포 요약

| 레포 | GitHub | 역할 |
|------|--------|------|
| **superbuilder** | `BBrightcode-atlas/superbuilder` | 빌더 도구 — Desktop App, atlas-engine, Registry Scanner, Resolver |
| **superbuilder-features** | `BBrightcode-atlas/superbuilder-features` | Feature 저장소 — 개별 feature 패키지, Core Contract, Dev Kit |
| **superbuilder-app-boilerplate** | `BBrightcode-atlas/superbuilder-app-boilerplate` | 앱 템플릿 — 빈 셸 + `[ATLAS:*]` 마커, superbuilder.json |

### 왜 3개로 나누는가

1. **superbuilder**: feature를 **만들고, 조합하고, 배포**하는 도구. feature 코드 자체는 포함하지 않는다.
2. **superbuilder-features**: feature 코드의 **개발과 테스트** 전용 환경. `@superbuilder/*` import alias와 Dev Kit mock을 사용해 독립적으로 개발할 수 있다.
3. **superbuilder-app-boilerplate**: 최종 프로젝트의 **골격 템플릿**. `[ATLAS:*]` 마커가 있는 빈 셸로, scaffold 시 feature 코드가 주입된다.

```
superbuilder-features         superbuilder           superbuilder-app-boilerplate
(feature 코드)           (빌더 도구)              (앱 템플릿)
     │                        │                           │
     │  scan feature.json     │                           │
     ├───────────────────────>│                           │
     │                        │  clone + inject features  │
     │                        ├──────────────────────────>│
     │                        │                           │
     │  copy feature code     │                           │
     ├────────────────────────┼──────────────────────────>│
     │                        │                           │
```

---

## 2. 각 Repo 상세 구조

### 2.1 superbuilder (`BBrightcode-atlas/superbuilder`)

feature를 생성, 관리, 조합하는 **빌더 도구** 레포. 기본 브랜치는 `develop`.

```
superbuilder/
├── apps/
│   ├── web/          # 메인 웹앱 (app.superset.sh)
│   ├── marketing/    # 마케팅 사이트 (superset.sh)
│   ├── admin/        # 관리자 대시보드
│   ├── api/          # API 백엔드
│   ├── desktop/      # Electron 데스크톱 앱 (핵심 UI)
│   ├── docs/         # 문서 사이트
│   └── mobile/       # React Native 모바일 앱 (Expo)
├── packages/
│   ├── atlas-engine/ # ★ feature manifest 스캔, 의존성 해석, scaffold
│   ├── ui/           # 공유 UI 컴포넌트 (shadcn/ui + TailwindCSS v4)
│   ├── db/           # Drizzle ORM 데이터베이스 스키마
│   ├── auth/         # 인증
│   ├── agent/        # Agent 로직
│   ├── trpc/         # 공유 tRPC 정의
│   ├── shared/       # 공유 유틸리티
│   ├── mcp/          # MCP 연동
│   ├── desktop-mcp/  # Desktop MCP 서버
│   ├── local-db/     # 로컬 SQLite
│   ├── durable-session/ # Durable session 관리
│   ├── email/        # 이메일 템플릿/발송
│   └── scripts/      # CLI 도구
├── features/         # git submodule → superbuilder-features
└── tooling/
    └── typescript/   # 공유 TypeScript 설정
```

#### atlas-engine 내부 구조 (`packages/atlas-engine/src/`)

```
atlas-engine/src/
├── index.ts                       # 전체 re-export
├── manifest/
│   ├── scanner.ts                 # features/*/feature.json 스캔 → FeatureManifest[]
│   ├── adapter.ts                 # FeatureManifest[] → FeatureRegistry 변환
│   ├── remote.ts                  # GitHub API로 superbuilder.json 조회
│   ├── local.ts                   # 로컬 파일시스템에서 manifest 로드/저장
│   ├── types.ts                   # FeatureManifest, BoilerplateManifest 등 타입
│   └── index.ts
├── connection/
│   ├── deriver.ts                 # provides → DerivedConnections (코드 스니펫 생성)
│   ├── applier.ts                 # insertAtMarker() — [ATLAS:*] 마커에 코드 삽입
│   ├── apply-connections.ts       # 오케스트레이터 — derive + apply 통합 실행
│   ├── widget-export.ts           # widget subpath export 등록
│   ├── types.ts                   # DerivedConnections 타입
│   └── index.ts
├── transform/
│   ├── import-transformer.ts      # @superbuilder/* → @repo/* import 경로 변환
│   ├── import-map.ts              # 정적/동적 import 매핑 규칙
│   └── index.ts
├── scaffold/
│   ├── scaffold.ts                # boilerplate clone → feature 제거 → git init
│   ├── feature-remover.ts         # feature 제거 + 역의존성 캐스케이드
│   ├── register.ts                # feature를 boilerplate에 등록 (PR 생성)
│   ├── path-mapping.ts            # feature-json 소스 ↔ 타겟 경로 매핑
│   ├── types.ts                   # ScaffoldInput, RemoveInput 등 타입
│   └── index.ts
└── boilerplate/
    ├── manager.ts                 # boilerplate 관리 유틸
    ├── verifier.ts                # 검증 로직
    ├── prompt-builder.ts          # CLI agent용 프롬프트 생성
    └── index.ts
```

### 2.2 superbuilder-features (`BBrightcode-atlas/superbuilder-features`)

개별 feature 패키지를 **개발하고 테스트**하는 전용 레포.

```
superbuilder-features/
├── core/                          # Core Contract 스텁 (@superbuilder/core-*)
│   ├── auth/                      # @superbuilder/core-auth
│   ├── trpc/                      # @superbuilder/core-trpc
│   ├── db/                        # @superbuilder/core-db
│   ├── schema/                    # @superbuilder/core-schema
│   ├── logger/                    # @superbuilder/core-logger
│   └── ui/                        # @superbuilder/core-ui
├── dev-kit/                       # Dev Kit — core의 mock 구현체
│   ├── db/                        # 테스트용 in-memory DB
│   ├── auth/                      # mock 인증
│   ├── ui/                        # mock UI 컴포넌트
│   └── trpc/                      # mock tRPC
├── features/                      # 개별 feature 패키지들
│   ├── hello-world/
│   ├── blog/
│   ├── comment/
│   └── ...                        # 기타 feature들
├── package.json
└── tsconfig.json
```

#### 개별 Feature 패키지 구조

```
features/blog/
├── feature.json                   # ★ self-describing manifest (필수)
├── package.json                   # @superbuilder/feature-blog
├── src/
│   ├── server/                    # NestJS 모듈, tRPC 라우터
│   │   ├── blog.module.ts
│   │   ├── blog.router.ts
│   │   └── blog.service.ts
│   ├── client/                    # React 라우트, 페이지 컴포넌트
│   │   ├── routes.ts
│   │   └── pages/
│   ├── admin/                     # 관리자 페이지
│   │   └── routes.ts
│   ├── schema/                    # Drizzle 스키마
│   │   └── index.ts
│   ├── common/                    # 서버/클라이언트 공유 코드
│   │   └── types.ts
│   └── widget/                    # (widget feature인 경우)
│       └── index.ts
├── dev/                           # Dev Kit 통합 설정
│   └── setup.ts
└── tests/
    └── *.test.ts
```

#### Core Contract

Core Contract는 feature가 의존하는 인터페이스의 **스텁**이다. feature 코드는 `@superbuilder/core-*`로 import하고, scaffold 시 `@repo/*`로 변환된다.

| Core 패키지 | Feature에서의 import | Scaffold 후 import |
|-------------|---------------------|-------------------|
| `core/auth` | `@superbuilder/core-auth` | `@repo/core/auth` |
| `core/trpc` | `@superbuilder/core-trpc` | `@repo/core/trpc` |
| `core/db` | `@superbuilder/core-db` | `@repo/drizzle` |
| `core/schema` | `@superbuilder/core-schema` | `@repo/drizzle` |
| `core/logger` | `@superbuilder/core-logger` | `@repo/core/logger` |
| `core/ui` | `@superbuilder/core-ui` | `@repo/ui` |

### 2.3 superbuilder-app-boilerplate (`BBrightcode-atlas/superbuilder-app-boilerplate`)

최종 프로젝트의 **골격 템플릿**. `[ATLAS:*]` 마커가 있는 빈 셸이다.

```
superbuilder-app-boilerplate/
├── apps/
│   ├── atlas-server/              # NestJS + Fastify 백엔드
│   │   ├── src/
│   │   │   ├── app.module.ts      # [ATLAS:IMPORTS], [ATLAS:MODULES]
│   │   │   └── trpc/
│   │   │       └── router.ts      # [ATLAS:IMPORTS], [ATLAS:ROUTERS]
│   │   └── ...
│   ├── app/                       # React + TanStack Router 프론트엔드
│   │   └── src/
│   │       ├── router.tsx         # [ATLAS:IMPORTS], [ATLAS:ROUTES]
│   │       └── lib/
│   │           └── feature-i18n.ts # [ATLAS:LOCALES_*]
│   └── system-admin/              # 관리자 대시보드
│       └── src/
│           ├── router.tsx         # [ATLAS:IMPORTS], [ATLAS:ADMIN_ROUTES]
│           └── feature-config.ts  # [ATLAS:FEATURE_MENUS]
├── packages/
│   ├── features/                  # feature 모듈 (core만 유지, 나머지 이관 중)
│   │   └── app-router.ts         # [ATLAS:IMPORTS], [ATLAS:ROUTERS]
│   ├── drizzle/                   # Drizzle ORM 스키마
│   │   ├── src/schema/
│   │   │   └── index.ts          # [ATLAS:SCHEMA_EXPORTS]
│   │   └── src/schema-registry.ts # [ATLAS:SCHEMA_IMPORTS], [ATLAS:SCHEMA_SPREAD]
│   ├── core/                      # 공유 비즈니스 로직
│   └── widgets/                   # 위젯 패키지
├── superbuilder.json              # 레거시 (비어있음, feature.json으로 대체됨)
└── drizzle.config.ts              # [ATLAS:TABLES]
```

---

## 3. 데이터 흐름 & 연결 방법

### 3.1 Feature 개발 흐름 (전체)

```
1. Feature 코드 작성
   superbuilder-features/features/blog/ 에서 개발
   ↓
2. feature.json 선언
   id, provides, dependencies 등 self-describing manifest 작성
   ↓
3. Scanner가 feature.json 스캔
   atlas-engine의 scanFeatureManifests() → FeatureManifest[] 생성
   ↓
4. Adapter가 Registry 변환
   manifestsToRegistry() → FeatureRegistry (Desktop UI용)
   ↓
5. Composer UI에서 사용자가 feature 선택
   Desktop App의 Composer 화면에서 원하는 feature 체크
   ↓
6. Resolver가 의존성 해결
   resolveFeatures() → 토폴로지 정렬된 feature 목록
   ↓
7. Scaffold Engine이 프로젝트 생성
   a. boilerplate clone (shallow)
   b. feature 코드를 features repo에서 복사
   c. [ATLAS:*] 마커에 connection 코드 삽입
   d. @superbuilder/* → @repo/* import 변환
   e. 불필요 feature 제거
   f. git init + initial commit
```

### 3.2 Import 변환

Feature 소스 코드에서 사용하는 `@superbuilder/*` import는 scaffold 시 `@repo/*`로 자동 변환된다.

#### 정적 매핑 (STATIC_IMPORT_MAP)

| Feature 소스 | Scaffold 후 |
|-------------|-------------|
| `@superbuilder/core-auth` | `@repo/core/auth` |
| `@superbuilder/core-trpc` | `@repo/core/trpc` |
| `@superbuilder/core-db` | `@repo/drizzle` |
| `@superbuilder/core-schema` | `@repo/drizzle` |
| `@superbuilder/core-logger` | `@repo/core/logger` |
| `@superbuilder/core-ui` | `@repo/ui` |

#### 동적 매핑 (DYNAMIC_IMPORT_PATTERNS)

| 패턴 | 변환 예시 |
|------|----------|
| `@superbuilder/feature-{name}` | `@repo/features/{name}` |
| `@superbuilder/feature-{name}/widget` | `@repo/widgets/{name}` |
| `@superbuilder/feature-{name}/schema` | `@repo/drizzle` |
| `@superbuilder/feature-{name}/common` | `@repo/features/{name}` |

변환은 `transformImports()` 함수가 정규식으로 소스 코드의 모든 import 경로를 치환한다.

### 3.3 경로 매핑 (Path Mapping)

Feature 패키지의 소스 디렉토리가 boilerplate의 어디로 복사되는지 정의한다.

| Slot | Feature 소스 (`src/`) | Boilerplate 타겟 |
|------|----------------------|-----------------|
| server | `src/server` | `packages/features/{id}` |
| client | `src/client` | `apps/app/src/features/{id}` |
| admin | `src/admin` | `apps/admin/src/features/{id}` |
| schema | `src/schema` | `packages/drizzle/src/schema/features/{id}` |
| widgets | `src/widget` | `packages/widgets/src/{id}` |

### 3.4 Submodule 연결

superbuilder 레포에서 features 레포를 submodule로 연결해 로컬 개발 시 사용한다.

```bash
# superbuilder/features/ → git submodule: superbuilder-features
git submodule add https://github.com/BBrightcode-atlas/superbuilder-features.git features
```

Turborepo workspace 설정에서 submodule 내 패키지를 포함:
- `features/core/*` — Core Contract 패키지들
- `features/dev-kit` — Dev Kit 패키지
- `features/features/*` — 개별 feature 패키지들

### 3.5 Connection 자동 도출

`feature.json`의 `provides` 필드에서 connection 코드가 자동으로 도출된다.

```
feature.json provides        deriveConnections()        insertAtMarker()
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│ server:          │     │ nestModuleImport     │     │ app.module.ts      │
│   module: "Blog" │────>│ nestModuleRef        │────>│ [ATLAS:IMPORTS]    │
│   router: "blog" │     │ trpcRouterImport     │     │ [ATLAS:MODULES]    │
│   routerKey: ... │     │ trpcRouterKey        │     │ router.ts          │
│ client:          │     │ clientRoutesImport   │     │ [ATLAS:IMPORTS]    │
│   routes: ...    │     │ clientRoutesSpread   │     │ [ATLAS:ROUTES]     │
│ schema:          │     │ schemaExport         │     │ schema/index.ts    │
│   tables: [...]  │     │ tablesFilter         │     │ [ATLAS:TABLES]     │
└─────────────────┘     └──────────────────────┘     └────────────────────┘
```

---

## 4. atlas-engine 모듈 상세

### 4.1 manifest/scanner

`features/*/feature.json` 파일을 스캔하여 `FeatureManifest[]`를 반환한다.

```typescript
scanFeatureManifests(featuresDir: string): FeatureManifest[]
```

- 디렉토리를 순회하며 각 하위 디렉토리의 `feature.json` 파싱
- `.` 또는 `_` 로 시작하는 디렉토리는 무시
- `optionalDependencies` 기본값을 `[]`로 보장
- 결과를 `id` 기준 알파벳 정렬

### 4.2 manifest/adapter

`FeatureManifest[]`를 Desktop UI에서 사용할 수 있는 `FeatureRegistry`로 변환한다.

```typescript
manifestsToRegistry(manifests: FeatureManifest[]): FeatureRegistry
```

- `provides` 필드에서 router, client, admin, schema, widget 정보를 추출
- 표준 그룹 (core, content, commerce, community, system, template) 매핑
- core 그룹 feature는 자동으로 `core` 목록에 추가

### 4.3 connection/deriver

`provides` 정보에서 boilerplate에 삽입할 코드 스니펫(`DerivedConnections`)을 생성한다.

```typescript
deriveConnections(featureId: string, provides: Provides): DerivedConnections
```

도출되는 connection 종류:

| 필드 | 설명 | 예시 |
|------|------|------|
| `nestModuleImport` | NestJS 모듈 import 문 | `import { BlogModule } from "@repo/features/blog";` |
| `nestModuleRef` | NestJS imports 배열 항목 | `BlogModule,` |
| `trpcRouterImport` | tRPC 라우터 import 문 | `import { blogRouter } from "@repo/features/blog";` |
| `trpcRouterKey` | tRPC 라우터 키 등록 | `blog: blogRouter,` |
| `trpcTypeImport` | 타입 전용 import | `import type { blogRouter } from "./blog";` |
| `trpcTypeKey` | 타입 전용 라우터 키 | `blog: typeof blogRouter;` |
| `clientRoutesImport` | 클라이언트 라우트 import | `import { createBlogRoutes } from "@features/blog";` |
| `clientRoutesSpread` | 라우트 spread | `...createBlogRoutes(),` |
| `adminRoutesImport` | 어드민 라우트 import | `import { createBlogAdminRoutes } from "./features/blog";` |
| `adminRoutesSpread` | 어드민 라우트 spread | `...createBlogAdminRoutes(),` |
| `adminMenu` | 사이드바 메뉴 JSON | `{"id":"blog","label":"블로그",...}` |
| `schemaExport` | 스키마 re-export | `export * from "./features/blog";` |
| `tablesFilter` | 테이블 필터 | `"blog_posts", "blog_categories"` |
| `widgetExport` | 위젯 subpath export | `{ subpath: "./comment", entry: "./src/comment/index.ts" }` |

### 4.4 connection/applier

`[ATLAS:*]` 마커 블록의 닫는 태그 직전에 코드를 삽입한다.

```typescript
insertAtMarker(filePath: string, marker: string, content: string): void
```

- 닫는 태그 `[/ATLAS:{marker}]`를 찾아 그 앞에 삽입
- 닫는 태그의 들여쓰기를 감지하여 동일한 indent 적용
- 마커가 없으면 아무 작업도 하지 않음

### 4.5 connection/apply-connections

deriver와 applier를 통합하는 오케스트레이터.

```typescript
applyConnections(templateDir: string, manifest: FeatureManifest): void
```

내부 `MARKER_MAP`이 DerivedConnections의 각 필드를 파일 + 마커에 매핑한다:

| 필드 | 파일 | 마커 |
|------|------|------|
| `nestModuleImport` | `apps/atlas-server/src/app.module.ts` | `IMPORTS` |
| `nestModuleRef` | `apps/atlas-server/src/app.module.ts` | `MODULES` |
| `trpcRouterImport` | `apps/atlas-server/src/trpc/router.ts` | `IMPORTS` |
| `trpcRouterKey` | `apps/atlas-server/src/trpc/router.ts` | `ROUTERS` |
| `trpcTypeImport` | `packages/features/app-router.ts` | `IMPORTS` |
| `trpcTypeKey` | `packages/features/app-router.ts` | `ROUTERS` |
| `clientRoutesImport` | `apps/app/src/router.tsx` | `IMPORTS` |
| `clientRoutesSpread` | `apps/app/src/router.tsx` | `ROUTES` |
| `adminRoutesImport` | `apps/admin/src/router.tsx` | `IMPORTS` |
| `adminRoutesSpread` | `apps/admin/src/router.tsx` | `ADMIN_ROUTES` |
| `schemaExport` | `packages/drizzle/src/schema/index.ts` | `SCHEMA_EXPORTS` |

### 4.6 transform/import-transformer

소스 코드에서 `@superbuilder/*` import 경로를 `@repo/*`로 변환한다.

```typescript
transformImports(source: string): string
transformImportPath(importPath: string): string | null
```

- 정규식으로 `from '...'` 및 `import('...')` 패턴 매칭
- 정적 매핑(`STATIC_IMPORT_MAP`)을 먼저 확인 후 동적 패턴(`DYNAMIC_IMPORT_PATTERNS`) 적용

### 4.7 scaffold/path-mapping

Feature 패키지의 소스 디렉토리를 boilerplate 타겟 경로로 매핑한다.

```typescript
resolveFeatureJsonSourcePath(featuresRepoPath, featureId, slot): string
resolveFeatureJsonTargetPath(projectDir, featureId, slot): string
```

`FEATURE_JSON_PATH_MAPPING` 상수로 5개 슬롯(server, client, admin, schema, widgets)의 from/to 정의.

---

## 5. 마이그레이션 상태

기존 boilerplate-내장 feature를 superbuilder-features 레포로 이관하는 작업이 진행 중이다.

### Phase 1 (현재): 파일럿

- hello-world feature 이관 완료
- feature.json 기반 scanner/adapter/deriver 구현 완료
- 13개 feature 이관 작업 진행 중

### Phase 2: Core + Widget Feature 이관

- Core Contract 스텁 패키지 정리 (core/auth, core/trpc, core/db 등)
- Widget feature (comment, review 등) 이관
- Dev Kit mock 구현체 보강

### Phase 3: Page Feature 이관

- 대규모 page feature (blog, board, community, payment 등) 이관
- 복잡한 inter-feature 의존성 검증
- E2E 테스트 파이프라인 구축

### Phase 4: Boilerplate 정리 + Scaffold Engine 전환

- boilerplate에서 레거시 feature 코드 완전 제거
- `superbuilder.json` 기반에서 `feature.json` 스캔 기반으로 전환
- Scaffold Engine이 features repo에서 직접 코드를 복사하는 방식으로 변경
- 기존 `removeFeatures()` (boilerplate에서 제거) → `addFeatures()` (features에서 복사) 방식으로 전환
