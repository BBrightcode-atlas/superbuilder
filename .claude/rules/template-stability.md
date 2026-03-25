# Template & Feature 안정성 규칙

Compose E2E 테스트에서 반복 발견된 에러 패턴. Template(superbuilder-app-template) 수정 시, Feature(superbuilder-features) 추가/수정 시 반드시 확인.

## 1. Client/Server barrel 분리 — Vite 빌드 깨짐 방지

**규칙:** `packages/core/auth/index.ts`에서 NestJS 서버 모듈을 절대 re-export하지 않는다.

```typescript
// ❌ 금지 — Vite가 postgres, @nestjs/* 등을 번들에 포함시켜 빌드 실패
export { BetterAuthGuard, CurrentUser } from "../nestjs/auth";

// ✅ 올바름 — 클라이언트 전용 export만
export { tokenAtom, authenticatedAtom, AuthGuard } from "./store";
// 서버 코드는 직접 import: import { ... } from "@repo/core/nestjs/auth"
```

**이유:** app(Vite)과 server(webpack)가 같은 `@repo/core/auth`를 import. barrel file에 서버 모듈이 있으면 Vite가 Node.js 전용 의존성(postgres, @nestjs/common 등)을 브라우저 번들에 포함하려다 실패.

**적용 시점:** `packages/core/auth/index.ts` 수정 시, 새 auth 관련 export 추가 시.

## 2. Feature controller import 경로 — `@repo/core/nestjs/auth`

**규칙:** Feature의 NestJS controller에서 auth 데코레이터를 import할 때 반드시 `@repo/core/nestjs/auth`(또는 `@superbuilder/core-nestjs-auth`)를 사용한다.

```typescript
// ❌ 금지 — Vite 빌드 깨짐 or 서버 번들에서 undefined
import { BetterAuthGuard, CurrentUser } from "@repo/core/auth";

// ✅ 올바름
import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
```

**이유:** `@repo/core/auth`는 client/server 공용 barrel. 여기서 NestJS export를 제거했으므로 서버 코드는 직접 경로를 사용해야 함.

**적용 시점:** feature controller 생성/수정 시, superbuilder-features에서 `@superbuilder/core-auth` import 사용하는 서버 코드 작성 시.

**미해결:** superbuilder-features의 기존 feature들이 `@superbuilder/core-auth`에서 NestJS 데코레이터를 import 중. scaffold 후 import-transformer가 이를 `@repo/core/nestjs/auth`로 변환하도록 매핑 추가 필요.

## 3. Template 앱 완전성 — 모든 apps/*에 빌드 설정 필수

**규칙:** `superbuilder-app-template/apps/` 하위의 모든 앱 디렉토리에는 최소한 다음이 있어야 한다:
- `package.json` (name, build script)
- `vercel.json` (buildCommand, installCommand, outputDirectory/framework)
- 빌드 가능한 최소 소스 코드

```
apps/app/       ← Vite + React (vercel.json: framework "vite", outputDirectory "dist")
apps/admin/     ← Vite + React (vercel.json: framework "vite", outputDirectory "dist")
apps/server/    ← NestJS + webpack (vercel.json: framework null, Build Output API)
apps/landing/   ← Next.js (vercel.json: framework "nextjs")
```

**이유:** compose pipeline이 4개 Vercel 프로젝트를 생성. 빈 디렉토리는 빌드 실패 → `No Output Directory named "dist" found`.

**적용 시점:** template에 새 앱 추가 시, 기존 앱 구조 변경 시.

## 4. Lockfile 동기화 — package.json 변경 후 필수

**규칙:** `package.json`을 추가하거나 의존성을 변경한 후 반드시 `pnpm install`로 lockfile을 갱신하고 함께 커밋한다.

```bash
# package.json 수정 후
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml
```

**이유:** Vercel CI 환경은 기본 `frozen-lockfile` 모드. lockfile과 package.json 불일치 시 `ERR_PNPM_OUTDATED_LOCKFILE`로 빌드 실패.

**적용 시점:** 모든 package.json 변경 시.

## 5. Better Auth 스키마 규칙

**규칙:** Better Auth Drizzle 어댑터(`usePlural: true`) 사용 시:

### 5a. 테이블 export명 = 복수형 모델명
```typescript
// ❌ schema["users"]를 찾지 못함
export const baUsers = pgTable("users", { ... });

// ✅ export명이 "users"여야 Better Auth가 schema["users"]로 찾음
export const users = pgTable("users", { ... });
```

### 5b. ID/FK 컬럼 = text 타입 (uuid 금지)
```typescript
// ❌ Better Auth가 nanoid 텍스트 ID 생성 → "invalid input syntax for type uuid"
id: uuid("id").primaryKey().defaultRandom(),

// ✅ Better Auth nanoid 호환
id: text("id").primaryKey(),
```

### 5c. jwks → jwkss 별칭 필수
```typescript
// schema-registry.ts에서
export const schema = {
  ...betterAuth,
  jwkss: betterAuth.jwks, // usePlural: "jwks" + "s" = "jwkss"
};
```

**이유:** Better Auth의 `usePlural: true`는 모델명에 "s"를 붙여 스키마를 조회. export명 불일치, 타입 불일치, 특수 케이스(jwks→jwkss) 미처리 시 500 에러.

**적용 시점:** Better Auth 스키마 수정 시, 새 Better Auth 플러그인 추가 시.

## 6. Compose Pipeline — 환경변수 타이밍

**규칙:** compose pipeline에서 app 프로젝트에 `VITE_API_URL` 등 환경변수를 추가한 후, 반드시 재배포를 트리거해야 한다. 초기 배포는 env var 없이 시작되므로 env 설정만으로는 반영되지 않는다.

**미해결:** 현재 pipeline은 env var 설정 후 재배포를 트리거하지 않음. git push가 발생하면 자연 해결되지만, compose만으로는 첫 배포에 env var가 누락됨.

**적용 시점:** compose pipeline 수정 시, Vercel 환경변수 관련 코드 변경 시.
