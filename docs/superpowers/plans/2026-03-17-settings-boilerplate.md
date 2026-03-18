# Settings Boilerplate 이식 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** superbuilder desktop의 settings 6개 페이지(Account, Appearance, Notifications, Organization, Integrations, Billing)를 superbuilder-app-boilerplate에 100% 동일 UI로 이식

**Architecture:** boilerplate `apps/app/`에 TanStack Router 서브라우트로 settings 레이아웃 + 6페이지 구현. 서버 API는 `packages/core/trpc/`에 라우터 추가. Payment는 `packages/payment/`로 이동. Integration은 `packages/core/integrations/`에 범용 프레임워크 구축.

**Tech Stack:** TanStack Router, tRPC, Drizzle ORM, shadcn/ui, superbuilder-ui MCP, Jotai, lucide-react, Web Notification API, Web Audio API

**Target repo:** `superbuilder-app-boilerplate` (`/Users/bbright/Projects/superbuilder-app-boilerplate/`)

**Spec:** `docs/superpowers/specs/2026-03-17-settings-boilerplate-design.md`

---

## Chunk 1: 인프라 — DB 스키마, core 패키지, tRPC 라우터

### Task 1: user_preferences DB 스키마

**Files:**
- Create: `packages/drizzle/src/schema/core/user-preferences.ts`
- Modify: `packages/drizzle/src/schema/index.ts`
- Modify: `packages/drizzle/src/schema-registry.ts`

- [ ] **Step 1: user_preferences 스키마 생성**

```typescript
// packages/drizzle/src/schema/core/user-preferences.ts
import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./auth-tables";

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.key] }),
]);
```

- [ ] **Step 2: schema/index.ts에 export 추가**

`packages/drizzle/src/schema/index.ts`의 core exports 섹션에 추가:
```typescript
export * from "./core/user-preferences";
```

- [ ] **Step 3: schema-registry.ts에 추가**

```typescript
import * as userPreferences from "./schema/core/user-preferences";
// ...
export const schema = {
  ...authTables,
  ...files,
  ...reviews,
  ...userPreferences,
  // ...
};
```

- [ ] **Step 4: migration 생성**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate
pnpm db:generate --name="add_user_preferences"
```

- [ ] **Step 5: Commit**

```bash
git add packages/drizzle/
git commit -m "feat(db): add user_preferences table for settings"
```

---

### Task 2: integration_connections DB 스키마

**Files:**
- Create: `packages/drizzle/src/schema/core/integration-connections.ts`
- Modify: `packages/drizzle/src/schema/index.ts`
- Modify: `packages/drizzle/src/schema-registry.ts`

- [ ] **Step 1: integration_connections 스키마 생성**

```typescript
// packages/drizzle/src/schema/core/integration-connections.ts
import { pgTable, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { organization } from "./auth-tables";

export const integrationConnections = pgTable("integration_connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  status: text("status", { enum: ["connected", "disconnected", "error"] }).notNull().default("disconnected"),
  externalOrgName: text("external_org_name"),
  config: jsonb("config"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_integration_org_provider").on(table.organizationId, table.providerId),
]);
```

- [ ] **Step 2: schema/index.ts와 schema-registry.ts에 추가** (Task 1과 동일 패턴)

- [ ] **Step 3: migration 생성**

```bash
pnpm db:generate --name="add_integration_connections"
```

- [ ] **Step 4: Commit**

```bash
git add packages/drizzle/
git commit -m "feat(db): add integration_connections table"
```

---

### Task 3: core/storage 패키지

파일 업로드를 위한 presigned URL 유틸리티.

**Files:**
- Create: `packages/core/storage/index.ts`
- Create: `packages/core/storage/storage.service.ts`
- Create: `packages/core/storage/types.ts`

- [ ] **Step 1: types 정의**

```typescript
// packages/core/storage/types.ts
export interface StorageProvider {
  generatePresignedUrl(key: string, contentType: string, expiresIn?: number): Promise<{ uploadUrl: string; publicUrl: string }>;
  deleteObject(key: string): Promise<void>;
}

export interface StorageConfig {
  provider: "s3" | "r2" | "local";
  bucket?: string;
  region?: string;
  endpoint?: string;
  publicUrl?: string;
}
```

- [ ] **Step 2: storage service 구현**

```typescript
// packages/core/storage/storage.service.ts
import type { StorageProvider, StorageConfig } from "./types";

export function createStorageService(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case "s3":
    case "r2":
      return createS3Provider(config);
    case "local":
      return createLocalProvider(config);
    default:
      throw new Error(`Unknown storage provider: ${config.provider}`);
  }
}

function createS3Provider(config: StorageConfig): StorageProvider {
  // S3/R2 compatible presigned URL 구현
  // @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner 사용
  return {
    async generatePresignedUrl(key, contentType, expiresIn = 3600) {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

      const client = new S3Client({
        region: config.region ?? "auto",
        endpoint: config.endpoint,
      });

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      const publicUrl = config.publicUrl
        ? `${config.publicUrl}/${key}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;

      return { uploadUrl, publicUrl };
    },
    async deleteObject(key) {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: config.region ?? "auto",
        endpoint: config.endpoint,
      });
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

function createLocalProvider(_config: StorageConfig): StorageProvider {
  // 개발용 로컬 파일 저장 (public/ 디렉토리)
  return {
    async generatePresignedUrl(key, _contentType) {
      return {
        uploadUrl: `/api/upload/${key}`,
        publicUrl: `/uploads/${key}`,
      };
    },
    async deleteObject(_key) {
      // local에서는 no-op
    },
  };
}
```

- [ ] **Step 3: index.ts barrel export**

```typescript
// packages/core/storage/index.ts
export { createStorageService } from "./storage.service";
export type { StorageProvider, StorageConfig } from "./types";
```

- [ ] **Step 4: packages/core/package.json에 storage export 추가**

`packages/core/package.json`의 `exports` 필드에 추가:
```json
"./storage": "./storage/index.ts"
```

- [ ] **Step 5: @aws-sdk 의존성 설치**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --filter @repo/core
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/storage/ packages/core/package.json
git commit -m "feat(core): add storage service with S3/R2/local providers"
```

---

### Task 4: userPreference tRPC 라우터

**Files:**
- Create: `packages/features/_common/routers/user-preference.ts`
- Modify: `packages/features/app-router.ts` (또는 해당 위치의 merged router)

> Note: 새로운 core 라우터는 `packages/features/_common/routers/` 디렉토리를 생성하여 배치. `app-router.ts`에서 ATLAS 마커 **바깥** (Core 영역)에 등록한다.

- [ ] **Step 1: 현재 라우터 구조 확인 + _common/routers/ 디렉토리 생성**

```bash
cat /Users/bbright/Projects/superbuilder-app-boilerplate/packages/features/app-router.ts
ls /Users/bbright/Projects/superbuilder-app-boilerplate/packages/features/_common/
mkdir -p /Users/bbright/Projects/superbuilder-app-boilerplate/packages/features/_common/routers
```

- [ ] **Step 2: userPreference 라우터 생성**

```typescript
// packages/features/_common/routers/user-preference.ts
import { z } from "zod";
import { router, protectedProcedure, getAuthUserId } from "@repo/core/trpc";
import { eq, and } from "drizzle-orm";
import { userPreferences } from "@repo/drizzle/schema";

export const userPreferenceRouter = router({
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = getAuthUserId(ctx);
      const result = await ctx.db
        .select()
        .from(userPreferences)
        .where(and(
          eq(userPreferences.userId, userId),
          eq(userPreferences.key, input.key),
        ))
        .limit(1);
      return result[0]?.value ?? null;
    }),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = getAuthUserId(ctx);
      await ctx.db
        .insert(userPreferences)
        .values({ userId, key: input.key, value: input.value })
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.key],
          set: { value: input.value, updatedAt: new Date() },
        });
      return { success: true };
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = getAuthUserId(ctx);
      const results = await ctx.db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));
      return Object.fromEntries(results.map((r) => [r.key, r.value]));
    }),
});
```

- [ ] **Step 3: app-router에 ATLAS 마커 바깥에 라우터 등록**

`packages/features/app-router.ts`에서 ATLAS 마커 **위**(Core 영역)에 추가:
```typescript
import { userPreferenceRouter } from "./_common/routers/user-preference";

export type AppRouter = typeof appRouter;
const appRouter = router({
  // Core routers (마커 바깥)
  userPreference: userPreferenceRouter,

  // Feature routers (마커 안)
  // [ATLAS:ROUTERS]
  // [/ATLAS:ROUTERS]
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/features/_common/routers/ packages/features/app-router.ts
git commit -m "feat(trpc): add userPreference router for settings persistence"
```

---

### Task 5: user profile/avatar tRPC 확장

**Files:**
- Create: `packages/features/_common/routers/user-profile.ts` (또는 기존 user 라우터 확장)

- [ ] **Step 1: 기존 user 라우터 확인**

```bash
find /Users/bbright/Projects/superbuilder-app-boilerplate/packages/features -name "*.ts" | xargs grep -l "user" 2>/dev/null
```

- [ ] **Step 2: user profile 라우터 생성**

```typescript
// packages/features/_common/routers/user-profile.ts
import { z } from "zod";
import { router, protectedProcedure, getAuthUserId } from "@repo/core/trpc";
import { eq } from "drizzle-orm";
import { user } from "@repo/drizzle/schema";
import { createStorageService } from "@repo/core/storage";

export const userProfileRouter = router({
  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const userId = getAuthUserId(ctx);
      await ctx.db.update(user).set({ name: input.name }).where(eq(user.id, userId));
      return { success: true };
    }),

  getAvatarUploadUrl: protectedProcedure
    .input(z.object({ contentType: z.string(), fileName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = getAuthUserId(ctx);
      const storage = createStorageService({
        provider: (process.env.STORAGE_PROVIDER as "s3" | "r2" | "local") ?? "local",
        bucket: process.env.STORAGE_BUCKET,
        region: process.env.STORAGE_REGION,
        endpoint: process.env.STORAGE_ENDPOINT,
        publicUrl: process.env.STORAGE_PUBLIC_URL,
      });

      const ext = input.fileName.split(".").pop() ?? "png";
      const key = `avatars/${userId}/avatar-${Date.now()}.${ext}`;
      const { uploadUrl, publicUrl } = await storage.generatePresignedUrl(key, input.contentType);

      // DB에 새 avatar URL 저장
      await ctx.db.update(user).set({ image: publicUrl }).where(eq(user.id, userId));

      return { uploadUrl, publicUrl };
    }),
});
```

- [ ] **Step 3: app-router에 등록**

- [ ] **Step 4: Commit**

```bash
git add packages/features/_common/routers/user-profile.ts packages/features/app-router.ts
git commit -m "feat(trpc): add user profile router with name update and avatar upload"
```

---

### Task 6: organization tRPC 라우터 확장

**Files:**
- Create: `packages/features/_common/routers/organization-settings.ts`

- [ ] **Step 1: 기존 organization 관련 코드 확인**

```bash
find /Users/bbright/Projects/superbuilder-app-boilerplate/packages -name "*.ts" | xargs grep -l "organization" 2>/dev/null
```

- [ ] **Step 2: organization settings 라우터 생성**

Organization 이름/slug/로고 변경, 멤버 목록/초대/제거/역할 변경.
better-auth의 organization plugin이 이미 멤버 관리를 제공하므로, 여기서는 추가 설정(로고, slug 등)만 구현.

```typescript
// packages/features/_common/routers/organization-settings.ts
import { z } from "zod";
import { router, protectedProcedure, getAuthUserId } from "@repo/core/trpc";
import { eq } from "drizzle-orm";
import { organization, member } from "@repo/drizzle/schema";
import { createStorageService } from "@repo/core/storage";

export const organizationSettingsRouter = router({
  update: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      name: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, ...updates } = input;
      // TODO: owner 권한 체크
      await ctx.db.update(organization)
        .set(updates)
        .where(eq(organization.id, organizationId));
      return { success: true };
    }),

  getLogoUploadUrl: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      contentType: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storage = createStorageService({
        provider: (process.env.STORAGE_PROVIDER as "s3" | "r2" | "local") ?? "local",
        bucket: process.env.STORAGE_BUCKET,
        region: process.env.STORAGE_REGION,
        endpoint: process.env.STORAGE_ENDPOINT,
        publicUrl: process.env.STORAGE_PUBLIC_URL,
      });

      const ext = input.fileName.split(".").pop() ?? "png";
      const key = `orgs/${input.organizationId}/logo-${Date.now()}.${ext}`;
      const { uploadUrl, publicUrl } = await storage.generatePresignedUrl(key, input.contentType);

      await ctx.db.update(organization)
        .set({ logo: publicUrl })
        .where(eq(organization.id, input.organizationId));

      return { uploadUrl, publicUrl };
    }),

  listMembers: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.query.member.findMany({
        where: (member, { eq }) => eq(member.organizationId, input.organizationId),
        with: { user: true },
      });
      return members;
    }),
});
```

- [ ] **Step 3: app-router에 등록**

- [ ] **Step 4: Commit**

```bash
git add packages/features/_common/routers/organization-settings.ts packages/features/app-router.ts
git commit -m "feat(trpc): add organization settings router"
```

---

### Task 7: core/integrations 프레임워크

**Files:**
- Create: `packages/core/integrations/server/index.ts`
- Create: `packages/core/integrations/server/registry.ts`
- Create: `packages/core/integrations/server/types.ts`
- Create: `packages/core/integrations/client/index.ts`
- Create: `packages/core/integrations/client/registry.ts`
- Create: `packages/core/integrations/client/types.ts`
- Create: `packages/features/_common/routers/integrations.ts`

- [ ] **Step 1: 서버 타입 정의**

```typescript
// packages/core/integrations/server/types.ts
import type { ZodSchema } from "zod";

export type IntegrationCategory = "project" | "communication" | "storage" | "analytics" | "other";

export interface IntegrationStatus {
  connected: boolean;
  externalOrgName?: string | null;
  error?: string | null;
}

export interface IntegrationProviderServer {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  configSchema?: ZodSchema;
  getStatus(orgId: string): Promise<IntegrationStatus>;
  connect(orgId: string, config: unknown): Promise<void>;
  disconnect(orgId: string): Promise<void>;
}
```

- [ ] **Step 2: 서버 레지스트리**

```typescript
// packages/core/integrations/server/registry.ts
import type { IntegrationProviderServer } from "./types";

const providers = new Map<string, IntegrationProviderServer>();

export function registerIntegration(provider: IntegrationProviderServer): void {
  providers.set(provider.id, provider);
}

export function getIntegration(id: string): IntegrationProviderServer | undefined {
  return providers.get(id);
}

export function getAllIntegrations(): IntegrationProviderServer[] {
  return Array.from(providers.values());
}
```

- [ ] **Step 3: 서버 index**

```typescript
// packages/core/integrations/server/index.ts
export { registerIntegration, getIntegration, getAllIntegrations } from "./registry";
export type { IntegrationProviderServer, IntegrationStatus, IntegrationCategory } from "./types";
```

- [ ] **Step 4: 클라이언트 타입 + 레지스트리**

```typescript
// packages/core/integrations/client/types.ts
import type { ComponentType } from "react";

export interface IntegrationProviderMeta {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: string;
}
```

```typescript
// packages/core/integrations/client/registry.ts
import type { IntegrationProviderMeta } from "./types";

const metas = new Map<string, IntegrationProviderMeta>();

export function registerIntegrationMeta(meta: IntegrationProviderMeta): void {
  metas.set(meta.id, meta);
}

export function getIntegrationMeta(id: string): IntegrationProviderMeta | undefined {
  return metas.get(id);
}

export function getAllIntegrationsMeta(): IntegrationProviderMeta[] {
  return Array.from(metas.values());
}
```

```typescript
// packages/core/integrations/client/index.ts
export { registerIntegrationMeta, getIntegrationMeta, getAllIntegrationsMeta } from "./registry";
export type { IntegrationProviderMeta } from "./types";
```

- [ ] **Step 5: integrations tRPC 라우터**

```typescript
// packages/features/_common/routers/integrations.ts
import { z } from "zod";
import { router, protectedProcedure } from "@repo/core/trpc";
import { getAllIntegrations, getIntegration } from "@repo/core/integrations/server";
import { eq, and } from "drizzle-orm";
import { integrationConnections } from "@repo/drizzle/schema";

export const integrationsRouter = router({
  list: protectedProcedure
    .query(async () => {
      const providers = getAllIntegrations();
      return providers.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
      }));
    }),

  getStatus: protectedProcedure
    .input(z.object({ providerId: z.string(), organizationId: z.string() }))
    .query(async ({ input }) => {
      const provider = getIntegration(input.providerId);
      if (!provider) return { connected: false };
      return provider.getStatus(input.organizationId);
    }),

  connect: protectedProcedure
    .input(z.object({ providerId: z.string(), organizationId: z.string(), config: z.unknown().optional() }))
    .mutation(async ({ ctx, input }) => {
      const provider = getIntegration(input.providerId);
      if (!provider) throw new Error(`Unknown provider: ${input.providerId}`);
      await provider.connect(input.organizationId, input.config);

      await ctx.db.insert(integrationConnections).values({
        organizationId: input.organizationId,
        providerId: input.providerId,
        status: "connected",
        connectedAt: new Date(),
      }).onConflictDoUpdate({
        target: [integrationConnections.organizationId, integrationConnections.providerId],
        set: { status: "connected", connectedAt: new Date(), updatedAt: new Date() },
      });

      return { success: true };
    }),

  disconnect: protectedProcedure
    .input(z.object({ providerId: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const provider = getIntegration(input.providerId);
      if (provider) await provider.disconnect(input.organizationId);

      await ctx.db.update(integrationConnections)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(and(
          eq(integrationConnections.organizationId, input.organizationId),
          eq(integrationConnections.providerId, input.providerId),
        ));

      return { success: true };
    }),
});
```

- [ ] **Step 6: package.json exports 추가**

`packages/core/package.json`에:
```json
"./integrations/server": "./integrations/server/index.ts",
"./integrations/client": "./integrations/client/index.ts"
```

- [ ] **Step 7: app-router에 등록**

- [ ] **Step 8: Commit**

```bash
git add packages/core/integrations/ packages/features/_common/routers/integrations.ts packages/features/app-router.ts packages/core/package.json
git commit -m "feat(core): add integration framework with server/client registries and tRPC router"
```

---

## Chunk 2: Settings 레이아웃 + Personal 그룹 (Account, Appearance, Notifications)

### Task 8: Settings 레이아웃 + 라우팅

**Files:**
- Create: `apps/app/src/pages/settings/settings-layout.tsx`
- Create: `apps/app/src/pages/settings/SettingsSidebar/SettingsSidebar.tsx`
- Create: `apps/app/src/pages/settings/SettingsSidebar/index.ts`
- Modify: `apps/app/src/router.tsx`

- [ ] **Step 1: SettingsSidebar 컴포넌트 생성**

Desktop의 `GeneralSettings.tsx` UI를 참조하여 동일한 그룹 구조로 구현.
lucide-react 아이콘 사용. `useMatchRoute`로 활성 라우트 하이라이트.

```typescript
// apps/app/src/pages/settings/SettingsSidebar/SettingsSidebar.tsx
import { cn } from "@repo/ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  User,
  Paintbrush,
  Bell,
  Building2,
  Puzzle,
  CreditCard,
} from "lucide-react";

interface SectionItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface SectionGroup {
  label: string;
  items: SectionItem[];
}

const SECTION_GROUPS: SectionGroup[] = [
  {
    label: "Personal",
    items: [
      { path: "/settings/account", label: "Account", icon: <User className="size-4" /> },
      { path: "/settings/appearance", label: "Appearance", icon: <Paintbrush className="size-4" /> },
      { path: "/settings/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
    ],
  },
  {
    label: "Organization",
    items: [
      { path: "/settings/organization", label: "Organization", icon: <Building2 className="size-4" /> },
      { path: "/settings/integrations", label: "Integrations", icon: <Puzzle className="size-4" /> },
      { path: "/settings/billing", label: "Billing", icon: <CreditCard className="size-4" /> },
    ],
  },
];

export function SettingsSidebar() {
  const matchRoute = useMatchRoute();

  return (
    <aside className="w-56 shrink-0">
      <h1 className="text-lg font-semibold px-3 mb-4">Settings</h1>
      {SECTION_GROUPS.map((group, groupIndex) => (
        <div key={group.label} className={cn(groupIndex > 0 && "mt-4")}>
          <h2 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.1em] px-3 mb-1">
            {group.label}
          </h2>
          <nav className="flex flex-col">
            {group.items.map((item) => {
              const isActive = matchRoute({ to: item.path });
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 text-sm rounded-md transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
```

```typescript
// apps/app/src/pages/settings/SettingsSidebar/index.ts
export { SettingsSidebar } from "./SettingsSidebar";
```

- [ ] **Step 2: settings-layout.tsx 생성**

```typescript
// apps/app/src/pages/settings/settings-layout.tsx
import { Outlet } from "@tanstack/react-router";
import { SettingsSidebar } from "./SettingsSidebar";

export function SettingsLayout() {
  return (
    <div className="flex gap-8 p-6 max-w-6xl mx-auto">
      <SettingsSidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: router.tsx에 settings 라우트 추가**

`apps/app/src/router.tsx`에 import + 라우트 정의 추가.
Spec의 router.tsx 변경 섹션 참조. 아직 페이지 컴포넌트가 없으므로 placeholder 사용:

```typescript
import { redirect } from "@tanstack/react-router";
import { SettingsLayout } from "./pages/settings/settings-layout";

const settingsLayoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: () => { throw redirect({ to: "/settings/account" }); },
});

// Placeholder pages (will be replaced in subsequent tasks)
const PlaceholderPage = () => <div className="p-6">Coming soon</div>;

const settingsAccountRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/account",
  component: PlaceholderPage,
});
const settingsAppearanceRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/appearance",
  component: PlaceholderPage,
});
const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/notifications",
  component: PlaceholderPage,
});
const settingsOrganizationRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/organization",
  component: PlaceholderPage,
});
const settingsIntegrationsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/integrations",
  component: PlaceholderPage,
});
const settingsBillingRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/billing",
  component: PlaceholderPage,
});

// routeTree에 추가
// appLayoutRoute.addChildren([...]) 안에:
settingsLayoutRoute.addChildren([
  settingsIndexRoute,
  settingsAccountRoute,
  settingsAppearanceRoute,
  settingsNotificationsRoute,
  settingsOrganizationRoute,
  settingsIntegrationsRoute,
  settingsBillingRoute,
]),
```

- [ ] **Step 4: 사이드바에 Settings 링크 추가**

`apps/app/src/layouts/blocks/app-shell-01.tsx`의 SidebarUserFooter 메뉴에 Settings 링크 추가:
```typescript
<DropdownMenuItem>
  <Link to="/settings" className="flex w-full cursor-pointer items-center">
    <Settings className="mr-2 size-4" />
    Settings
  </Link>
</DropdownMenuItem>
```

- [ ] **Step 5: dev server로 확인**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate && pnpm dev
```
브라우저에서 `/settings` → `/settings/account`로 리다이렉트되는지, 사이드바가 보이는지 확인.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/ apps/app/src/router.tsx apps/app/src/layouts/
git commit -m "feat(app): add settings layout with sidebar and route structure"
```

---

### Task 9: Account 페이지

**Files:**
- Create: `apps/app/src/pages/settings/account/account-page.tsx`
- Create: `apps/app/src/pages/settings/account/components/ProfileCard/ProfileCard.tsx`
- Create: `apps/app/src/pages/settings/account/components/ProfileCard/index.ts`
- Modify: `apps/app/src/router.tsx` (placeholder → AccountPage)

Desktop `AccountSettings.tsx` 참조. 변환:
- `authClient.useSession()` → 동일
- `electronTrpc.window.selectImageFile` → `<input type="file">`
- `apiTrpcClient.user.uploadAvatar` → `trpcClient.userProfile.getAvatarUploadUrl` + direct upload

- [ ] **Step 1: ProfileCard 컴포넌트 생성**

Desktop의 Card > CardContent > ul > li 패턴 유지. 아바타 업로드는 hidden `<input type="file">`로.

superbuilder-ui MCP에서 적합한 profile/avatar 컴포넌트가 있는지 확인 후 사용.

- [ ] **Step 2: account-page.tsx 생성**

```typescript
// apps/app/src/pages/settings/account/account-page.tsx
import { ProfileCard } from "./components/ProfileCard";

export function AccountPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings
        </p>
      </div>
      <ProfileCard />
    </div>
  );
}
```

- [ ] **Step 3: router.tsx의 placeholder를 AccountPage로 교체**

- [ ] **Step 4: 브라우저에서 Account 페이지 동작 확인**

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/pages/settings/account/ apps/app/src/router.tsx
git commit -m "feat(settings): add Account page with profile card and avatar upload"
```

---

### Task 10: Appearance 페이지

**Files:**
- Create: `apps/app/src/pages/settings/appearance/appearance-page.tsx`
- Create: `apps/app/src/pages/settings/appearance/components/ThemeSection/ThemeSection.tsx`
- Create: `apps/app/src/pages/settings/appearance/components/ThemeSection/index.ts`
- Create: `apps/app/src/pages/settings/appearance/components/FontSection/FontSection.tsx`
- Create: `apps/app/src/pages/settings/appearance/components/FontSection/index.ts`
- Create: `apps/app/src/pages/settings/appearance/components/LanguageSection/LanguageSection.tsx`
- Create: `apps/app/src/pages/settings/appearance/components/LanguageSection/index.ts`
- Modify: `apps/app/src/router.tsx` (placeholder → AppearancePage)

- [ ] **Step 1: ThemeSection — 라이트/다크/시스템 카드**

Desktop의 `ThemeSection.tsx` + `ThemeCard.tsx` + `SystemThemeCard.tsx` 참조.
`themeAtom`을 Jotai `useAtom`으로 읽고 쓰기. 3개 카드(Light, Dark, System) 그리드.

- [ ] **Step 2: FontSection — UI 폰트 선택**

Google Fonts에서 인기 웹폰트 목록 제공. `userPreference.set({ key: "ui-font", value: fontFamily })`.
CSS variable `--font-sans`를 동적으로 변경.

- [ ] **Step 3: LanguageSection — i18n 언어 전환**

`packages/core/i18n`의 `getI18n()`으로 현재 언어 확인.
`i18n.changeLanguage(lang)` 호출. 지원 언어: ko, en.

- [ ] **Step 4: appearance-page.tsx 조립**

Desktop의 `SectionList` 패턴(섹션 간 border-t 구분) 재사용.

- [ ] **Step 5: router.tsx 업데이트 + 확인**

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/appearance/ apps/app/src/router.tsx
git commit -m "feat(settings): add Appearance page with theme, font, and language sections"
```

---

### Task 11: Notifications 페이지

**Files:**
- Create: `apps/app/src/pages/settings/notifications/notifications-page.tsx`
- Create: `apps/app/src/pages/settings/notifications/components/NotificationToggle/NotificationToggle.tsx`
- Create: `apps/app/src/pages/settings/notifications/components/NotificationToggle/index.ts`
- Create: `apps/app/src/pages/settings/notifications/components/SoundPicker/SoundPicker.tsx`
- Create: `apps/app/src/pages/settings/notifications/components/SoundPicker/index.ts`
- Modify: `apps/app/src/router.tsx`

Desktop `RingtonesSettings.tsx` 참조. 변환:
- `electronTrpc.ringtone.preview` → `new Audio(url).play()`
- `electronTrpc.settings.getNotificationSoundsMuted` → `userPreference.get("notification-muted")`
- `useSelectedRingtoneId` (zustand) → `userPreference.get("selected-ringtone")`

- [ ] **Step 1: NotificationToggle — Web Notification API 허용 + 사운드 on/off**

```typescript
// Web Notification permission 요청
async function requestPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}
```

Switch 토글로 사운드 on/off. `userPreference.set` 사용.

- [ ] **Step 2: SoundPicker — 알림 사운드 선택 그리드**

Desktop의 RingtoneCard 패턴 재사용. 카드 그리드 (2~3열).
`<audio>` 태그로 미리듣기. 사운드 파일은 `apps/app/public/sounds/` 에 배치.
기본 사운드 3~5개 제공 (emoji + 이름 + 재생 버튼).

- [ ] **Step 3: notifications-page.tsx 조립**

- [ ] **Step 4: apps/app/public/sounds/ 에 기본 사운드 파일 배치**

자유 라이선스 알림 사운드 파일 준비 (또는 placeholder).

- [ ] **Step 5: router.tsx 업데이트 + 확인**

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/notifications/ apps/app/src/router.tsx apps/app/public/sounds/
git commit -m "feat(settings): add Notifications page with Web Notification API and sound picker"
```

---

## Chunk 3: Organization 그룹 (Organization, Integrations, Billing)

### Task 12: Organization 페이지

**Files:**
- Create: `apps/app/src/pages/settings/organization/organization-page.tsx`
- Create: `apps/app/src/pages/settings/organization/components/OrgInfoCard/OrgInfoCard.tsx`
- Create: `apps/app/src/pages/settings/organization/components/OrgInfoCard/index.ts`
- Create: `apps/app/src/pages/settings/organization/components/MembersTable/MembersTable.tsx`
- Create: `apps/app/src/pages/settings/organization/components/MembersTable/index.ts`
- Create: `apps/app/src/pages/settings/organization/components/InviteDialog/InviteDialog.tsx`
- Create: `apps/app/src/pages/settings/organization/components/InviteDialog/index.ts`
- Modify: `apps/app/src/router.tsx`

Desktop `OrganizationSettings.tsx` 참조. 변환:
- `useLiveQuery` → tRPC `useQuery`
- `electronTrpc.window.selectImageFile` → `<input type="file">`
- `apiTrpcClient.organization.*` → `trpcClient.organizationSettings.*`

- [ ] **Step 1: OrgInfoCard — 로고/이름/slug**

Card > CardContent > ul > li 패턴. 로고는 `<input type="file">` + presigned URL.
Slug 편집은 Dialog (desktop의 SlugDialog 참조).

- [ ] **Step 2: MembersTable — 멤버 목록**

Table 컴포넌트 사용. Avatar + 이름 + 이메일 + Role Badge + Joined date + Actions.
Actions: DropdownMenu (역할 변경, 제거). Owner만 가능.

- [ ] **Step 3: InviteDialog — 멤버 초대**

Dialog + Form (이메일 + 역할 선택). better-auth `organization.inviteMember` 호출.

- [ ] **Step 4: organization-page.tsx 조립**

- [ ] **Step 5: router.tsx 업데이트 + 확인**

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/organization/ apps/app/src/router.tsx
git commit -m "feat(settings): add Organization page with info card, members table, and invite dialog"
```

---

### Task 13: Integrations 페이지

**Files:**
- Create: `apps/app/src/pages/settings/integrations/integrations-page.tsx`
- Create: `apps/app/src/pages/settings/integrations/components/IntegrationCard/IntegrationCard.tsx`
- Create: `apps/app/src/pages/settings/integrations/components/IntegrationCard/index.ts`
- Modify: `apps/app/src/router.tsx`

- [ ] **Step 1: IntegrationCard 컴포넌트**

Desktop의 IntegrationCard 패턴 재사용:
- 아이콘 + 이름 + Badge(Connected/Not Connected) + 설명
- Connect/Manage 버튼

클라이언트 레지스트리(`getAllIntegrationsMeta()`)에서 아이콘 등 메타 조회.
서버 `integrations.getStatus()`로 연결 상태 조회.

- [ ] **Step 2: integrations-page.tsx**

```typescript
export function IntegrationsPage() {
  // integrations.list() 로 서버에서 등록된 provider 목록 조회
  // 각 provider에 대해 IntegrationCard 렌더링
  // 등록된 provider가 없으면 "연동 가능한 서비스가 없습니다" 표시
}
```

- [ ] **Step 3: router.tsx 업데이트 + 확인**

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/pages/settings/integrations/ apps/app/src/router.tsx
git commit -m "feat(settings): add Integrations page with provider registry integration"
```

---

### Task 14: Billing 페이지 (placeholder)

Payment 이동(Chunk 4) 전까지 placeholder로 구현. Payment 이동 후 실제 연동.

**Files:**
- Create: `apps/app/src/pages/settings/billing/billing-page.tsx`
- Create: `apps/app/src/pages/settings/billing/components/CurrentPlanCard/CurrentPlanCard.tsx`
- Create: `apps/app/src/pages/settings/billing/components/CurrentPlanCard/index.ts`
- Create: `apps/app/src/pages/settings/billing/components/UpgradeCard/UpgradeCard.tsx`
- Create: `apps/app/src/pages/settings/billing/components/UpgradeCard/index.ts`
- Create: `apps/app/src/pages/settings/billing/components/InvoiceList/InvoiceList.tsx`
- Create: `apps/app/src/pages/settings/billing/components/InvoiceList/index.ts`
- Modify: `apps/app/src/router.tsx`

- [ ] **Step 1: CurrentPlanCard — 현재 플랜 표시**

Desktop `CurrentPlanCard.tsx` 참조. Free/Pro 표시 + 취소/복원 버튼.
Payment 이동 전에는 mock 데이터 사용.

- [ ] **Step 2: UpgradeCard — 업그레이드 CTA**

Free 플랜일 때만 표시. 업그레이드 버튼.

- [ ] **Step 3: InvoiceList — 최근 인보이스**

테이블 형태. Payment 이동 전에는 빈 상태.

- [ ] **Step 4: billing-page.tsx 조립**

Desktop `BillingOverview.tsx` 레이아웃 참조.

- [ ] **Step 5: router.tsx 업데이트 + 확인**

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/billing/ apps/app/src/router.tsx
git commit -m "feat(settings): add Billing page with plan card, upgrade card, and invoice list (placeholder)"
```

---

## Chunk 4: Payment 이동 + 최종 연동

### Task 15: Payment 패키지 이동

**Files:**
- Create: `packages/payment/` (superbuilder-features에서 복사)
- Modify: `packages/payment/package.json`
- Modify: `packages/payment/src/**/*.ts` (import 변환)
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/drizzle/src/schema-registry.ts`
- Modify: `packages/drizzle/src/schema/index.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/trpc/router.ts`

- [ ] **Step 1: superbuilder-features에서 payment 복사**

```bash
cp -r /Users/bbright/Projects/superbuilder-features/features/payment /Users/bbright/Projects/superbuilder-app-boilerplate/packages/payment
```

- [ ] **Step 2: package.json 수정**

`packages/payment/package.json`의 `name`을 `@repo/payment`로 변경.
`@superbuilder/*` 의존성을 `@repo/*`로 변경.

- [ ] **Step 3: import 경로 일괄 변환**

모든 `.ts`/`.tsx` 파일에서:
- `@superbuilder/core-auth` → `@repo/core/auth`
- `@superbuilder/core-trpc` → `@repo/core/trpc`
- `@superbuilder/core-db` → `@repo/drizzle`
- `@superbuilder/core-schema` → `@repo/drizzle/schema`
- `@superbuilder/core-ui` → `@repo/ui`

```bash
find packages/payment/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/@superbuilder\/core-auth/@repo\/core\/auth/g' \
  -e 's/@superbuilder\/core-trpc/@repo\/core\/trpc/g' \
  -e 's/@superbuilder\/core-db/@repo\/drizzle/g' \
  -e 's/@superbuilder\/core-schema/@repo\/drizzle\/schema/g' \
  -e 's/@superbuilder\/core-ui/@repo\/ui/g' \
  {} +
```

- [ ] **Step 4: pnpm-workspace.yaml 확인**

현재 `packages: ["apps/*", "packages/*"]`이므로 `packages/payment`는 자동 포함.

- [ ] **Step 5: payment package.json exports 검증**

`packages/payment/package.json`의 `exports` 필드가 올바른지 확인:
```json
{
  "exports": {
    "./schema": "./src/schema/index.ts",
    "./server": "./src/server/index.ts",
    "./client": "./src/client/index.ts",
    "./admin": "./src/admin/index.ts",
    "./common": "./src/common/types.ts"
  }
}
```

- [ ] **Step 6: 소비 패키지에 @repo/payment 의존성 추가**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate
pnpm add @repo/payment@workspace:* --filter @repo/drizzle
pnpm add @repo/payment@workspace:* --filter @repo/server
pnpm add @repo/payment@workspace:* --filter @repo/app
```

- [ ] **Step 7: drizzle.config.ts에 payment schema 경로 추가**

`drizzle.config.ts`의 `schema` 필드에 payment 경로 추가:
```typescript
schema: [
  "./packages/drizzle/src/schema/**/*.ts",
  "./packages/payment/src/schema/**/*.ts",  // 추가
],
```

- [ ] **Step 8: schema-registry에 payment schema 추가**

```typescript
// packages/drizzle/src/schema-registry.ts
import * as paymentSchema from "@repo/payment/schema";
// ...
export const schema = {
  ...authTables,
  ...files,
  ...reviews,
  ...userPreferences,
  ...integrationConnectionsSchema,
  ...paymentSchema,
};
```

- [ ] **Step 9: NestJS app.module.ts에 PaymentModule 직접 등록**

```typescript
import { PaymentModule } from "@repo/payment/server";
// ...
imports: [
  // ... 기존 imports
  PaymentModule,
  // [ATLAS:MODULES]
  // [/ATLAS:MODULES]
],
```

- [ ] **Step 10: tRPC router에 paymentRouter 등록**

```typescript
import { paymentRouter } from "@repo/payment/server";
// ...
export const trpcRouter = router({
  payment: paymentRouter,
  // [ATLAS:ROUTERS]
  // [/ATLAS:ROUTERS]
});
```

- [ ] **Step 11: pnpm install + typecheck**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate
pnpm install
pnpm check-types
```

- [ ] **Step 12: Commit**

```bash
git add packages/payment/ packages/drizzle/ apps/server/ pnpm-lock.yaml drizzle.config.ts
git commit -m "feat: move payment package from superbuilder-features to boilerplate"
```

---

### Task 16: Billing 페이지 실제 연동

**Files:**
- Modify: `apps/app/src/pages/settings/billing/components/CurrentPlanCard/CurrentPlanCard.tsx`
- Modify: `apps/app/src/pages/settings/billing/components/UpgradeCard/UpgradeCard.tsx`
- Modify: `apps/app/src/pages/settings/billing/components/InvoiceList/InvoiceList.tsx`
- Modify: `apps/app/src/pages/settings/billing/billing-page.tsx`

- [ ] **Step 1: CurrentPlanCard에 payment tRPC 연동**

`trpcClient.payment.subscription.getCurrent` 등 실제 API 호출로 교체.

- [ ] **Step 2: UpgradeCard에 checkout 연동**

`trpcClient.payment.checkout.create` 호출.

- [ ] **Step 3: InvoiceList에 인보이스 목록 연동**

`trpcClient.payment.invoice.list` 호출.

- [ ] **Step 4: Payment client routes를 router.tsx에 추가**

Payment의 `createPaymentAuthRoutes`(checkout callback 등)를 settings/billing 하위 또는 독립 라우트로 등록:
```typescript
import { createPaymentAuthRoutes } from "@repo/payment/client";
// settingsBillingRoute 하위에 payment 서브라우트 추가
```

- [ ] **Step 5: 확인**

dev server에서 Billing 페이지 동작 확인. Payment env가 없으면 graceful fallback.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src/pages/settings/billing/ apps/app/src/router.tsx
git commit -m "feat(settings): connect Billing page to payment package"
```

---

### Task 17: superbuilder-features에서 payment 제거

**Target repo:** `superbuilder-features` (`/Users/bbright/Projects/superbuilder-features/`)

- [ ] **Step 1: features/payment/ 삭제**

```bash
cd /Users/bbright/Projects/superbuilder-features
rm -rf features/payment
```

- [ ] **Step 2: 다른 feature의 payment 의존성 확인**

```bash
grep -r "payment" features/*/feature.json
```

의존하는 feature가 있으면 `@repo/payment` core contract으로 전환 안내 주석 추가.

- [ ] **Step 3: Commit + PR**

```bash
git add -A
git commit -m "chore: remove payment feature (moved to boilerplate core)"
```

---

### Task 18: 최종 검증 + AppShell 사이드바 Settings 링크 전체 확인

- [ ] **Step 1: typecheck**

```bash
cd /Users/bbright/Projects/superbuilder-app-boilerplate
pnpm check-types
```

- [ ] **Step 2: lint**

```bash
pnpm lint
```

- [ ] **Step 3: dev server 전체 페이지 확인**

```bash
pnpm dev
```

6개 Settings 페이지 모두 접근 + UI 확인:
- `/settings/account` — 프로필 카드, 아바타 업로드, Sign Out
- `/settings/appearance` — 테마 카드, 폰트, 언어
- `/settings/notifications` — 토글, 사운드 피커
- `/settings/organization` — 조직 정보, 멤버 테이블
- `/settings/integrations` — 빈 상태 또는 등록된 provider 카드
- `/settings/billing` — 현재 플랜, 업그레이드, 인보이스

- [ ] **Step 4: Commit (lint fix 등)**

```bash
git add -A
git commit -m "chore: fix lint and type issues after settings migration"
```
