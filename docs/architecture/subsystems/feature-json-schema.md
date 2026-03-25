# feature.json 스키마 레퍼런스

## 개요

`feature.json`은 각 feature 패키지의 루트에 위치하는 **self-describing manifest** 파일이다. feature가 무엇을 제공하는지(provides), 무엇에 의존하는지(dependencies)를 선언하며, atlas-engine의 scanner가 이 파일을 읽어 `FeatureManifest`를 생성한다.

위치: `superbuilder-features/features/{feature-id}/feature.json`

---

## 전체 스키마

```typescript
interface FeatureManifest {
  /** Feature 고유 식별자 (kebab-case). 디렉토리명과 일치해야 한다 */
  id: string;

  /** 표시용 이름 */
  name: string;

  /** 시맨틱 버전 */
  version: string;

  /** Feature 타입 */
  type: "page" | "widget" | "agent";

  /** Feature 그룹 */
  group: "core" | "content" | "commerce" | "community" | "system" | "template";

  /** 아이콘 이름 (Lucide 아이콘) */
  icon: string;

  /** Feature 설명 */
  description?: string;

  /** 필수 의존성 feature id 목록 */
  dependencies: string[];

  /** 선택적 의존성 feature id 목록 */
  optionalDependencies?: string[];

  /** Feature가 extension point에 제공하는 것들 */
  provides: Provides;
}

interface Provides {
  /** 서버 측 제공물 (NestJS 모듈, tRPC 라우터) */
  server?: ServerProvides;

  /** 클라이언트 측 제공물 (라우트) */
  client?: ClientProvides;

  /** 관리자 측 제공물 (라우트, 메뉴) */
  admin?: AdminProvides;

  /** 스키마 제공물 (DB 테이블) */
  schema?: SchemaProvides;

  /** 위젯 제공물 (재사용 가능한 UI 컴포넌트) */
  widget?: WidgetProvides;
}

interface ServerProvides {
  /** NestJS Module 클래스 이름 (예: "BlogModule") */
  module: string;

  /** tRPC 라우터 변수 이름 (예: "blogRouter") */
  router: string;

  /** tRPC 머지 라우터 객체에서의 키 (예: "blog") */
  routerKey: string;
}

interface ClientProvides {
  /** 라우트 팩토리 함수 이름 (예: "createBlogRoutes") */
  routes: string;
}

interface AdminProvides {
  /** 어드민 라우트 팩토리 함수 이름 (예: "createBlogAdminRoutes") */
  routes: string;

  /** 사이드바 메뉴 설정 */
  menu?: AdminMenuConfig;
}

interface AdminMenuConfig {
  /** 메뉴 표시 라벨 */
  label: string;

  /** Lucide 아이콘 이름 */
  icon: string;

  /** 정렬 순서 (낮을수록 위에 표시) */
  order: number;
}

interface SchemaProvides {
  /** 이 feature가 관리하는 DB 테이블 이름 목록 */
  tables: string[];
}

interface WidgetProvides {
  /** 메인 컴포넌트 이름 (예: "CommentSection") */
  component: string;

  /** 위젯이 받는 props 목록 */
  props?: string[];
}
```

---

## 각 필드 설명

### 최상위 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | O | Feature 고유 식별자. kebab-case. 디렉토리명과 일치해야 한다. 예: `"blog"`, `"hello-world"` |
| `name` | `string` | O | UI에 표시되는 이름. 예: `"Blog"`, `"Hello World"` |
| `version` | `string` | O | 시맨틱 버전. 예: `"1.0.0"` |
| `type` | `FeatureType` | O | `"page"`: 독립 페이지, `"widget"`: 재사용 UI 컴포넌트, `"agent"`: AI 에이전트 |
| `group` | `FeatureGroup` | O | 카테고리 분류. UI의 그룹 필터에 사용된다 |
| `icon` | `string` | O | Lucide 아이콘 이름. 예: `"FileText"`, `"MessageSquare"` |
| `description` | `string` | X | Feature에 대한 간략한 설명 |
| `dependencies` | `string[]` | O | 이 feature가 반드시 필요로 하는 다른 feature의 id 목록. Resolver가 자동으로 포함한다 |
| `optionalDependencies` | `string[]` | X | 있으면 좋지만 없어도 동작하는 feature id 목록. 기본값: `[]` |
| `provides` | `Provides` | O | Feature가 각 extension point에 제공하는 것들 |

### `provides.server`

서버 측 코드를 boilerplate에 연결하기 위한 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| `module` | `string` | NestJS Module 클래스 이름. `app.module.ts`의 `imports` 배열에 추가된다 |
| `router` | `string` | tRPC 라우터 변수 이름. `router.ts`에서 import되어 머지 라우터에 등록된다 |
| `routerKey` | `string` | 머지 라우터 객체에서의 키. 클라이언트에서 `trpc.{routerKey}.xxx`로 접근한다 |

### `provides.client`

클라이언트 앱에 라우트를 등록하기 위한 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| `routes` | `string` | TanStack Router 라우트를 생성하는 팩토리 함수 이름. `apps/app/src/router.tsx`에서 import되어 spread된다 |

### `provides.admin`

관리자 대시보드에 라우트와 메뉴를 등록하기 위한 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| `routes` | `string` | 어드민 라우트 팩토리 함수 이름. `apps/system-admin/src/router.tsx`에서 import되어 spread된다 |
| `menu` | `AdminMenuConfig` | 사이드바 메뉴 설정. 생략하면 메뉴에 표시되지 않는다 |

### `provides.schema`

DB 스키마 관련 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| `tables` | `string[]` | 이 feature가 소유하는 DB 테이블 이름 목록. `drizzle.config.ts`의 `tablesFilter`에 추가된다 |

### `provides.widget`

Widget feature가 제공하는 재사용 UI 컴포넌트 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| `component` | `string` | 메인 위젯 컴포넌트 이름. 예: `"CommentSection"` |
| `props` | `string[]` | 위젯이 받는 props 이름 목록. 문서화 및 타입 검증에 사용 |

---

## 예시

### Page Feature 예시: blog

```json
{
  "id": "blog",
  "name": "Blog",
  "version": "1.0.0",
  "type": "page",
  "group": "content",
  "icon": "FileText",
  "description": "블로그 포스트 작성/관리 feature",
  "dependencies": [],
  "optionalDependencies": ["comment"],
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
        "order": 1
      }
    },
    "schema": {
      "tables": ["blog_posts", "blog_categories", "blog_tags"]
    }
  }
}
```

이 feature.json에서 자동 도출되는 connections:

```typescript
// app.module.ts [ATLAS:IMPORTS]
import { BlogModule } from "@repo/features/blog";
// app.module.ts [ATLAS:MODULES]
BlogModule,

// trpc/router.ts [ATLAS:IMPORTS]
import { blogRouter } from "@repo/features/blog";
// trpc/router.ts [ATLAS:ROUTERS]
blog: blogRouter,

// app-router.ts [ATLAS:IMPORTS]
import type { blogRouter } from "./blog";
// app-router.ts [ATLAS:ROUTERS]
blog: typeof blogRouter;

// apps/app/src/router.tsx [ATLAS:IMPORTS]
import { createBlogRoutes } from "@features/blog";
// apps/app/src/router.tsx [ATLAS:ROUTES]
...createBlogRoutes(),

// apps/system-admin/src/router.tsx [ATLAS:IMPORTS]
import { createBlogAdminRoutes } from "./features/blog";
// apps/system-admin/src/router.tsx [ATLAS:ADMIN_ROUTES]
...createBlogAdminRoutes(),

// apps/system-admin/src/feature-config.ts [ATLAS:FEATURE_MENUS]
{"id":"blog","label":"블로그","icon":"FileText","order":1,"path":"/blog"}

// packages/drizzle/src/schema/index.ts [ATLAS:SCHEMA_EXPORTS]
export * from "./features/blog";

// drizzle.config.ts [ATLAS:TABLES]
"blog_posts", "blog_categories", "blog_tags"
```

### Widget Feature 예시: comment

```json
{
  "id": "comment",
  "name": "Comment",
  "version": "1.0.0",
  "type": "widget",
  "group": "community",
  "icon": "MessageSquare",
  "description": "댓글 위젯. 다른 feature에 임베드 가능",
  "dependencies": [],
  "optionalDependencies": [],
  "provides": {
    "server": {
      "module": "CommentModule",
      "router": "commentRouter",
      "routerKey": "comment"
    },
    "schema": {
      "tables": ["comments", "comment_votes"]
    },
    "widget": {
      "component": "CommentSection",
      "props": ["targetType", "targetId"]
    }
  }
}
```

Widget feature의 추가 동작:
- `packages/widgets/package.json`의 `exports`에 subpath 등록: `"./comment": "./src/comment/index.ts"`
- 다른 feature에서 `@superbuilder/feature-comment/widget` (개발 시) 또는 `@repo/widgets/comment` (scaffold 후)로 import 가능

---

## provides → connections 자동 도출

`feature.json`의 `provides` 객체를 `deriveConnections()` 함수에 전달하면, 각 extension point에 삽입할 코드 스니펫이 자동 생성된다.

```
provides.server        →  nestModuleImport, nestModuleRef,
                          trpcRouterImport, trpcRouterKey,
                          trpcTypeImport, trpcTypeKey

provides.client        →  clientRoutesImport, clientRoutesSpread

provides.admin         →  adminRoutesImport, adminRoutesSpread, adminMenu

provides.schema        →  schemaExport, tablesFilter

provides.widget        →  widgetExport
```

이 도출은 **선언적**이다: feature 개발자는 "나는 BlogModule을 제공한다"고 선언하기만 하면, atlas-engine이 어떤 파일의 어떤 마커에 어떤 코드를 삽입할지 자동으로 결정한다.

---

## feature.json vs superbuilder.json (레거시)

| 항목 | feature.json (신규) | superbuilder.json (레거시) |
|------|-------------------|-------------------------|
| **위치** | 각 feature 디렉토리 | boilerplate 루트 |
| **관리 주체** | feature 개발자 | superbuilder 빌더 도구 |
| **connections** | `provides`에서 자동 도출 | 수동으로 `connections` 배열에 명시 |
| **경로 정보** | 코드에서 자동 매핑 (`path-mapping.ts`) | `paths` 객체에 명시 |
| **dependents** | Resolver가 런타임에 계산 | 수동으로 `dependents` 배열에 명시 |
| **타입** | `FeatureManifest` | `ManifestFeature` (in `BoilerplateManifest`) |
| **소스 레포** | superbuilder-features | superbuilder-app-template |

### 마이그레이션 방향

레거시 `superbuilder.json`에서 `feature.json` 기반으로 전환 중이다.

1. `superbuilder.json`의 각 feature 항목을 `feature.json`으로 변환
2. `connections` 배열을 제거하고 `provides`로 대체 (자동 도출)
3. `paths` 객체를 제거하고 `path-mapping.ts`의 규칙으로 대체
4. `dependents` 배열을 제거하고 Resolver의 런타임 역참조로 대체
5. Scanner가 `feature.json`을 직접 읽고, Adapter가 `FeatureRegistry`로 변환
