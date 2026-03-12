# features-server Auth: Better Auth 전환 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** features-server의 Supabase 기반 인증을 Better Auth + Neon으로 전환하고, RBAC을 Organization member role 기반으로 단순화한다.

**Architecture:** features-server 내부에 독립적인 Better Auth 인스턴스를 구성한다. 환경변수 기반으로 DB, OAuth, 세션을 설정하며, Superset 메인 `packages/auth/` 패턴을 따른다. 기존 `userRoles`/`roles` RBAC을 Better Auth `members.role`로 대체한다.

**Tech Stack:** Better Auth 1.4.x, Drizzle ORM, NestJS 11, tRPC 11, jose (JWKS 검증), @t3-oss/env-core

**설계 문서:** `docs/superpowers/specs/2026-03-12-features-server-auth-better-auth-design.md`

---

## File Structure

### 신규 파일

| 파일 | 역할 |
|------|------|
| `packages/features-server/core/auth/server.ts` | Better Auth 서버 인스턴스 |
| `packages/features-server/core/auth/client.ts` | Better Auth React 클라이언트 |
| `packages/features-server/core/auth/env.ts` | 환경변수 검증 (@t3-oss/env-core) |
| `packages/features-server/core/auth/index.ts` | Public exports |
| `packages/drizzle/src/schema/core/better-auth.ts` | Better Auth 호환 스키마 (users, sessions, accounts, organizations, members, invitations, verifications) |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `packages/drizzle/package.json` | name: `@superbuilder/drizzle` → `@superbuilder/features-db` |
| `packages/drizzle/src/schema/core/auth.ts` | Supabase `auth` 스키마 참조 제거, Better Auth 스키마로 교체 |
| `packages/drizzle/src/schema/core/profiles.ts` | Better Auth `users` 테이블로 대체 (profiles는 호환 레이어 유지) |
| `packages/drizzle/src/schema/index.ts` | better-auth export 추가 |
| `packages/features-server/core/nestjs/auth/jwt-parser.ts` | Supabase JWT 디코딩 → JWKS RS256 검증 |
| `packages/features-server/core/nestjs/auth/jwt-auth.guard.ts` | 새 jwt-parser 사용 (인터페이스 동일) |
| `packages/features-server/core/nestjs/auth/admin.guard.ts` | `userRoles`/`roles` → `members.role` 기반 |
| `packages/features-server/core/nestjs/auth/index.ts` | 새 export 추가 |
| `packages/features-server/core/trpc/trpc.ts` | User 타입 변경, context 정리 |
| `packages/features-server/core/trpc/admin-procedure.ts` | `userRoles`/`roles` → `members` 기반 |
| `packages/features-server/package.json` | better-auth 의존성 추가, name 참조 업데이트 |
| features-server 전체 `*.ts` | `@superbuilder/drizzle` → `@superbuilder/features-db` import 일괄 변경 |

---

## Chunk 1: 패키지 리네이밍 + Better Auth 스키마

### Task 1: `@superbuilder/drizzle` → `@superbuilder/features-db` 리네이밍

**Files:**
- Modify: `packages/drizzle/package.json`
- Modify: `packages/features-server/package.json`
- Modify: features-server 전체 `*.ts` 파일 (import 경로)

- [ ] **Step 1: `packages/drizzle/package.json` name 변경**

```json
{
  "name": "@superbuilder/features-db"
}
```

- [ ] **Step 2: `packages/features-server/package.json` 의존성 이름 변경**

`dependencies`에서 `@superbuilder/drizzle` → `@superbuilder/features-db`:

```json
"@superbuilder/features-db": "workspace:^"
```

- [ ] **Step 3: features-server 전체 import 일괄 변경**

모든 `*.ts` 파일에서:
- `@superbuilder/drizzle` → `@superbuilder/features-db`
- `from '@superbuilder/drizzle'` → `from '@superbuilder/features-db'`
- `from "@superbuilder/drizzle"` → `from "@superbuilder/features-db"`

대상 파일 확인 명령어:
```bash
grep -rl "@superbuilder/drizzle" packages/features-server/ --include="*.ts"
```

일괄 치환:
```bash
find packages/features-server/ -name "*.ts" -exec sed -i '' 's/@superbuilder\/drizzle/@superbuilder\/features-db/g' {} +
```

- [ ] **Step 4: packages/drizzle 내부 self-reference 확인 및 변경**

```bash
grep -r "@superbuilder/drizzle" packages/drizzle/ --include="*.ts"
```

해당 파일들도 `@superbuilder/features-db`로 변경.

- [ ] **Step 5: bun install 실행하여 workspace 링크 갱신**

```bash
bun install
```

- [ ] **Step 6: 타입 체크 확인**

```bash
cd packages/drizzle && bun run check-types
cd packages/features-server && bun run check-types
```

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor: @superbuilder/drizzle → @superbuilder/features-db 리네이밍"
```

---

### Task 2: Better Auth 스키마 추가 (features-db)

**Files:**
- Create: `packages/drizzle/src/schema/core/better-auth.ts`
- Modify: `packages/drizzle/src/schema/core/auth.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

- [ ] **Step 1: Better Auth 호환 스키마 작성**

`packages/drizzle/src/schema/core/better-auth.ts` — Superset `packages/db/src/schema/auth.ts` 패턴을 따라 public 스키마에 Better Auth 테이블 정의:

```typescript
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// ============================================================================
// Better Auth Tables (public schema)
// ============================================================================

export const baUsers = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type BaUser = typeof baUsers.$inferSelect;
export type NewBaUser = typeof baUsers.$inferInsert;

export const baSessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id"),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const baAccounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const baVerifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const baOrganizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)],
);

export type BaOrganization = typeof baOrganizations.$inferSelect;

export const baMembers = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => baOrganizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("members_organization_id_idx").on(table.organizationId),
    index("members_user_id_idx").on(table.userId),
  ],
);

export type BaMember = typeof baMembers.$inferSelect;

export const baInvitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => baOrganizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitations_organization_id_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
  ],
);

export const baJwkss = pgTable("jwkss", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
```

- [ ] **Step 2: 기존 `auth.ts` 교체**

`packages/drizzle/src/schema/core/auth.ts`를 삭제하거나, Better Auth 스키마를 re-export하는 호환 레이어로 변경:

```typescript
// packages/drizzle/src/schema/core/auth.ts
// Better Auth 호환 — 기존 코드가 `users`를 import하는 경우를 위한 re-export
export { baUsers as users } from "./better-auth";
```

- [ ] **Step 3: schema/index.ts 업데이트**

```typescript
// 기존: export * from "./core/auth";
// 변경:
export * from "./core/better-auth";
export * from "./core/auth"; // 호환 re-export
```

- [ ] **Step 4: profiles.ts 호환 처리**

기존 `profiles` 테이블을 참조하는 feature가 많으므로, 당장은 `profiles`를 유지하되 주석으로 마이그레이션 방향 표시:

```typescript
// packages/drizzle/src/schema/core/profiles.ts
// TODO: Better Auth users 테이블로 점진적 마이그레이션
// 현재는 profiles + baUsers 공존. FK 참조는 profiles.id 유지.
```

- [ ] **Step 5: 타입 체크**

```bash
cd packages/drizzle && bun run check-types
```

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: Better Auth 호환 스키마 추가 (features-db)"
```

---

## Chunk 2: Better Auth 서버 인스턴스

### Task 3: 환경변수 정의 (`core/auth/env.ts`)

**Files:**
- Create: `packages/features-server/core/auth/env.ts`

- [ ] **Step 1: env.ts 작성**

Superset `packages/auth/src/env.ts` 패턴을 따르되, features-server에 필요한 변수만:

```typescript
import path from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { config } from "dotenv";
import { z } from "zod";

config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    GH_CLIENT_ID: z.string().optional(),
    GH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
    NEXT_PUBLIC_COOKIE_DOMAIN: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: true,
});
```

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/auth/env.ts
git commit -m "feat: features-server auth 환경변수 정의"
```

---

### Task 4: Better Auth 서버 인스턴스 (`core/auth/server.ts`)

**Files:**
- Create: `packages/features-server/core/auth/server.ts`
- Modify: `packages/features-server/package.json` (의존성 추가)

- [ ] **Step 1: package.json에 better-auth 의존성 추가**

```json
{
  "dependencies": {
    "better-auth": "1.4.18",
    "@t3-oss/env-core": "^0.13.8",
    "jose": "^6.0.11"
  }
}
```

```bash
cd packages/features-server && bun add better-auth@1.4.18 @t3-oss/env-core jose
```

- [ ] **Step 2: server.ts 작성**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { jwt } from "better-auth/plugins/jwt";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@superbuilder/features-db/schema";
import { env } from "./env";

const client = postgres(env.DATABASE_URL);
const db = drizzle(client);

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (env.GH_CLIENT_ID && env.GH_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: env.GH_CLIENT_ID,
    clientSecret: env.GH_CLIENT_SECRET,
  };
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_API_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: authSchema,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // 1 day
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    crossSubDomainCookies: env.NEXT_PUBLIC_COOKIE_DOMAIN
      ? { enabled: true, domain: env.NEXT_PUBLIC_COOKIE_DOMAIN }
      : undefined,
    database: {
      generateId: false, // UUID auto-generated by DB
    },
  },
  socialProviders,
  plugins: [
    organization({
      creatorRole: "owner",
    }),
    jwt({
      jwks: {
        keyPairConfig: { alg: "RS256" },
      },
      jwt: {
        issuer: env.NEXT_PUBLIC_API_URL,
        audience: env.NEXT_PUBLIC_API_URL,
        expirationTime: "1h",
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
```

- [ ] **Step 3: 타입 체크**

```bash
cd packages/features-server && bun run check-types
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Better Auth 서버 인스턴스 구성"
```

---

### Task 5: Better Auth 클라이언트 + index.ts

**Files:**
- Create: `packages/features-server/core/auth/client.ts`
- Create: `packages/features-server/core/auth/index.ts`
- Modify: `packages/features-server/package.json` (exports 추가)

- [ ] **Step 1: client.ts 작성**

```typescript
"use client";

import type { auth } from "./server";
import {
  customSessionClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [
    organizationClient(),
    customSessionClient<typeof auth>(),
  ],
});
```

- [ ] **Step 2: index.ts 작성**

```typescript
export { auth } from "./server";
export type { Session, AuthUser } from "./server";
export { authClient } from "./client";
export { env } from "./env";
```

- [ ] **Step 3: package.json exports 추가**

```json
"./core/auth": "./core/auth/index.ts",
"./core/auth/server": "./core/auth/server.ts",
"./core/auth/client": "./core/auth/client.ts",
"./core/auth/env": "./core/auth/env.ts"
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Better Auth 클라이언트 및 exports 설정"
```

---

## Chunk 3: NestJS Auth Guard 전환

### Task 6: JWT Parser 전환 (JWKS 검증)

**Files:**
- Modify: `packages/features-server/core/nestjs/auth/jwt-parser.ts`

- [ ] **Step 1: jwt-parser.ts를 JWKS 기반으로 교체**

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

export interface JwtUser {
  id: string;
  email?: string;
  organizationIds?: string[];
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(baseUrl: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${baseUrl}/api/auth/jwks`),
    );
  }
  return jwks;
}

/**
 * Authorization 헤더에서 JWT를 추출하고 JWKS로 서명 검증.
 * Better Auth JWT 플러그인이 발급한 RS256 토큰 기준.
 */
export async function parseJwtFromHeader(
  authHeader: string | undefined,
): Promise<JwtUser | undefined> {
  if (!authHeader?.startsWith("Bearer ")) return undefined;

  const token = authHeader.slice(7);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) return undefined;

  try {
    const { payload } = await jwtVerify(token, getJwks(baseUrl), {
      issuer: baseUrl,
      audience: baseUrl,
    });

    if (payload.sub) {
      return {
        id: payload.sub,
        email: (payload as JWTPayload & { email?: string }).email,
        organizationIds: (payload as JWTPayload & { organizationIds?: string[] }).organizationIds,
      };
    }
  } catch {
    // Invalid or expired token
  }

  return undefined;
}

/**
 * Fallback: 서명 검증 없이 JWT payload만 디코딩.
 * JWKS가 사용 불가능한 환경(테스트 등)에서 사용.
 */
export function parseJwtPayloadUnsafe(
  authHeader: string | undefined,
): JwtUser | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;

  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;

    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8"),
    );

    if (payload.sub && payload.exp && payload.exp > Date.now() / 1000) {
      return { id: payload.sub, email: payload.email, organizationIds: payload.organizationIds };
    }
  } catch {
    // Invalid token
  }

  return undefined;
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/nestjs/auth/jwt-parser.ts
git commit -m "feat: JWT parser를 JWKS RS256 검증으로 전환"
```

---

### Task 7: JwtAuthGuard 업데이트

**Files:**
- Modify: `packages/features-server/core/nestjs/auth/jwt-auth.guard.ts`

- [ ] **Step 1: JwtAuthGuard를 async로 변경 (JWKS 검증이 비동기)**

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { parseJwtFromHeader } from "./jwt-parser";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await parseJwtFromHeader(request.headers.authorization);

    if (!user) {
      throw new UnauthorizedException("인증이 필요합니다.");
    }

    request.user = user;
    return true;
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/nestjs/auth/jwt-auth.guard.ts
git commit -m "feat: JwtAuthGuard async JWKS 검증 적용"
```

---

### Task 8: AdminGuard 전환 (members.role 기반)

**Files:**
- Modify: `packages/features-server/core/nestjs/auth/admin.guard.ts`

- [ ] **Step 1: AdminGuard를 Better Auth members 테이블 기반으로 변경**

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { eq, and, inArray } from "drizzle-orm";
import { DRIZZLE } from "@superbuilder/features-db";
import { baMembers } from "@superbuilder/features-db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const ADMIN_ROLES = ["owner", "admin"];

@Injectable()
export class NestAdminGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<Record<string, never>>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    try {
      const membership = await this.db
        .select({ role: baMembers.role })
        .from(baMembers)
        .where(
          and(
            eq(baMembers.userId, user.id),
            inArray(baMembers.role, ADMIN_ROLES),
          ),
        )
        .limit(1);

      if (membership.length === 0) {
        throw new ForbiddenException("관리자 권한이 필요합니다.");
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      // members 테이블 미존재 시 안전하게 거부
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    return true;
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/nestjs/auth/admin.guard.ts
git commit -m "feat: AdminGuard를 Better Auth members.role 기반으로 전환"
```

---

### Task 9: NestJS Auth index.ts 업데이트

**Files:**
- Modify: `packages/features-server/core/nestjs/auth/index.ts`

- [ ] **Step 1: index.ts 업데이트**

```typescript
export { JwtAuthGuard } from "./jwt-auth.guard";
export { NestAdminGuard } from "./admin.guard";
export { CurrentUser } from "./current-user.decorator";
export { parseJwtFromHeader, parseJwtPayloadUnsafe } from "./jwt-parser";
export type { JwtUser } from "./jwt-parser";
export type { JwtUser as User } from "./jwt-parser"; // 하위 호환
```

- [ ] **Step 2: CurrentUser 데코레이터 타입 업데이트**

`packages/features-server/core/nestjs/auth/current-user.decorator.ts`:

```typescript
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { JwtUser } from "./jwt-parser";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 3: 커밋**

```bash
git add packages/features-server/core/nestjs/auth/
git commit -m "refactor: NestJS auth exports 및 CurrentUser 타입 정리"
```

---

## Chunk 4: tRPC Context/Procedure 전환

### Task 10: tRPC User 타입 및 Context 정리

**Files:**
- Modify: `packages/features-server/core/trpc/trpc.ts`

- [ ] **Step 1: User 타입 변경, context에서 레거시 서비스 참조 제거**

```typescript
import { initTRPC, TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import { HttpException } from "@nestjs/common";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { DrizzleDB } from "@superbuilder/features-db";

/**
 * User type for authenticated requests (Better Auth JWT payload)
 */
export interface User {
  id: string;
  email?: string;
  organizationIds?: string[];
}

/**
 * Base tRPC Context type
 */
export interface BaseTRPCContext extends CreateFastifyContextOptions {
  db: DrizzleDB;
  user?: User;
}

// 이하 t, router, middleware, errorTranslator, publicProcedure,
// isAuthed, authProcedure, protectedProcedure, getAuthUserId, HTTP_TO_TRPC
// 는 기존과 동일 (변경 없음)
```

핵심 변경:
- `User.role` 제거
- `User.roleIds` 제거
- `User.organizationIds` 추가
- `BaseTRPCContext`에서 `roleService`, `permissionService`, `authService` 제거

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/trpc/trpc.ts
git commit -m "refactor: tRPC User 타입을 Better Auth JWT payload 기반으로 변경"
```

---

### Task 11: adminProcedure 전환

**Files:**
- Modify: `packages/features-server/core/trpc/admin-procedure.ts`

- [ ] **Step 1: userRoles/roles 기반 → members 기반으로 변경**

```typescript
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import { baMembers } from "@superbuilder/features-db";
import { middleware, authProcedure } from "./trpc";

const ADMIN_ROLES = ["owner", "admin"];

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "인증이 필요합니다." });
  }

  let hasAdminRole = false;

  try {
    const result = await ctx.db
      .select({ role: baMembers.role })
      .from(baMembers)
      .where(
        and(
          eq(baMembers.userId, ctx.user.id),
          inArray(baMembers.role, ADMIN_ROLES),
        ),
      )
      .limit(1);

    hasAdminRole = result.length > 0;
  } catch {
    hasAdminRole = false;
  }

  if (!hasAdminRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = authProcedure.use(isAdmin);
```

- [ ] **Step 2: 커밋**

```bash
git add packages/features-server/core/trpc/admin-procedure.ts
git commit -m "feat: adminProcedure를 Better Auth members.role 기반으로 전환"
```

---

## Chunk 5: 빌드 검증 및 정리

### Task 12: 전체 타입 체크 및 빌드 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: features-db 타입 체크**

```bash
cd packages/drizzle && bun run check-types
```

- [ ] **Step 2: features-server 타입 체크**

```bash
cd packages/features-server && bun run check-types
```

에러가 발생하면:
- `User` 타입에서 `role`/`roleIds`를 참조하는 파일 → `organizationIds`로 교체 또는 해당 참조 제거
- `userRoles`/`roles` import를 직접 사용하는 코드 → 영향 범위 확인 후 수정 (role-permission feature 내부는 유지)

- [ ] **Step 3: 타입 에러 수정 후 커밋**

```bash
git add -A
git commit -m "fix: Better Auth 전환에 따른 타입 에러 수정"
```

---

### Task 13: 레거시 Supabase 참조 정리 (auth 관련만)

**Files:**
- Modify: `packages/features-server/features/profile/service/profile.service.ts` (TODO 주석 업데이트)
- Modify: `packages/features-server/features/payment/provider/inicis.provider.ts` (Supabase URL 참조)

- [ ] **Step 1: profile.service.ts Supabase TODO 업데이트**

기존: `// TODO: 비밀번호 검증 (Supabase Auth 연동)`
변경: `// TODO: 비밀번호 검증 (Better Auth 연동)`

- [ ] **Step 2: inicis.provider.ts Supabase URL 참조 정리**

기존:
```typescript
const serverCallbackUrl = `${process.env.VITE_SUPABASE_URL ? '' : 'http://localhost:3002'}/api/payment/inicis/callback`;
```

변경:
```typescript
const serverCallbackUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/payment/inicis/callback`;
```

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "refactor: auth 관련 Supabase 참조를 Better Auth/env 기반으로 정리"
```

---

### Task 14: 최종 검증 및 정리 커밋

- [ ] **Step 1: 전체 lint**

```bash
cd packages/features-server && bun run lint
```

- [ ] **Step 2: 테스트 실행**

```bash
cd packages/features-server && bun run test
```

테스트 실패 시: mock에서 `userRoles`/`roles` 사용하는 부분 → `baMembers` 기반으로 수정.

- [ ] **Step 3: git status 확인 — 변경 범위가 features-server + drizzle(features-db) 내로 한정되었는지 확인**

```bash
git status
git diff --stat
```

- [ ] **Step 4: 남은 변경 사항 커밋**

```bash
git add -A
git commit -m "chore: Better Auth 전환 최종 정리"
```
