# Plan A: superbuilder-features Repo Bootstrap

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `superbuilder-features` GitHub repo with workspace config, core contract stubs, dev-kit stub, and link it as a git submodule to superbuilder.

**Architecture:** A new Bun workspace monorepo (`superbuilder-features`) containing `core/*` (6 contract packages), `dev-kit` (mock tools), and `features/` (empty, ready for migration). Linked to superbuilder via git submodule at `features/`.

**Tech Stack:** Bun, TypeScript, Vitest, NestJS (peer dep in dev-kit), React (peer dep in dev-kit)

**Spec:** `docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md` (Sections 2, 5, 6, 8)

---

## 🤖 에이전트 실행 가이드

| 항목 | 값 |
|------|-----|
| **작업 레포** | `superbuilder-features` (새로 생성) + `superbuilder` (submodule 연결) |
| **작업 디렉토리** | Task 1-10: `/Users/bright/Projects/superbuilder-features` (새로 생성), Task 11-12: `/Users/bright/Projects/superbuilder` |
| **브랜치** | `superbuilder-features`: `main`, `superbuilder`: `develop` |
| **사전 조건** | 없음 (이 Plan이 첫 번째) |
| **병렬 실행** | Plan B와 **병렬 가능** (서로 다른 레포). Plan C는 이 Plan 완료 후 실행 |
| **완료 기준** | `superbuilder-features` 레포가 GitHub에 push되고, `superbuilder/features`에 submodule로 연결됨 |
| **GitHub org** | `bbright-code` (예: `git@github.com:bbright-code/superbuilder-features.git`) |

---

## File Structure

### superbuilder-features repo (new)

```
superbuilder-features/
├── package.json                         # workspace root
├── tsconfig.json                        # shared TS config (decorators enabled)
├── biome.json                           # formatting/linting (match superbuilder)
├── .gitignore
├── README.md
├── core/
│   ├── auth/
│   │   ├── package.json                 # @superbuilder/core-auth
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # re-exports: authenticatedAtom, profileAtom, Guards, types
│   ├── trpc/
│   │   ├── package.json                 # @superbuilder/core-trpc
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # re-exports: publicProcedure, protectedProcedure, adminProcedure, router
│   ├── db/
│   │   ├── package.json                 # @superbuilder/core-db
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # re-exports: InjectDrizzle, DrizzleDB type
│   ├── schema/
│   │   ├── package.json                 # @superbuilder/core-schema
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # re-exports: profiles, files tables + types
│   ├── logger/
│   │   ├── package.json                 # @superbuilder/core-logger
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # re-exports: createLogger
│   └── ui/
│       ├── package.json                 # @superbuilder/core-ui
│       ├── tsconfig.json
│       └── src/
│           └── index.ts                 # re-exports: Feature, FeatureHeader, FeatureContents, Button, Input...
├── dev-kit/
│   ├── package.json                     # @superbuilder/dev-kit
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   └── index.ts                 # createMockDbModule, createMockDb
│       ├── auth/
│       │   └── index.ts                 # createMockAuthModule, TEST_USER
│       ├── ui/
│       │   └── index.ts                 # DevShell placeholder
│       └── trpc/
│           └── index.ts                 # createMockTrpcClient
└── features/                            # empty, ready for feature migration
    └── .gitkeep
```

### superbuilder repo (modifications)

```
superbuilder/
├── package.json                         # MODIFY: add features/* to workspaces
├── features/                            # NEW: git submodule → superbuilder-features
└── .gitmodules                          # NEW: submodule config
```

---

## Chunk 1: Repository Foundation

### Task 1: Create superbuilder-features repo on GitHub

**Files:**
- Create: (GitHub repo via `gh` CLI)

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create BBrightcode-atlas/superbuilder-features --private --description "Superbuilder feature packages — independent, self-contained feature plugins"
```

- [ ] **Step 2: Clone locally**

```bash
cd /Users/bright/Projects
git clone git@github.com:BBrightcode-atlas/superbuilder-features.git
cd superbuilder-features
```

- [ ] **Step 3: Verify**

Run: `gh repo view BBrightcode-atlas/superbuilder-features`
Expected: Repo exists, private, correct description

- [ ] **Step 4: Commit**

```bash
# (empty repo, nothing to commit yet)
```

---

### Task 2: Root workspace configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `features/.gitkeep`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "@superbuilder/features-repo",
  "version": "0.0.1",
  "private": true,
  "packageManager": "bun@1.3.6",
  "workspaces": [
    "core/*",
    "dev-kit",
    "features/*"
  ],
  "scripts": {
    "test": "bun test",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "bunx @biomejs/biome check .",
    "lint:fix": "bunx @biomejs/biome check --write --unsafe .",
    "format": "bunx @biomejs/biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.2",
    "typescript": "^5.8.0"
  },
  "dependencies": {
    "reflect-metadata": "^0.2.2"
  }
}
```

- [ ] **Step 2: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {}
  },
  "exclude": ["node_modules", "dist", "**/dev/**"]
}
```

- [ ] **Step 3: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.2/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", ".turbo"]
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
.env.*
!.env.example
```

- [ ] **Step 5: Create `README.md`**

```markdown
# superbuilder-features

Superbuilder feature packages — independent, self-contained feature plugins.

## Structure

- `core/` — Core Contract packages (`@superbuilder/core-*`)
- `dev-kit/` — Shared dev/test utilities (`@superbuilder/dev-kit`)
- `features/` — Individual feature packages (`@superbuilder/feature-*`)

## Development

```bash
bun install
bun test
bun run typecheck
```

## Linked from

This repo is used as a git submodule in [superbuilder](https://github.com/BBrightcode-atlas/superbuilder) at `features/`.
```

- [ ] **Step 6: Create `features/.gitkeep`**

```bash
mkdir -p features
touch features/.gitkeep
```

- [ ] **Step 7: Install dependencies**

```bash
bun install
```

- [ ] **Step 8: Verify workspace resolves**

Run: `cat bun.lock | head -5`
Expected: Lock file created without errors

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize workspace with root config"
```

---

### Task 3: Core contract — `@superbuilder/core-auth`

**Files:**
- Create: `core/auth/package.json`
- Create: `core/auth/tsconfig.json`
- Create: `core/auth/src/index.ts`

- [ ] **Step 1: Create `core/auth/package.json`**

```json
{
  "name": "@superbuilder/core-auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "jotai": "*",
    "react": "*"
  }
}
```

- [ ] **Step 2: Create `core/auth/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/auth/src/index.ts`**

This is a contract stub — real implementations come from the boilerplate's `@repo/core/auth` at scaffold time. Feature code imports from here during development, and the Scaffold Engine rewrites to `@repo/core/auth`.

```typescript
/**
 * @superbuilder/core-auth — Auth Core Contract
 *
 * Feature code imports from this package during development.
 * At scaffold time, imports are rewritten to @repo/core/auth.
 *
 * These stubs define the shape of the contract. Real implementations
 * are provided by the boilerplate's core/auth package.
 */

import type { ReactNode } from "react";

// --- Jotai Atoms (stubs) ---
import { atom } from "jotai";

/** Whether the user is authenticated */
export const authenticatedAtom = atom<boolean>(false);

/** Current user session */
export const sessionAtom = atom<Session | null>(null);

/** Current user profile */
export const profileAtom = atom<Profile | null>(null);

// --- Types ---
export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface Profile {
	id: string;
	name: string;
	email: string;
	avatar?: string | null;
	role: "owner" | "admin" | "editor" | "guest";
}

export type UserRole = Profile["role"];

// --- Guards (React components) ---
export interface AuthGuardProps {
	children: ReactNode;
	fallback?: ReactNode;
}

/** Placeholder — real guard checks authenticatedAtom */
export function AuthGuard({ children }: AuthGuardProps): ReactNode {
	return children;
}

export interface AdminGuardProps {
	children: ReactNode;
	authenticated: boolean;
	userRole: UserRole | null;
	allowedRoles?: UserRole[];
	onUnauthenticated?: () => void;
	onUnauthorized?: () => void;
}

/** Placeholder — real guard checks role */
export function AdminGuard({ children }: AdminGuardProps): ReactNode {
	return children;
}
```

- [ ] **Step 4: Verify typecheck (deferred)**

Typecheck is deferred to Task 10 when all peer dependencies are installed at root level. Skip this step — Task 10 does a global workspace typecheck.

- [ ] **Step 5: Commit**

```bash
git add core/auth/
git commit -m "feat: add @superbuilder/core-auth contract stub"
```

---

### Task 4: Core contract — `@superbuilder/core-trpc`

**Files:**
- Create: `core/trpc/package.json`
- Create: `core/trpc/tsconfig.json`
- Create: `core/trpc/src/index.ts`

- [ ] **Step 1: Create `core/trpc/package.json`**

```json
{
  "name": "@superbuilder/core-trpc",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@trpc/server": "*"
  }
}
```

- [ ] **Step 2: Create `core/trpc/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/trpc/src/index.ts`**

```typescript
/**
 * @superbuilder/core-trpc — tRPC Core Contract
 *
 * Feature code imports procedure builders from this package.
 * At scaffold time, imports are rewritten to @repo/core/trpc.
 */

import { initTRPC } from "@trpc/server";

// Minimal context type — real context comes from boilerplate
export interface TRPCContext {
	user?: { id: string; role: string } | null;
	db?: unknown;
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires authenticated user */
export const protectedProcedure = t.procedure;

/** Requires admin role */
export const adminProcedure = t.procedure;

export const createTRPCRouter = t.router;
```

- [ ] **Step 4: Commit**

```bash
git add core/trpc/
git commit -m "feat: add @superbuilder/core-trpc contract stub"
```

---

### Task 5: Core contract — `@superbuilder/core-db`

**Files:**
- Create: `core/db/package.json`
- Create: `core/db/tsconfig.json`
- Create: `core/db/src/index.ts`

- [ ] **Step 1: Create `core/db/package.json`**

```json
{
  "name": "@superbuilder/core-db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "drizzle-orm": "*"
  }
}
```

- [ ] **Step 2: Create `core/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/db/src/index.ts`**

```typescript
/**
 * @superbuilder/core-db — Database Core Contract
 *
 * Feature code imports DB injection and types from this package.
 * At scaffold time, imports are rewritten to @repo/drizzle.
 */

/**
 * Drizzle DB instance type.
 * Stub uses a generic type to avoid requiring postgres driver.
 * Real implementation uses NodePgDatabase from drizzle-orm/node-postgres.
 */
export type DrizzleDB = {
	query: Record<string, unknown>;
	select: (...args: unknown[]) => unknown;
	insert: (...args: unknown[]) => unknown;
	update: (...args: unknown[]) => unknown;
	delete: (...args: unknown[]) => unknown;
};

/**
 * NestJS parameter decorator for injecting Drizzle DB.
 * Stub — real decorator provided by boilerplate.
 */
export function InjectDrizzle(): ParameterDecorator {
	return (_target, _propertyKey, _parameterIndex) => {
		// no-op stub — real implementation uses NestJS Inject token
	};
}

/** Drizzle injection token name */
export const DRIZZLE_TOKEN = "DRIZZLE_DB";
```

- [ ] **Step 4: Commit**

```bash
git add core/db/
git commit -m "feat: add @superbuilder/core-db contract stub"
```

---

### Task 6: Core contract — `@superbuilder/core-schema`

**Files:**
- Create: `core/schema/package.json`
- Create: `core/schema/tsconfig.json`
- Create: `core/schema/src/index.ts`

- [ ] **Step 1: Create `core/schema/package.json`**

```json
{
  "name": "@superbuilder/core-schema",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "drizzle-orm": "*"
  }
}
```

- [ ] **Step 2: Create `core/schema/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/schema/src/index.ts`**

```typescript
/**
 * @superbuilder/core-schema — Shared Schema Core Contract
 *
 * Provides core table definitions (profiles, files) that features reference via FK.
 * At scaffold time, imports are rewritten to @repo/drizzle.
 */

import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

// --- Enums ---
export const rolesEnum = pgEnum("roles", ["owner", "admin", "editor", "guest"]);

// --- Core Tables ---
export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").unique().notNull(),
	avatar: text("avatar"),
	role: rolesEnum("role").default("editor"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const files = pgTable("files", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	originalName: text("original_name").notNull(),
	mimeType: text("mime_type").notNull(),
	size: integer("size").notNull(),
	url: text("url").notNull(),
	uploadedById: uuid("uploaded_by_id")
		.notNull()
		.references(() => profiles.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Type Exports ---
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
```

- [ ] **Step 4: Commit**

```bash
git add core/schema/
git commit -m "feat: add @superbuilder/core-schema contract stub"
```

---

### Task 7: Core contract — `@superbuilder/core-logger`

**Files:**
- Create: `core/logger/package.json`
- Create: `core/logger/tsconfig.json`
- Create: `core/logger/src/index.ts`

- [ ] **Step 1: Create `core/logger/package.json`**

```json
{
  "name": "@superbuilder/core-logger",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `core/logger/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/logger/src/index.ts`**

```typescript
/**
 * @superbuilder/core-logger — Logger Core Contract
 *
 * At scaffold time, imports are rewritten to @repo/core/logger.
 */

export interface Logger {
	info(message: string, attrs?: Record<string, unknown>): void;
	warn(message: string, attrs?: Record<string, unknown>): void;
	error(message: string, attrs?: Record<string, unknown>): void;
	debug(message: string, attrs?: Record<string, unknown>): void;
}

/** Create a namespaced logger. Stub uses console. */
export function createLogger(namespace: string): Logger {
	const prefix = `[${namespace}]`;
	return {
		info: (msg, attrs) => console.info(prefix, msg, attrs ?? ""),
		warn: (msg, attrs) => console.warn(prefix, msg, attrs ?? ""),
		error: (msg, attrs) => console.error(prefix, msg, attrs ?? ""),
		debug: (msg, attrs) => console.debug(prefix, msg, attrs ?? ""),
	};
}
```

- [ ] **Step 4: Commit**

```bash
git add core/logger/
git commit -m "feat: add @superbuilder/core-logger contract stub"
```

---

### Task 8: Core contract — `@superbuilder/core-ui`

**Files:**
- Create: `core/ui/package.json`
- Create: `core/ui/tsconfig.json`
- Create: `core/ui/src/index.ts`

- [ ] **Step 1: Create `core/ui/package.json`**

```json
{
  "name": "@superbuilder/core-ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "*",
    "react-dom": "*"
  }
}
```

- [ ] **Step 2: Create `core/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `core/ui/src/index.ts`**

```typescript
/**
 * @superbuilder/core-ui — UI Core Contract
 *
 * Re-exports page layout components and common shadcn components.
 * At scaffold time, imports are rewritten to @repo/ui.
 */

import type { ReactNode } from "react";

// --- Page Layout Components (stubs) ---
export interface FeatureProps {
	children: ReactNode;
	className?: string;
}

export function Feature({ children, className }: FeatureProps): ReactNode {
	return children;
}

export interface FeatureHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function FeatureHeader({ title }: FeatureHeaderProps): ReactNode {
	return null;
}

export interface FeatureContentsProps {
	children: ReactNode;
	padding?: "none" | "sm" | "md" | "lg";
}

export function FeatureContents({ children }: FeatureContentsProps): ReactNode {
	return children;
}

// Note: shadcn components (Button, Input, etc.) are re-exported from @repo/ui
// at scaffold time. During feature dev, use @superbuilder/core-ui imports.
// The dev-kit DevShell provides real shadcn components for dev mode.
```

- [ ] **Step 4: Commit**

```bash
git add core/ui/
git commit -m "feat: add @superbuilder/core-ui contract stub"
```

---

## Chunk 2: Dev Kit & Submodule Integration

### Task 9: Dev Kit — `@superbuilder/dev-kit`

**Files:**
- Create: `dev-kit/package.json`
- Create: `dev-kit/tsconfig.json`
- Create: `dev-kit/src/index.ts`
- Create: `dev-kit/src/db/index.ts`
- Create: `dev-kit/src/auth/index.ts`
- Create: `dev-kit/src/ui/index.ts`
- Create: `dev-kit/src/trpc/index.ts`

- [ ] **Step 1: Create `dev-kit/package.json`**

```json
{
  "name": "@superbuilder/dev-kit",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./db": "./src/db/index.ts",
    "./auth": "./src/auth/index.ts",
    "./ui": "./src/ui/index.ts",
    "./trpc": "./src/trpc/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "peerDependencies": {
    "@nestjs/common": ">=11.0.0",
    "@nestjs/core": ">=11.0.0",
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "drizzle-orm": ">=0.38.0"
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.38.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create `dev-kit/tsconfig.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `dev-kit/src/index.ts`**

```typescript
export { createMockDbModule, createMockDb } from "./db";
export { createMockAuthModule, TEST_USER } from "./auth";
export { DevShell, DevLayout } from "./ui";
export { createMockTrpcClient } from "./trpc";
```

- [ ] **Step 4: Create `dev-kit/src/db/index.ts`**

```typescript
/**
 * Mock DB module for feature dev harness.
 * Uses better-sqlite3 in-memory for zero-config local dev.
 */
import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";

export interface MockDbOptions {
	seed?: () => Promise<void>;
}

/**
 * NestJS DynamicModule providing an in-memory SQLite DB via Drizzle.
 * Features use InjectDrizzle() to access the DB instance.
 */
export function createMockDbModule(options?: MockDbOptions): DynamicModule {
	return {
		module: MockDbModule,
		global: true,
		providers: [
			{
				provide: "DRIZZLE_DB",
				useFactory: async () => {
					// TODO: Phase 1 — set up better-sqlite3 + drizzle-orm/better-sqlite3
					// For now, return a placeholder
					const mockDb = {};
					if (options?.seed) {
						await options.seed();
					}
					return mockDb;
				},
			},
		],
		exports: ["DRIZZLE_DB"],
	};
}

@Module({})
class MockDbModule {}

/** Standalone mock DB for unit tests (no NestJS) */
export function createMockDb() {
	// TODO: Phase 1 — set up better-sqlite3 + drizzle-orm/better-sqlite3
	return {};
}
```

- [ ] **Step 5: Create `dev-kit/src/auth/index.ts`**

```typescript
/**
 * Mock auth module for feature dev harness.
 * Provides a fixed test user without real authentication.
 */
import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";

export const TEST_USER = {
	id: "test-user-001",
	name: "Test Developer",
	email: "dev@superbuilder.test",
	role: "admin" as const,
	avatar: null,
};

/**
 * NestJS DynamicModule providing mock auth.
 * Injects TEST_USER as the current user in all requests.
 */
export function createMockAuthModule(): DynamicModule {
	return {
		module: MockAuthModule,
		global: true,
		providers: [
			{
				provide: "CURRENT_USER",
				useValue: TEST_USER,
			},
		],
		exports: ["CURRENT_USER"],
	};
}

@Module({})
class MockAuthModule {}
```

- [ ] **Step 6: Create `dev-kit/src/ui/index.ts`**

```typescript
/**
 * DevShell & DevLayout — minimal React shell for feature dev mode.
 * Provides TanStack Router, tRPC client, and auth context.
 */

import type { ReactNode } from "react";

export interface DevShellProps {
	apiUrl: string;
	routes: (rootRoute: unknown) => unknown[];
	mockUser?: {
		id: string;
		name: string;
		role: string;
	};
	children?: ReactNode;
}

/**
 * Placeholder — real DevShell wraps:
 * - TanStack Router with provided routes
 * - tRPC client pointing at apiUrl
 * - Mock auth context with mockUser
 */
export function DevShell({ children }: DevShellProps): ReactNode {
	// TODO: Phase 1 — implement full DevShell with providers
	return children ?? null;
}

/** Placeholder — wraps Feature + FeatureHeader layout for dev mode */
export function DevLayout({ children }: { children: ReactNode }): ReactNode {
	return children ?? null;
}
```

- [ ] **Step 7: Create `dev-kit/src/trpc/index.ts`**

```typescript
/**
 * Mock tRPC client for feature dev/test.
 */

export interface MockTrpcClientOptions {
	baseUrl: string;
}

/**
 * Create a tRPC client connected to the dev server.
 * Placeholder — will be implemented with actual tRPC client setup.
 */
export function createMockTrpcClient(_options: MockTrpcClientOptions) {
	// TODO: Phase 1 — implement with @trpc/client
	return {};
}
```

- [ ] **Step 8: Commit**

```bash
git add dev-kit/
git commit -m "feat: add @superbuilder/dev-kit with mock db, auth, ui, trpc stubs"
```

---

### Task 10: Install all dependencies and verify workspace

**Files:**
- Modify: `package.json` (root — may need peer deps)

- [ ] **Step 1: Install workspace dependencies**

```bash
cd /Users/bright/Projects/superbuilder-features
bun install
```

- [ ] **Step 2: Verify all packages resolve**

```bash
bun run typecheck 2>&1 | tail -20
```

Expected: May have errors from missing peer deps — that's OK for stubs. Core packages with no external deps should pass.

- [ ] **Step 3: Fix any critical resolution errors**

If `bun install` fails, add missing peer dependencies to root `devDependencies`:

```bash
bun add -d jotai @trpc/server drizzle-orm react react-dom @types/react @types/react-dom
```

- [ ] **Step 4: Re-run typecheck**

Run: `bun run typecheck`
Expected: Clean or only stub-related warnings

- [ ] **Step 5: Push to GitHub**

```bash
git push -u origin main
```

- [ ] **Step 6: Commit**

```bash
# Already pushed, no extra commit needed
```

---

### Task 11: Link as git submodule in superbuilder

**Files:**
- Modify: `/Users/bright/Projects/superbuilder/package.json`
- Create: `/Users/bright/Projects/superbuilder/.gitmodules`
- Create: `/Users/bright/Projects/superbuilder/features/` (submodule)

- [ ] **Step 1: Add submodule in superbuilder repo**

```bash
cd /Users/bright/Projects/superbuilder
git checkout develop || git checkout -b develop
git submodule add git@github.com:BBrightcode-atlas/superbuilder-features.git features
```

- [ ] **Step 2: Verify submodule created**

Run: `cat .gitmodules`
Expected:
```
[submodule "features"]
	path = features
	url = git@github.com:BBrightcode-atlas/superbuilder-features.git
```

- [ ] **Step 3: Update superbuilder `package.json` workspaces**

Add `features/core/*`, `features/dev-kit`, `features/features/*` to the workspaces array:

```json
"workspaces": [
    "packages/*",
    "apps/*",
    "tooling/*",
    "features/core/*",
    "features/dev-kit",
    "features/features/*"
],
```

- [ ] **Step 4: Install from superbuilder root**

```bash
bun install
```

- [ ] **Step 5: Verify submodule packages appear in workspace**

```bash
bun pm ls 2>/dev/null | grep "@superbuilder" || echo "WARNING: submodule packages not found in workspace"
```

Expected: All 7 `@superbuilder/*` packages listed

- [ ] **Step 6: Verify core packages resolve from superbuilder**

```bash
bun run --filter '@superbuilder/core-logger' typecheck
```

Expected: Typecheck passes

- [ ] **Step 7: Commit submodule addition**

```bash
git add .gitmodules features package.json bun.lock
git commit -m "feat: add superbuilder-features as git submodule at features/"
```

---

### Task 12: Verify end-to-end workspace integration

**Files:** (no new files)

- [ ] **Step 1: Verify all superbuilder packages still resolve**

```bash
cd /Users/bright/Projects/superbuilder
bun install
bun run typecheck 2>&1 | tail -10
```

Expected: No new errors introduced

- [ ] **Step 2: Verify core contract packages are accessible**

```bash
cd /Users/bright/Projects/superbuilder
echo 'import { createLogger } from "@superbuilder/core-logger"; console.log(typeof createLogger);' | bun run -
```

Expected: Output `function`

- [ ] **Step 3: Push superbuilder changes**

```bash
git push origin develop
```

- [ ] **Step 4: Final verification summary**

Verify these are all true:
- `superbuilder-features` repo exists on GitHub ✓
- 6 core contract packages created (`core-auth`, `core-trpc`, `core-db`, `core-schema`, `core-logger`, `core-ui`) ✓
- `dev-kit` package created with mock db/auth/ui/trpc stubs ✓
- Submodule linked at `features/` in superbuilder ✓
- Superbuilder workspace resolves all packages ✓
