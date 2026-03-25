# Backstage-Style Feature Plugin System Design

> **요약**: Superbuilder의 feature를 Backstage plugin 아키텍처를 참고하여 독립 패키지로 캡슐화하고,
> boilerplate에서 분리하여 독립 실행/테스트/조합이 가능한 시스템으로 재설계한다.

**상태**: 설계 승인 대기 (2026-03-14)

---

## 1. 배경

### 현재 상태

- `superbuilder-app-template`(boilerplate)에 30개+ feature가 4곳에 분산되어 있음
  - `packages/features/{name}/` — server (NestJS Module, tRPC, Service)
  - `apps/app/src/features/{name}/` — client UI
  - `apps/system-admin/src/features/{name}/` — admin UI
  - `packages/drizzle/src/schema/features/{name}/` — DB schema
  - `packages/widgets/src/{name}/` — widget UI
- Feature를 독립적으로 실행/테스트할 수 없음
- Feature 메타데이터가 `superbuilder.json`에 중앙 집중 (수동 관리)
- Boilerplate과 feature가 물리적으로 결합되어 있어 분리 불가

### 목표

1. Feature를 독립 패키지로 통합 (server + client + schema를 하나의 폴더에)
2. Feature를 boilerplate 없이 독립 실행/테스트 가능하게
3. Feature와 boilerplate의 git 이력 분리
4. 기존 Scaffold Engine + Composer와 자연스럽게 연동
5. Backstage의 plugin 패턴 (self-describing manifest, extension point, core contract) 적용

### Backstage에서 차용하는 패턴

| Backstage 개념 | Superbuilder 대응 |
|---------------|-------------------|
| Plugin package (`@backstage/plugin-*`) | Feature package (`@superbuilder/feature-*`) |
| `createPlugin({ id, routes, apis })` | `feature.json` manifest |
| Core Services (DI) | Core Contract packages (`@superbuilder/core-*`) |
| Extension Points | `[ATLAS:*]` Markers + `feature.json > provides` (자동 도출) |
| Software Catalog | Feature Registry (자동 스캔) |
| Dev harness (`dev/index.ts`) | `dev/server.ts` + `dev/app.tsx` |
| Plugin npm package | Feature를 독립 패키지로, 나중에 npm publish 가능 |

### 차용하지 않는 패턴

| Backstage 패턴 | 이유 |
|---------------|------|
| Feature당 3~5개 패키지 분리 | 오버헤드 과다. 단일 패키지 + 멀티 엔트리포인트로 대체 |
| Backend plugin 간 네트워크 통신 강제 | 규모에 비해 과도한 격리 |
| Frontend ApiRef DI | tRPC + Jotai로 이미 해결 |

---

## 2. 3-Repo 아키텍처

```
BBrightcode-atlas/superbuilder               # 빌더 도구
BBrightcode-atlas/superbuilder-features       # feature 패키지들 (git submodule)
BBrightcode-atlas/superbuilder-app-template      # 빈 앱 template
```

### 역할 분리

| Repo | 역할 | 포함하는 것 |
|------|------|-----------|
| **superbuilder** | 빌더 도구 | Composer UI (Desktop), Scaffold Engine, Registry Scanner, Resolver |
| **superbuilder-features** | feature 저장소 | 개별 feature 패키지, Core Contract, Dev Kit |
| **superbuilder-app-template** | 앱 template | 빈 셸 + `[ATLAS:*]` 마커, Core 구현체 |

> **용어 정리**: 기존 스펙에서 `superbuilder-app-template`으로 불리던 repo는 Composer Scaffold 스펙에 맞춰 `superbuilder-app-template`으로 통일한다.

### Submodule 연결

```
superbuilder/
├── features/              → git submodule: superbuilder-features
├── apps/desktop/          # superbuilder 자체 코드
└── packages/engine/       # superbuilder 자체 코드
```

- Feature 커밋은 `superbuilder-features` repo에만 쌓임
- Superbuilder repo의 git log에 feature 변경이 섞이지 않음
- Feature 개발자는 `superbuilder-features` repo만 clone해도 독립 개발 가능

### Turborepo 워크스페이스 통합

Submodule이 추가되면 Superbuilder의 root `package.json`과 `turbo.json`을 업데이트하여 `features/` 하위 패키지를 인식시킨다.

```jsonc
// superbuilder/package.json — workspaces 필드
{
  "workspaces": [
    "apps/*",
    "packages/*",
    "features/core",           // submodule 내 core
    "features/dev-kit",        // submodule 내 dev-kit
    "features/features/*"      // submodule 내 개별 feature
  ]
}
```

```jsonc
// superbuilder/turbo.json — pipeline에 feature 패키지 포함
{
  "pipeline": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "dependsOn": ["^build"], "persistent": true },
    "test": {}
  }
}
```

> **주의**: 마이그레이션 Phase 1~3 동안에는 features가 boilerplate와 submodule 양쪽에 공존한다. Submodule pointer는 각 Phase의 마이그레이션 커밋 후 업데이트한다. CI에서는 `git submodule update --init --recursive`를 실행하도록 설정한다.

---

## 3. Feature Package 구조

하나의 feature = 하나의 패키지. 현재 4곳에 분산된 코드를 하나로 통합.

### 디렉토리 구조

```
features/blog/
├── package.json                # @superbuilder/feature-blog
├── feature.json                # self-describing manifest
├── tsconfig.json
├── dev/                        # 독립 실행 환경
│   ├── server.ts               # 최소 NestJS + mock DB
│   ├── app.tsx                 # 최소 React 앱
│   ├── seed.ts                 # mock 데이터
│   └── vite.config.ts
├── src/
│   ├── server/                 # NestJS Module + tRPC Router
│   │   ├── blog.module.ts
│   │   ├── blog.router.ts
│   │   ├── service/
│   │   │   └── blog.service.ts
│   │   ├── controller/
│   │   │   └── blog.controller.ts
│   │   └── index.ts
│   ├── client/                 # React 페이지 + 컴포넌트
│   │   ├── routes/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   ├── admin/                  # Admin 전용 UI
│   │   ├── routes/
│   │   ├── pages/
│   │   └── index.ts
│   ├── schema/                 # Drizzle 테이블 + relations
│   │   └── index.ts
│   ├── dto/                    # Zod DTO
│   │   └── index.ts
│   └── common/                 # 공유 타입 (server↔client)
│       └── types.ts
├── tests/
│   ├── server/
│   │   └── blog.service.spec.ts
│   └── client/
│       └── blog-list.spec.tsx
└── locales/                    # i18n (선택)
    ├── ko.json
    └── en.json
```

### package.json 멀티 엔트리포인트

```json
{
  "name": "@superbuilder/feature-blog",
  "version": "1.0.0",
  "exports": {
    ".":           "./src/server/index.ts",
    "./client":    "./src/client/index.ts",
    "./admin":     "./src/admin/index.ts",
    "./schema":    "./src/schema/index.ts",
    "./dto":       "./src/dto/index.ts",
    "./common":    "./src/common/types.ts"
  },
  "scripts": {
    "dev": "concurrently \"bun dev:server\" \"bun dev:ui\"",
    "dev:server": "bun run dev/server.ts",
    "dev:ui": "vite --config dev/vite.config.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Widget Feature 패턴

Widget feature는 `client` 대신 `widget` 엔트리포인트를 사용:

```
features/comment/
├── src/
│   ├── server/
│   ├── widget/                 # client 대신 widget
│   │   ├── comment-section.tsx # Connected Component
│   │   ├── components/
│   │   └── index.ts
│   ├── schema/
│   └── common/
```

```json
{
  "name": "@superbuilder/feature-comment",
  "exports": {
    ".":           "./src/server/index.ts",
    "./widget":    "./src/widget/index.ts",
    "./schema":    "./src/schema/index.ts"
  }
}
```

---

## 4. Feature Manifest (`feature.json`)

Backstage의 `createPlugin()` 대응. 각 feature가 자기 자신을 선언한다.

### 설계 원칙: `provides`만 선언, `connections`는 자동 도출

Feature 작성자는 **구조화된 `provides` 필드만 관리**한다. Scaffold Engine이 `provides` + `IMPORT_MAP`을 조합하여 각 extension point에 삽입할 코드(connections)를 scaffold 시점에 자동 생성한다. 이로써:

- Feature 작성자가 raw import 문자열을 수동 관리할 필요 없음
- Template의 import 컨벤션이 변경되어도 `feature.json`을 일일이 수정할 필요 없음
- `provides`와 중복되는 `connections` 데이터를 유지할 필요 없음

### Page Feature 예시

```jsonc
// features/blog/feature.json
{
  "id": "blog",
  "name": "블로그",
  "version": "1.0.0",
  "type": "page",
  "group": "content",
  "icon": "FileText",

  "dependencies": ["comment", "reaction"],
  "optionalDependencies": [],

  "provides": {
    "server": {
      "module": "BlogModule",
      "router": "blogRouter",
      "routerKey": "blog"
    },
    "client": {
      "routes": "createBlogRoutes"
    },
    "admin": {
      "routes": "createBlogAdminRoutes",
      "menu": {
        "label": "블로그",
        "icon": "FileText",
        "order": 10
      }
    },
    "schema": {
      "tables": ["blog_posts", "blog_categories", "blog_tags"]
    }
  }
}
```

### Widget Feature 예시

```jsonc
// features/comment/feature.json
{
  "id": "comment",
  "name": "댓글",
  "version": "1.0.0",
  "type": "widget",
  "group": "content",
  "icon": "MessageSquare",

  "dependencies": [],

  "provides": {
    "server": {
      "module": "CommentModule",
      "router": "commentRouter",
      "routerKey": "comment"
    },
    "widget": {
      "component": "CommentSection",
      "props": ["targetType", "targetId"]
    },
    "schema": {
      "tables": ["comments"]
    }
  }
}
```

### Connection 자동 도출 로직

Scaffold Engine이 `provides`를 읽어서 target 네임스페이스의 코드 조각을 생성한다:

```typescript
function deriveConnections(featureId: string, provides: Provides): DerivedConnections {
  const connections: DerivedConnections = {};

  if (provides.server) {
    const { module: mod, router, routerKey } = provides.server;
    connections.nestModule = `import { ${mod} } from "@repo/features/${featureId}";`;
    connections.trpcRouter = `import { ${router} } from "@repo/features/${featureId}";`;
    connections.trpcKey = `${routerKey}: ${router},`;
  }

  if (provides.client) {
    connections.appRoutes = `import { ${provides.client.routes} } from "@features/${featureId}";`;
    connections.appRoutesSpread = `...${provides.client.routes}(rootRoute),`;
  }

  if (provides.admin) {
    connections.adminRoutes = `import { ${provides.admin.routes} } from "./features/${featureId}";`;
    connections.adminRoutesSpread = `...${provides.admin.routes}(adminLayoutRoute),`;
    if (provides.admin.menu) {
      connections.adminMenu = JSON.stringify(provides.admin.menu);
    }
  }

  if (provides.schema) {
    connections.schemaExport = `export * from "./features/${featureId}";`;
    connections.tablesFilter = provides.schema.tables.map(t => `"${t}"`).join(", ");
  }

  if (provides.widget) {
    connections.widgetExport = { subpath: `./${featureId}`, entry: `./src/${featureId}/index.ts` };
  }

  return connections;
}
```

> **핵심**: `connections`의 모든 문자열은 **target 프로젝트 네임스페이스** (`@repo/features/*`, `@features/*` 등)로 생성된다. Feature 소스 코드의 `@superbuilder/core-*` import와는 별개이며, import 변환 대상이 아니다.

### Registry 자동 생성

`feature.json` 스캔으로 통합 registry를 자동 구성. 수동 관리 불필요.

```typescript
// engine에서
const registry = await scanFeatures("features/");
// features/*/feature.json을 읽어서 FeatureRegistry 반환
```

---

## 5. Extension Points & Core Contract

### Core Contract

Feature가 의존할 수 있는 보장된 인터페이스. Feature는 boilerplate의 구체 구현을 모르고 Core Contract만 의존한다.

```
Feature (blog)
    │
    ├── depends on ──→ Core Contract (인터페이스)
    │                      ├── Auth     — 인증된 사용자 정보
    │                      ├── DB       — Drizzle DB 인스턴스
    │                      ├── tRPC     — procedure 빌더
    │                      ├── Schema   — profiles, files 등 공통 테이블
    │                      ├── Logger   — 구조화 로깅
    │                      └── UI       — shadcn 컴포넌트, Feature/FeatureHeader
    │
    └── does NOT depend on ──→ Template (apps/app, apps/server 구체 코드)
```

### Core Packages

Feature 소스 코드 내에서 사용하는 import 경로는 scoped 패키지명을 사용한다.

| Package | Import 경로 | 제공하는 것 | Feature에서의 사용 |
|---------|-----------|-----------|-------------------|
| `@superbuilder/core-auth` | `@superbuilder/core-auth` | `authenticatedAtom`, `profileAtom`, Guards | 인증 상태, 권한 체크 |
| `@superbuilder/core-trpc` | `@superbuilder/core-trpc` | `publicProcedure`, `protectedProcedure`, `adminProcedure` | tRPC 라우터 정의 |
| `@superbuilder/core-db` | `@superbuilder/core-db` | `InjectDrizzle`, `DrizzleDB` 타입 | Service에서 DB 접근 |
| `@superbuilder/core-schema` | `@superbuilder/core-schema` | `profiles`, `files` 테이블 | FK 참조, relations |
| `@superbuilder/core-logger` | `@superbuilder/core-logger` | `createLogger()` | 구조화 로깅 |
| `@superbuilder/core-ui` | `@superbuilder/core-ui` | `Feature`, `FeatureHeader`, shadcn 컴포넌트 | UI 렌더링 |

> **왜 scoped 패키지명인가?** `@core/*` 같은 bare namespace는 다른 패키지와 충돌 가능성이 높고, bun workspace에서 해상도를 설정하기 어렵다. `@superbuilder/core-*` scoped name은 npm 호환이고 workspace에서 자연스럽게 해결된다.

### Core Contract 패키지 위치 및 워크스페이스 설정

```
superbuilder-features/
├── package.json                   # workspace root
├── core/
│   ├── auth/
│   │   └── package.json           # { "name": "@superbuilder/core-auth" }
│   ├── trpc/
│   │   └── package.json           # { "name": "@superbuilder/core-trpc" }
│   ├── db/
│   │   └── package.json           # { "name": "@superbuilder/core-db" }
│   ├── schema/
│   │   └── package.json           # { "name": "@superbuilder/core-schema" }
│   ├── logger/
│   │   └── package.json           # { "name": "@superbuilder/core-logger" }
│   └── ui/
│       └── package.json           # { "name": "@superbuilder/core-ui" }
├── features/
│   └── ...
```

```jsonc
// superbuilder-features/package.json
{
  "private": true,
  "workspaces": [
    "core/*",
    "dev-kit",
    "features/*"
  ]
}
```

### Extension Points

Template이 feature 코드를 받아들이는 지점. `[ATLAS:*]` 마커로 구현.

| Extension Point | Marker | 대상 파일 | 삽입 메커니즘 |
|----------------|--------|----------|-------------|
| Server Module Registration | `[ATLAS:MODULES]` | `apps/server/src/app.module.ts` | 코드 마커 삽입 |
| tRPC Router Registration | `[ATLAS:ROUTERS]` | `apps/server/src/trpc/router.ts` | 코드 마커 삽입 |
| Client Route Registration | `[ATLAS:ROUTES]` | `apps/app/src/router.tsx` | 코드 마커 삽입 |
| Admin Route Registration | `[ATLAS:ADMIN_ROUTES]` | `apps/system-admin/src/router.tsx` | 코드 마커 삽입 |
| Admin Menu Registration | `[ATLAS:ADMIN_MENUS]` | `apps/system-admin/src/feature-config.ts` | 코드 마커 삽입 |
| Schema Export Registration | `[ATLAS:SCHEMAS]` | `packages/drizzle/src/schema/index.ts` | 코드 마커 삽입 |
| Schema Tables Filter | `[ATLAS:TABLES]` | `packages/drizzle/drizzle.config.ts` | 코드 마커 삽입 |
| Widget Export Registration | `[ATLAS:WIDGET_EXPORTS]` | `packages/widgets/package.json` | **JSON 조작** (아래 참조) |

> **Widget Export는 JSON 조작**: `packages/widgets/package.json`의 `exports` 필드에 새 subpath를 추가하는 방식. 코드 마커 삽입이 아니라 JSON 파일을 파싱하여 `exports` 객체에 키-값을 추가한다.

```typescript
// Widget export 등록 — JSON 조작 방식
async function registerWidgetExport(
  templateDir: string,
  featureId: string,
  widgetExport: { subpath: string; entry: string },
): Promise<void> {
  const pkgPath = join(templateDir, "packages/widgets/package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  pkg.exports = pkg.exports || {};
  pkg.exports[widgetExport.subpath] = widgetExport.entry;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2));
}
```

Scaffold Engine은 `provides`에서 자동 도출된 connections를 각 extension point에 삽입한다.

### Feature 간 Extension Point (Phase 2)

Feature가 다른 feature를 위한 확장 지점을 노출할 수 있다. 초기에는 `dependencies`와 수동 import로 처리하고, 시스템 안정 후 자동 바인딩을 추가한다.

```jsonc
// features/blog/feature.json
{
  "extensionPoints": {
    "blog.content-footer": {
      "description": "블로그 글 하단에 임베드되는 위치",
      "props": ["postId", "authorId"]
    }
  }
}

// features/comment/feature.json
{
  "extends": {
    "blog.content-footer": {
      "component": "CommentSection",
      "propsMapping": {
        "targetType": "'blog_post'",
        "targetId": "postId"
      }
    }
  }
}
```

---

## 6. Dev Harness (독립 실행/테스트)

Backstage의 `dev/index.ts` 패턴. Feature를 boilerplate 없이 단독 실행한다.

### 구조

```
features/blog/dev/
├── server.ts          # 최소 NestJS + mock DB
├── app.tsx            # 최소 React 앱
├── seed.ts            # mock 데이터
└── vite.config.ts     # dev UI용 vite 설정
```

### NestJS 런타임 요구사항

Feature의 server 코드는 NestJS Module/Decorator 기반이다. `superbuilder-features` 워크스페이스에서 이를 지원하기 위해:

1. **워크스페이스 root `tsconfig.json`**: `experimentalDecorators: true`, `emitDecoratorMetadata: true` 설정
2. **워크스페이스 root `package.json`**: `reflect-metadata`를 dependency로 포함
3. **`@superbuilder/dev-kit`**: NestJS core/common을 peer dependency로 선언

```jsonc
// superbuilder-features/tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

> **toolchain 참고**: Superbuilder 메인 repo는 Bun + Turbo 기반이다. `superbuilder-features` 서브모듈도 동일하게 Bun을 사용하며, NestJS는 feature server 코드와 dev harness에서만 사용된다. Bun은 decorator를 네이티브로 지원하므로 추가 빌드 도구가 필요하지 않다.

### `dev/server.ts`

```typescript
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { BlogModule } from "../src/server";
import { createMockDbModule } from "@superbuilder/dev-kit/db";
import { createMockAuthModule } from "@superbuilder/dev-kit/auth";
import { seed } from "./seed";

@Module({
  imports: [
    createMockDbModule({ seed }),   // SQLite in-memory + Drizzle
    createMockAuthModule(),         // 고정 테스트 유저
    BlogModule,
  ],
})
class DevAppModule {}

async function bootstrap() {
  const app = await NestFactory.create(DevAppModule);
  await app.listen(4000);
  console.log("Blog feature dev server: http://localhost:4000");
}
bootstrap();
```

### `dev/app.tsx`

```tsx
import { createRoot } from "react-dom/client";
import { createBlogRoutes } from "../src/client";
import { DevShell } from "@superbuilder/dev-kit/ui";

createRoot(document.getElementById("root")!).render(
  <DevShell
    apiUrl="http://localhost:4000"
    routes={(root) => createBlogRoutes(root)}
    mockUser={{ id: "dev-user", name: "Developer", role: "admin" }}
  />
);
```

### `@superbuilder/dev-kit`

공유 dev 도구 패키지:

```
superbuilder-features/
├── dev-kit/
│   ├── package.json            # @superbuilder/dev-kit
│   ├── db/
│   │   ├── mock-db-module.ts   # SQLite in-memory + Drizzle
│   │   └── mock-db.ts          # createMockDb()
│   ├── auth/
│   │   ├── mock-auth-module.ts # NestJS mock auth module
│   │   └── mock-user.ts        # TEST_USER 상수
│   ├── ui/
│   │   ├── dev-shell.tsx       # 최소 React shell (providers)
│   │   └── dev-layout.tsx      # Feature + FeatureHeader 포함 레이아웃
│   └── trpc/
│       └── mock-trpc.ts        # dev용 tRPC client 설정
```

### 테스트 전략

| 레벨 | 도구 | DB | 범위 |
|------|------|-----|------|
| Unit (Service) | Vitest | mock DB (in-memory SQLite) | Service 메서드 단위 |
| API (tRPC/REST) | Vitest + supertest | mock DB | 엔드포인트 단위 |
| UI (Component) | Vitest + Testing Library | mock tRPC | 컴포넌트 렌더링 |
| Integration | scaffold 후 통합 | 실제 Neon branch | 전체 앱에서 feature 동작 |

### 실행 커맨드

```bash
cd features/blog
bun dev           # 서버(4000) + UI(4001) 동시 실행
bun test          # 단위 테스트
```

---

## 7. Scaffold Engine 연동

기존 Composer 스펙의 Scaffold Engine이 새 feature 구조와 연동되는 방식.

### 변경점 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|--------|
| Feature 소스 | boilerplate 내 분산 | `superbuilder-features/features/` 통합 |
| Registry | `registry/features.json` 수동 | `feature.json` 스캔 자동 |
| Path mapping | `superbuilder.json`에 하드코딩 | `feature.json > provides`에서 자동 도출 |
| Connection 정보 | `superbuilder.json > connections` 배열 | `feature.json > provides`에서 자동 도출 |

### Scaffold 흐름

```
1. Registry 자동 생성
   features/*/feature.json 스캔 → FeatureRegistry 구성

2. Resolve
   선택된 features → 의존성 해결 → 토폴로지 정렬 (기존과 동일)

3. Template Clone
   superbuilder-app-template clone → 빈 셸

4. Feature 설치
   각 feature에 대해:
   ├── feature.json 읽기
   ├── provides에서 connections 자동 도출 (deriveConnections)
   ├── src/server/  → template의 packages/features/{name}/
   ├── src/client/  → template의 apps/app/src/features/{name}/
   ├── src/admin/   → template의 apps/system-admin/src/features/{name}/
   ├── src/schema/  → template의 packages/drizzle/src/schema/features/{name}/
   ├── src/widget/  → template의 packages/widgets/src/{name}/
   ├── src/dto/     → template의 packages/features/{name}/dto/
   ├── 코드 마커 connections → [ATLAS:*] 마커에 삽입
   └── widget export → packages/widgets/package.json에 JSON 조작

5. Import 변환
   feature 소스 코드의 import 경로를 template 기준으로 변환

6. 빌드 검증 + Git commit
```

### Path Mapping 자동화

```typescript
function resolveTargetPaths(
  featureId: string,
  manifest: FeatureManifest,
  templateDir: string,
): Record<string, { src: string; dest: string }> {
  const paths: Record<string, { src: string; dest: string }> = {};

  if (manifest.provides.server) {
    paths.server = {
      src: `features/${featureId}/src/server`,
      dest: `${templateDir}/packages/features/${featureId}`,
    };
  }
  if (manifest.provides.client) {
    paths.client = {
      src: `features/${featureId}/src/client`,
      dest: `${templateDir}/apps/app/src/features/${featureId}`,
    };
  }
  if (manifest.provides.admin) {
    paths.admin = {
      src: `features/${featureId}/src/admin`,
      dest: `${templateDir}/apps/system-admin/src/features/${featureId}`,
    };
  }
  if (manifest.provides.schema) {
    paths.schema = {
      src: `features/${featureId}/src/schema`,
      dest: `${templateDir}/packages/drizzle/src/schema/features/${featureId}`,
    };
  }
  if (manifest.provides.widget) {
    paths.widget = {
      src: `features/${featureId}/src/widget`,
      dest: `${templateDir}/packages/widgets/src/${featureId}`,
    };
  }

  return paths;
}
```

### Import 변환 규칙

Feature 소스 코드는 `@superbuilder/core-*` import를 사용한다. Scaffold 시 template 내부 경로로 변환한다.

```typescript
const IMPORT_MAP = {
  // Core Contract → Template 내부 경로
  "@superbuilder/core-auth":     "@repo/core/auth",
  "@superbuilder/core-trpc":     "@repo/core/trpc",
  "@superbuilder/core-db":       "@repo/drizzle",
  "@superbuilder/core-schema":   "@repo/drizzle",
  "@superbuilder/core-logger":   "@repo/core/logger",
  "@superbuilder/core-ui":       "@repo/ui",

  // Feature 간 참조 → Template 내부 경로
  "@superbuilder/feature-{name}":          "@repo/features/{name}",
  "@superbuilder/feature-{name}/widget":   "@repo/widgets/{name}",
  "@superbuilder/feature-{name}/schema":   "@repo/drizzle",
  "@superbuilder/feature-{name}/common":   "@repo/features/{name}",
};
```

> **`@superbuilder/core-db`와 `@superbuilder/core-schema`가 동일 target(`@repo/drizzle`)으로 변환**: feature 소스에서는 의미적으로 구분하여 사용하지만, scaffold 후에는 하나의 drizzle 패키지로 통합된다. Engine은 `IMPORT_MAP`을 순서대로 적용하므로 one-to-many가 아닌 many-to-one 변환이며 문제 없음.

### Connection 삽입

`provides`에서 자동 도출된 connections를 마커에 삽입한다.

```typescript
async function applyConnections(
  templateDir: string,
  feature: FeatureManifest,
): Promise<void> {
  // provides에서 connections 자동 도출
  const connections = deriveConnections(feature.id, feature.provides);

  // 코드 마커 삽입 (TypeScript/JSON 파일)
  const markerMap = {
    nestModule:       { file: "apps/server/src/app.module.ts", marker: "MODULES" },
    trpcRouter:       { file: "apps/server/src/trpc/router.ts", marker: "IMPORTS" },
    trpcKey:          { file: "apps/server/src/trpc/router.ts", marker: "ROUTERS" },
    appRoutes:        { file: "apps/app/src/router.tsx", marker: "IMPORTS" },
    appRoutesSpread:  { file: "apps/app/src/router.tsx", marker: "ROUTES" },
    schemaExport:     { file: "packages/drizzle/src/schema/index.ts", marker: "SCHEMAS" },
    tablesFilter:     { file: "packages/drizzle/drizzle.config.ts", marker: "TABLES" },
  };

  for (const [key, { file, marker }] of Object.entries(markerMap)) {
    if (connections[key]) {
      await insertAtMarker(
        join(templateDir, file),
        marker,
        connections[key],
      );
    }
  }

  // Widget export — JSON 조작 (마커 삽입이 아님)
  if (connections.widgetExport) {
    await registerWidgetExport(templateDir, feature.id, connections.widgetExport);
  }

  // Admin menu — 별도 처리
  if (connections.adminMenu) {
    await insertAtMarker(
      join(templateDir, "apps/system-admin/src/feature-config.ts"),
      "ADMIN_MENUS",
      connections.adminMenu,
    );
  }
}
```

---

## 8. `superbuilder-features` Repo 구조

```
superbuilder-features/
├── package.json                    # workspace root (workspaces: ["core/*", "dev-kit", "features/*"])
├── tsconfig.json                   # experimentalDecorators, emitDecoratorMetadata
├── core/                           # Core Contract (각각 독립 패키지)
│   ├── auth/
│   │   └── package.json            # @superbuilder/core-auth
│   ├── trpc/
│   │   └── package.json            # @superbuilder/core-trpc
│   ├── db/
│   │   └── package.json            # @superbuilder/core-db
│   ├── schema/
│   │   └── package.json            # @superbuilder/core-schema
│   ├── logger/
│   │   └── package.json            # @superbuilder/core-logger
│   └── ui/
│       └── package.json            # @superbuilder/core-ui
├── dev-kit/                        # 공유 dev 도구
│   ├── package.json                # @superbuilder/dev-kit
│   ├── db/                         # mock DB (in-memory SQLite)
│   ├── auth/                       # mock auth
│   ├── ui/                         # DevShell
│   └── trpc/                       # mock tRPC client
├── features/                       # 개별 feature 패키지들
│   ├── blog/
│   │   ├── package.json            # @superbuilder/feature-blog
│   │   ├── feature.json
│   │   ├── dev/
│   │   ├── src/
│   │   └── tests/
│   ├── comment/
│   │   ├── package.json            # @superbuilder/feature-comment
│   │   ├── feature.json
│   │   ├── dev/
│   │   ├── src/
│   │   └── tests/
│   ├── community/
│   ├── board/
│   ├── payment/
│   ├── booking/
│   ├── profile/
│   ├── reaction/
│   ├── review/
│   ├── bookmark/
│   ├── notification/
│   ├── file-manager/
│   ├── hello-world/
│   └── ... (30개+)
└── README.md
```

---

## 9. Migration 전략

### Phase 0: 인프라 준비

| 작업 | 설명 |
|------|------|
| `superbuilder-features` repo 생성 | `BBrightcode-atlas/superbuilder-features` |
| Superbuilder에 submodule 연결 | `git submodule add ... features/` |
| Turborepo workspace 설정 | root `package.json`에 `features/*` 워크스페이스 추가 |
| `core/` 패키지 구성 | boilerplate의 `packages/core` 기반 Core Contract 인터페이스 추출 — 각 도메인별 scoped 패키지 (`@superbuilder/core-*`) |
| `dev-kit/` 패키지 생성 | mock DB, mock auth, DevShell 등 공유 dev 도구 |
| CI 설정 | submodule checkout (`--recursive`), feature 빌드/테스트 파이프라인 |

### Phase 1: 파일럿 (hello-world)

가장 단순한 feature로 전체 파이프라인 검증:

```
boilerplate에서 수집:
├── packages/features/hello-world/              → features/hello-world/src/server/
├── apps/app/src/features/hello-world/          → features/hello-world/src/client/
├── apps/system-admin/src/features/hello-world/ → features/hello-world/src/admin/
├── packages/drizzle/src/schema/features/hello-world/ → features/hello-world/src/schema/

새로 작성:
├── features/hello-world/feature.json
├── features/hello-world/package.json
├── features/hello-world/dev/
└── features/hello-world/tests/
```

검증:
- `bun dev` — feature 단독 실행
- `bun test` — 단위 테스트 통과
- Scaffold Engine으로 빈 template에 설치 → 빌드 통과 (`bun run typecheck && bun run build`)
- Import 변환 정상 동작
- Connection 자동 도출 검증 — `provides` → 마커 삽입 코드 정확성

### Phase 2: Core + Widget feature

의존성 없거나 다른 feature가 많이 의존하는 것부터:

```
1. profile        ← 거의 모든 feature가 의존
2. comment        ← widget, 독립적
3. reaction       ← widget, 독립적
4. bookmark       ← widget, 독립적
5. review         ← widget, 독립적
6. file-manager   ← widget, 독립적
7. notification   ← widget, 독립적
```

### Phase 3: Page feature

의존성이 해결된 순서대로:

```
8. blog           ← depends: comment, reaction
9. board          ← depends: comment, reaction
10. community     ← depends: comment, reaction
11. booking
12. payment
13. course
14. content-studio
15. story-studio
... 나머지
```

### Phase 4: Boilerplate 정리 + Scaffold Engine 전환

모든 feature 마이그레이션 완료 후, **단일 조율된 커밋**으로 다음을 동시에 수행:

1. **Scaffold Engine 소스 경로 전환**: `DEFAULT_PATH_MAPPING`을 boilerplate 내부 경로에서 `superbuilder-features/features/*/src/*`로 변경
2. **Boilerplate에서 feature 코드 제거**: feature 디렉토리를 비우고 마커만 남김
3. **Connection 도출 방식 전환**: `superbuilder.json > connections` 참조 → `feature.json > provides` 자동 도출

```
superbuilder-app-template/ (마이그레이션 완료 후)
├── apps/
│   ├── app/src/
│   │   ├── features/           # 빈 디렉토리
│   │   ├── router.tsx          # [ATLAS:*] 마커만 남음
│   │   └── ...
│   ├── server/src/
│   │   ├── app.module.ts       # [ATLAS:*] 마커만 남음
│   │   ├── trpc/router.ts      # [ATLAS:*] 마커만 남음
│   │   └── ...
│   └── system-admin/src/
│       ├── features/           # 빈 디렉토리
│       └── ...
├── packages/
│   ├── features/               # 빈 (app-router.ts + 마커만)
│   ├── drizzle/src/schema/
│   │   ├── core/               # profiles, files 등 유지
│   │   └── features/           # 빈 디렉토리
│   ├── widgets/src/            # 빈 디렉토리
│   ├── core/                   # Core Contract 구현 유지
│   └── ui/                     # 유지
└── superbuilder.json           # feature 목록 비어있음
```

> **검증 기준**: Phase 4 커밋 전에, `superbuilder-features`의 모든 feature를 빈 template에 scaffold → `bun run typecheck && bun run build && bun test` 통과를 확인한다. 실패 시 롤백.

### Feature 마이그레이션 체크리스트 (각 feature마다)

```
□ boilerplate에서 소스 수집 (server + client + admin + schema + widget)
□ features/{name}/src/ 디렉토리 구조로 통합
□ feature.json 작성 (provides 필드만 — connections 자동 도출)
□ package.json 작성 (멀티 엔트리포인트)
□ import 경로를 @superbuilder/core-* 기준으로 변환
□ dev/server.ts + dev/app.tsx 작성
□ bun dev — 독립 실행 확인
□ tests/ 작성 (기존 테스트 이동 + 보완)
□ bun test — 테스트 통과
□ Scaffold Engine으로 빈 template에 설치 → 빌드 확인
□ boilerplate에서 해당 feature 코드 제거
□ superbuilder-features repo에 커밋
```

### 리스크 관리

| 리스크 | 대응 |
|--------|------|
| 마이그레이션 중 boilerplate가 깨짐 | Feature 제거는 scaffold 설치 검증 후에만 실행. 검증 = typecheck + build + test 통과 |
| Feature 간 숨은 의존성 | `feature.json` 작성 시 실제 import 분석으로 dependencies 도출 |
| Core contract와 boilerplate core 불일치 | Phase 0에서 인터페이스 먼저 확정, 구현은 boilerplate core를 복사 |
| 30개 feature 마이그레이션 공수 | 파일럿으로 자동화 스크립트 만들고 나머지 반복 적용 |
| Scaffold Engine 경로 전환 타이밍 | Phase 4에서 단일 조율 커밋으로 경로 전환 + feature 제거 동시 수행 |

---

## 10. 향후 확장

### Feature Eject (하이브리드 모드)

생성된 앱에서 특정 feature를 커스터마이징해야 할 때:

```bash
# 패키지 의존성 → 소스 코드로 전환
superbuilder eject blog
```

- `node_modules/@superbuilder/feature-blog/` 내용을 프로젝트 내부로 복사
- `package.json`에서 의존성 제거
- import 경로를 로컬 경로로 변환

### Feature 업데이트

superbuilder-features에서 feature가 업데이트되면:

- 패키지 의존성 모드: 버전만 올리면 됨
- Eject된 feature: diff 기반 업데이트 워크플로우 생성 → 에이전트가 적용

### Feature 간 Extension Point 자동 바인딩

Phase 2에서 `extensionPoints` + `extends` 기반 자동 바인딩 구현. Scaffold 시 feature 간 확장 지점을 자동으로 연결.

### Feature 독립 repo 졸업

완성되어 안정된 feature를 독립 repo로 분리:

- `superbuilder-features/features/blog/` → `BBrightcode-atlas/feature-blog`
- `superbuilder-features`에서 제거
- npm registry에 publish → 패키지 의존성으로 설치

---

## 부록: 기존 Composer 스펙과의 관계

| 기존 스펙 항목 | 이 설계에서의 상태 |
|--------------|-----------------|
| Scaffold Engine | 유지, path mapping 자동화 + connection 자동 도출로 개선 |
| Template Repo (`superbuilder-app-template`) | 빈 셸로 전환하여 대체. 이름 통일 |
| ProjectSpec (superbuilder.json) | 유지, feature 메타는 feature.json으로 이동 |
| FeatureRegistry (registry/features.json) | `feature.json` 자동 스캔으로 대체 |
| Resolver | 유지 (의존성 해결, 토폴로지 정렬) |
| CLI Agent 설치 워크플로우 | 유지, feature.json 기반으로 생성 |
| Composer UI | 유지, registry 소스만 변경 |
| Import 변환 | 유지, `@superbuilder/core-*` → `@repo/*` 변환 규칙으로 업데이트 |
| Deploy Pipeline (Neon/Vercel) | 유지, 변경 없음 |
