# [ATLAS:*] 마커 레퍼런스

## 개요

`[ATLAS:*]` 마커는 boilerplate 템플릿 파일에 삽입된 주석 블록으로, scaffold 시 feature의 connection 코드가 주입되는 지점을 정의한다. atlas-engine의 `insertAtMarker()` 함수가 닫는 태그 직전에 코드를 삽입하고, `removeFromMarkerBlock()` 함수가 정확한 매칭으로 해당 줄을 삭제한다.

---

## 마커 문법 규칙

### 기본 구조

```typescript
// [ATLAS:MARKER_NAME]
// 여기에 feature 코드가 삽입된다
import { BlogModule } from "@repo/features/blog";
import { CommentModule } from "@repo/features/comment";
// [/ATLAS:MARKER_NAME]
```

- **여는 태그**: `// [ATLAS:{MARKER_NAME}]`
- **닫는 태그**: `// [/ATLAS:{MARKER_NAME}]`
- 태그는 반드시 주석(`//`)으로 시작한다
- 마커 이름은 `UPPER_SNAKE_CASE`

### 삽입 규칙

1. **삽입 위치**: 닫는 태그 `[/ATLAS:...]` 바로 **앞 줄**에 삽입
2. **들여쓰기 보존**: 닫는 태그의 들여쓰기를 감지하여 동일한 indent를 적용
3. **멱등성 (Idempotency)**: 동일한 코드를 중복 삽입하지 않도록 호출 측에서 관리. `insertAtMarker()` 자체는 중복 체크를 하지 않으므로, 등록 전 기존 내용 확인 필요
4. **마커 미존재 시**: 해당 파일에 마커가 없으면 아무 작업도 하지 않음 (silent skip)

### 제거 규칙

1. **정확한 매칭**: `trim()` 후 정확히 일치하는 줄만 제거
2. **마커 블록 내부 탐색**: 여는 태그와 닫는 태그 사이에서만 검색
3. **마커 미존재 시**: 파일 전체에서 해당 줄을 검색하여 제거 (fallback)

---

## 전체 마커 목록

### 서버 — NestJS 모듈

#### `apps/atlas-server/src/app.module.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `IMPORTS` | NestJS 모듈 import 문 | `import { BlogModule } from "@repo/features/blog";` |
| `MODULES` | NestJS `@Module({ imports: [...] })` 배열 | `BlogModule,` |

```typescript
// app.module.ts
// [ATLAS:IMPORTS]
import { BlogModule } from "@repo/features/blog";
import { CommentModule } from "@repo/features/comment";
// [/ATLAS:IMPORTS]

@Module({
  imports: [
    // [ATLAS:MODULES]
    BlogModule,
    CommentModule,
    // [/ATLAS:MODULES]
  ],
})
export class AppModule {}
```

### 서버 — tRPC 라우터

#### `apps/atlas-server/src/trpc/router.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `IMPORTS` | tRPC 라우터 import 문 | `import { blogRouter } from "@repo/features/blog";` |
| `ROUTERS` | tRPC 라우터 키 등록 | `blog: blogRouter,` |

```typescript
// router.ts
// [ATLAS:IMPORTS]
import { blogRouter } from "@repo/features/blog";
// [/ATLAS:IMPORTS]

const appRouter = router({
  // [ATLAS:ROUTERS]
  blog: blogRouter,
  // [/ATLAS:ROUTERS]
});
```

### 서버 — tRPC 타입 정의

#### `packages/features/app-router.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `IMPORTS` | 타입 전용 import (클라이언트에서 사용) | `import type { blogRouter } from "./blog";` |
| `ROUTERS` | 타입 전용 라우터 키 | `blog: typeof blogRouter;` |

```typescript
// app-router.ts
// [ATLAS:IMPORTS]
import type { blogRouter } from "./blog";
// [/ATLAS:IMPORTS]

export interface AppRouter {
  // [ATLAS:ROUTERS]
  blog: typeof blogRouter;
  // [/ATLAS:ROUTERS]
}
```

### 클라이언트 — 앱 라우터

#### `apps/app/src/router.tsx`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `IMPORTS` | 클라이언트 라우트 팩토리 import | `import { createBlogRoutes } from "@features/blog";` |
| `ROUTES` | 라우트 등록 (spread) | `...createBlogRoutes(),` |

```tsx
// router.tsx
// [ATLAS:IMPORTS]
import { createBlogRoutes } from "@features/blog";
// [/ATLAS:IMPORTS]

const routes = [
  // [ATLAS:ROUTES]
  ...createBlogRoutes(),
  // [/ATLAS:ROUTES]
];
```

### 클라이언트 — 관리자 라우터

#### `apps/system-admin/src/router.tsx`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `IMPORTS` | 어드민 라우트 팩토리 import | `import { createBlogAdminRoutes } from "./features/blog";` |
| `ADMIN_ROUTES` | 어드민 라우트 등록 (spread) | `...createBlogAdminRoutes(),` |

```tsx
// system-admin/router.tsx
// [ATLAS:IMPORTS]
import { createBlogAdminRoutes } from "./features/blog";
// [/ATLAS:IMPORTS]

const adminRoutes = [
  // [ATLAS:ADMIN_ROUTES]
  ...createBlogAdminRoutes(),
  // [/ATLAS:ADMIN_ROUTES]
];
```

### 스키마 — Drizzle ORM

#### `packages/drizzle/src/schema/index.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `SCHEMA_EXPORTS` (또는 `SCHEMAS`) | 스키마 re-export | `export * from "./features/blog";` |

```typescript
// schema/index.ts
// [ATLAS:SCHEMA_EXPORTS]
export * from "./features/blog";
export * from "./features/comment";
// [/ATLAS:SCHEMA_EXPORTS]
```

#### `packages/drizzle/src/schema-registry.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `SCHEMA_IMPORTS` | 스키마 네임스페이스 import | `import * as blog from "./schema/features/blog";` |
| `SCHEMA_SPREAD` | 스키마 객체 spread | `...blog,` |

```typescript
// schema-registry.ts
// [ATLAS:SCHEMA_IMPORTS]
import * as blog from "./schema/features/blog";
// [/ATLAS:SCHEMA_IMPORTS]

export const schemaRegistry = {
  // [ATLAS:SCHEMA_SPREAD]
  ...blog,
  // [/ATLAS:SCHEMA_SPREAD]
};
```

### 스키마 — Drizzle 설정

#### `drizzle.config.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `TABLES` | 테이블 필터 목록 | `"blog_posts", "blog_categories",` |

```typescript
// drizzle.config.ts
export default defineConfig({
  tablesFilter: [
    // [ATLAS:TABLES]
    "blog_posts", "blog_categories",
    "comment_comments",
    // [/ATLAS:TABLES]
  ],
});
```

### 국제화 (i18n)

#### `apps/app/src/lib/feature-i18n.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `LOCALES_IMPORTS` | 로케일 파일 import | `import * as blogLocales from "../features/blog/locales";` |
| `LOCALES_KO` | 한국어 로케일 등록 | `blog: blogLocales.ko,` |
| `LOCALES_EN` | 영어 로케일 등록 | `blog: blogLocales.en,` |

```typescript
// feature-i18n.ts
// [ATLAS:LOCALES_IMPORTS]
import * as blogLocales from "../features/blog/locales";
// [/ATLAS:LOCALES_IMPORTS]

export const featureLocales = {
  ko: {
    // [ATLAS:LOCALES_KO]
    blog: blogLocales.ko,
    // [/ATLAS:LOCALES_KO]
  },
  en: {
    // [ATLAS:LOCALES_EN]
    blog: blogLocales.en,
    // [/ATLAS:LOCALES_EN]
  },
};
```

### 관리자 — 사이드바 메뉴

#### `apps/system-admin/src/feature-config.ts`

| 마커 | 용도 | 삽입 예시 |
|------|------|----------|
| `FEATURE_MENUS` | 사이드바 메뉴 JSON 객체 | `{"id":"blog","label":"블로그","icon":"FileText","order":1,"path":"/blog"},` |

```typescript
// feature-config.ts
export const featureMenus = [
  // [ATLAS:FEATURE_MENUS]
  {"id":"blog","label":"블로그","icon":"FileText","order":1,"path":"/blog"},
  // [/ATLAS:FEATURE_MENUS]
];
```

---

## 마커-Connection 매핑 요약

`apply-connections.ts`의 `MARKER_MAP`이 `DerivedConnections` 필드를 파일+마커에 매핑한다.

| DerivedConnections 필드 | 파일 | 마커 |
|------------------------|------|------|
| `nestModuleImport` | `apps/atlas-server/src/app.module.ts` | `IMPORTS` |
| `nestModuleRef` | `apps/atlas-server/src/app.module.ts` | `MODULES` |
| `trpcRouterImport` | `apps/atlas-server/src/trpc/router.ts` | `IMPORTS` |
| `trpcRouterKey` | `apps/atlas-server/src/trpc/router.ts` | `ROUTERS` |
| `trpcTypeImport` | `packages/features/app-router.ts` | `IMPORTS` |
| `trpcTypeKey` | `packages/features/app-router.ts` | `ROUTERS` |
| `clientRoutesImport` | `apps/app/src/router.tsx` | `IMPORTS` |
| `clientRoutesSpread` | `apps/app/src/router.tsx` | `ROUTES` |
| `adminRoutesImport` | `apps/system-admin/src/router.tsx` | `IMPORTS` |
| `adminRoutesSpread` | `apps/system-admin/src/router.tsx` | `ADMIN_ROUTES` |
| `schemaExport` | `packages/drizzle/src/schema/index.ts` | `SCHEMA_EXPORTS` |

`widgetExport`는 별도로 `registerWidgetExport()`를 통해 `packages/widgets/package.json`의 `exports` 필드에 subpath를 등록한다.

---

## 주의사항

1. **마커 태그를 직접 수정하지 말 것** — 마커 블록의 여는/닫는 태그는 atlas-engine이 파싱하는 기준점이므로, 태그 자체를 수정하면 삽입/제거가 실패한다.
2. **블록 내 수동 편집 주의** — 마커 블록 내부에 직접 코드를 추가하면 feature 제거 시 함께 삭제될 수 있다. feature와 무관한 코드는 마커 블록 외부에 배치한다.
3. **같은 파일에 같은 이름의 마커 금지** — 동일 파일 내에 같은 마커 이름이 중복되면 `indexOf()`가 첫 번째만 찾으므로 의도치 않은 동작이 발생한다.
4. **주석 스타일** — 현재는 `//` 스타일 주석만 지원한다. `/* */`, `{/* */}` (JSX) 등은 지원하지 않는다.
