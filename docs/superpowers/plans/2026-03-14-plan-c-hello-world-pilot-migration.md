# Plan C: Hello-World Pilot Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the hello-world feature from the boilerplate's scattered structure into a single self-contained package in `superbuilder-features/features/hello-world/`, with `feature.json` manifest, multi-entrypoint `package.json`, and working dev harness.

**Architecture:** Collect hello-world source from 3 boilerplate locations (server, client, admin) into a single `features/hello-world/` package. Replace boilerplate-relative imports (`../../../core/trpc`, `@/lib/trpc`) with Core Contract imports (`@superbuilder/core-trpc`, `@superbuilder/core-ui`). Write a `feature.json` manifest declaring what the feature provides. Add a minimal dev harness (`dev/server.ts`).

**Tech Stack:** TypeScript, NestJS, React, TanStack Router, tRPC, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-backstage-feature-plugin-system-design.md` (Sections 3, 4, 6, 9 Phase 1)

**Depends on:** Plan A (superbuilder-features repo exists with core packages and dev-kit)

---

## 🤖 에이전트 실행 가이드

| 항목 | 값 |
|------|-----|
| **작업 레포** | `superbuilder-features` (Task 1-11, 13) + `superbuilder` (Task 12) |
| **작업 디렉토리** | Task 1-11, 13: `/Users/bright/Projects/superbuilder-features/features/hello-world`, Task 12: `/Users/bright/Projects/superbuilder` |
| **브랜치** | `superbuilder-features`: `main`, `superbuilder`: `develop` |
| **사전 조건** | **Plan A 완료 필수** — `superbuilder-features` 레포가 존재하고 core contract 스텁 + dev-kit이 설치되어 있어야 함. Plan B는 불필요 (hello-world 코드 작성은 엔진과 독립) |
| **병렬 실행** | Plan B와 **병렬 가능** (서로 다른 레포, 다른 관심사). Plan A 완료 후에만 실행 가능 |
| **완료 기준** | `features/hello-world/` 패키지가 typecheck + test 통과, `bun install` 성공, submodule 포인터 업데이트됨 |
| **참조할 boilerplate 원본 위치** | `/Users/bright/Projects/superbuilder-app-template` (읽기 전용 참조, 수정하지 않음) |

### boilerplate → feature 패키지 매핑 (참조용)

```
boilerplate 원본                                          → feature 패키지 대상
─────────────────────────────────────────────────────────────────────────────────
packages/features/hello-world/                            → src/server/
apps/app/src/features/hello-world/                        → src/client/
apps/system-admin/src/features/hello-world/               → src/admin/
(신규)                                                     → src/common/types.ts
(신규)                                                     → feature.json
(신규)                                                     → dev/server.ts, dev/app.tsx
```

---

## File Structure

All files are created inside the `superbuilder-features` repo (cloned at `/Users/bright/Projects/superbuilder-features` or accessed via submodule at `/Users/bright/Projects/superbuilder/features`).

```
features/hello-world/
├── package.json                          # @superbuilder/feature-hello-world
├── feature.json                          # self-describing manifest
├── tsconfig.json
├── src/
│   ├── server/                           # NestJS Module + tRPC Router
│   │   ├── index.ts                      # barrel: HelloWorldModule, helloWorldRouter, etc.
│   │   ├── hello-world.module.ts         # NestJS Module
│   │   ├── hello-world.router.ts         # tRPC Router
│   │   ├── service/
│   │   │   ├── index.ts
│   │   │   └── hello-world.service.ts
│   │   └── controller/
│   │       ├── index.ts
│   │       └── hello-world.controller.ts
│   ├── client/                           # React pages + hooks (user app)
│   │   ├── index.ts                      # barrel: createHelloWorldRoutes, etc.
│   │   ├── routes.ts                     # route factories
│   │   ├── pages/
│   │   │   ├── index.ts
│   │   │   └── hello-world-card.tsx
│   │   └── hooks/
│   │       ├── index.ts
│   │       └── use-hello-world.ts
│   ├── admin/                            # Admin pages + routes
│   │   ├── index.ts                      # barrel: createHelloWorldAdminRoutes, etc.
│   │   ├── routes.ts
│   │   └── pages/
│   │       ├── index.ts
│   │       └── hello-world-admin.tsx
│   └── common/                           # Shared types (server <-> client)
│       └── types.ts
├── dev/                                  # Dev harness (standalone execution)
│   └── server.ts
└── tests/
    └── server/
        └── hello-world.service.spec.ts
```

### Source mapping (boilerplate -> package)

| Boilerplate Location | Package Location |
|---------------------|-----------------|
| `packages/features-server/features/hello-world/` | `features/hello-world/src/server/` |
| `apps/features-app/src/features/hello-world/` | `features/hello-world/src/client/` |
| `apps/feature-admin/src/features/hello-world/` | `features/hello-world/src/admin/` |
| (no schema) | (no `src/schema/`) |

### Import transformations applied during migration

| Boilerplate Import | Package Import |
|-------------------|---------------|
| `../../../core/trpc` | `@superbuilder/core-trpc` |
| `@/lib/trpc` | `@superbuilder/core-trpc` (for `useTRPC`) |
| `@/lib/trpc` | (removed for `API_URL` — admin page uses different pattern) |

---

## Chunk 1: Feature Package Structure & Server Migration

### Task 1: Create feature package config files

**Files:**
- Create: `features/hello-world/package.json`
- Create: `features/hello-world/tsconfig.json`
- Create: `features/hello-world/feature.json`

- [ ] **Step 1: Create `features/hello-world/package.json`**

```json
{
  "name": "@superbuilder/feature-hello-world",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/server/index.ts",
    "./client": "./src/client/index.ts",
    "./admin": "./src/admin/index.ts",
    "./common": "./src/common/types.ts"
  },
  "scripts": {
    "dev": "bun run dev/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@nestjs/common": ">=11.0.0",
    "@nestjs/core": ">=11.0.0",
    "@nestjs/swagger": ">=11.0.0",
    "@tanstack/react-query": ">=5.0.0",
    "@tanstack/react-router": ">=1.0.0",
    "@trpc/server": ">=11.0.0",
    "react": ">=19.0.0",
    "react-dom": ">=19.0.0",
    "zod": ">=3.0.0"
  },
  "dependencies": {
    "@superbuilder/core-trpc": "workspace:*",
    "@superbuilder/core-ui": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@trpc/server": "^11.0.0",
    "@types/react": "^19.0.0",
    "lucide-react": "^0.400.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0",
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 2: Create `features/hello-world/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "dev", "tests"]
}
```

- [ ] **Step 3: Create `features/hello-world/feature.json`**

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "type": "page",
  "group": "template",
  "icon": "Sparkles",
  "description": "Template feature demonstrating server + client + admin integration",

  "dependencies": [],
  "optionalDependencies": [],

  "provides": {
    "server": {
      "module": "HelloWorldModule",
      "router": "helloWorldRouter",
      "routerKey": "helloWorld"
    },
    "client": {
      "routes": "createHelloWorldRoutes"
    },
    "admin": {
      "routes": "createHelloWorldAdminRoutes",
      "menu": {
        "label": "Hello World",
        "icon": "Sparkles",
        "order": 100
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/bright/Projects/superbuilder-features
git add features/hello-world/package.json features/hello-world/tsconfig.json features/hello-world/feature.json
git commit -m "feat(hello-world): add package config and feature.json manifest"
```

---

### Task 2: Migrate server — service and types

**Files:**
- Create: `features/hello-world/src/server/service/hello-world.service.ts`
- Create: `features/hello-world/src/server/service/index.ts`
- Create: `features/hello-world/src/common/types.ts`

- [ ] **Step 1: Create `features/hello-world/src/server/service/hello-world.service.ts`**

Copied from boilerplate — no import changes needed (only uses `@nestjs/common`).

```typescript
/**
 * Hello World Feature - Service
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class HelloWorldService {
	async sayHello(): Promise<string> {
		return "Hello World from Server! 🚀";
	}

	async getGreeting(name: string): Promise<string> {
		return `Hello, ${name}! Welcome to Feature Atlas.`;
	}
}
```

- [ ] **Step 2: Create `features/hello-world/src/server/service/index.ts`**

```typescript
export { HelloWorldService } from "./hello-world.service";
```

- [ ] **Step 3: Create `features/hello-world/src/common/types.ts`** (신규 작성 — 기존 boilerplate에 없던 공유 타입 파일)

```typescript
/**
 * Hello World Feature - Shared Types
 * NOTE: 기존 boilerplate에서 마이그레이션한 것이 아니라,
 *       feature-json 패키지 구조에 맞춰 새로 작성하는 파일입니다.
 */

export interface HelloResponse {
	message: string;
}

export interface GreetInput {
	name: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add features/hello-world/src/server/service/ features/hello-world/src/common/
git commit -m "feat(hello-world): add service and shared types"
```

---

### Task 3: Migrate server — controller

**Files:**
- Create: `features/hello-world/src/server/controller/hello-world.controller.ts`
- Create: `features/hello-world/src/server/controller/index.ts`

- [ ] **Step 1: Create `features/hello-world/src/server/controller/hello-world.controller.ts`**

Copied from boilerplate — no import changes needed (uses NestJS + Swagger only).

```typescript
/**
 * Hello World Feature - Controller
 */

import { Controller, Get, Query } from "@nestjs/common";
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiQuery,
} from "@nestjs/swagger";
import { HelloWorldService } from "../service/hello-world.service";

@ApiTags("Hello World")
@Controller("hello-world")
export class HelloWorldController {
	constructor(private readonly helloWorldService: HelloWorldService) {}

	@Get()
	@ApiOperation({ summary: "Hello 메시지 조회" })
	@ApiResponse({ status: 200, description: "Hello 메시지 반환" })
	sayHello() {
		return this.helloWorldService.sayHello();
	}

	@Get("greet")
	@ApiOperation({ summary: "이름으로 인사" })
	@ApiQuery({ name: "name", required: false, description: "인사할 이름", example: "World" })
	@ApiResponse({ status: 200, description: "인사 메시지 반환" })
	greet(@Query("name") name: string = "World") {
		return this.helloWorldService.getGreeting(name);
	}
}
```

- [ ] **Step 2: Create `features/hello-world/src/server/controller/index.ts`**

```typescript
export { HelloWorldController } from "./hello-world.controller";
```

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/src/server/controller/
git commit -m "feat(hello-world): add controller"
```

---

### Task 4: Migrate server — tRPC router (import transformation)

**Files:**
- Create: `features/hello-world/src/server/hello-world.router.ts`

- [ ] **Step 1: Create `features/hello-world/src/server/hello-world.router.ts`**

**Key change**: Import `publicProcedure` and `router` from `@superbuilder/core-trpc` instead of the boilerplate's relative path `../../../core/trpc`.

```typescript
/**
 * Hello World Feature - tRPC Router
 *
 * Import changed: ../../../core/trpc -> @superbuilder/core-trpc
 */

import { publicProcedure, router } from "@superbuilder/core-trpc";
import { z } from "zod";

export const helloWorldRouter = router({
	hello: publicProcedure.query(() => {
		return { message: "Hello from tRPC!" };
	}),

	greet: publicProcedure.input(z.object({ name: z.string() })).query(({ input }) => {
		return { message: `Hello, ${input.name}!` };
	}),
});
```

- [ ] **Step 2: Verify the import change**

Compare:
- Before: `import { publicProcedure, router } from "../../../core/trpc";`
- After: `import { publicProcedure, router } from "@superbuilder/core-trpc";`

This is the core of the Core Contract pattern — feature code depends on the contract interface, not on the boilerplate's internal structure.

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/src/server/hello-world.router.ts
git commit -m "feat(hello-world): add tRPC router with @superbuilder/core-trpc import"
```

---

### Task 5: Migrate server — module and barrel export

**Files:**
- Create: `features/hello-world/src/server/hello-world.module.ts`
- Create: `features/hello-world/src/server/index.ts`

- [ ] **Step 1: Create `features/hello-world/src/server/hello-world.module.ts`**

```typescript
/**
 * Hello World Feature - NestJS Module
 */

import { Module } from "@nestjs/common";
import { HelloWorldController } from "./controller/hello-world.controller";
import { HelloWorldService } from "./service/hello-world.service";

@Module({
	controllers: [HelloWorldController],
	providers: [HelloWorldService],
	exports: [HelloWorldService],
})
export class HelloWorldModule {}
```

- [ ] **Step 2: Create `features/hello-world/src/server/index.ts`**

```typescript
/**
 * Hello World Feature - Server Entry Point
 *
 * This is the default export (package.json ".": "./src/server/index.ts")
 */

export { HelloWorldModule } from "./hello-world.module";
export { helloWorldRouter } from "./hello-world.router";
export { HelloWorldService } from "./service";
export { HelloWorldController } from "./controller";
```

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/src/server/hello-world.module.ts features/hello-world/src/server/index.ts
git commit -m "feat(hello-world): add NestJS module and server barrel export"
```

---

### Task 6: Add service unit test

**Files:**
- Create: `features/hello-world/tests/server/hello-world.service.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { HelloWorldService } from "../../src/server/service/hello-world.service";

describe("HelloWorldService", () => {
	const service = new HelloWorldService();

	it("returns hello message", async () => {
		const result = await service.sayHello();
		expect(result).toContain("Hello World");
	});

	it("returns greeting with name", async () => {
		const result = await service.getGreeting("Alice");
		expect(result).toContain("Alice");
	});

	it("returns greeting with empty name", async () => {
		const result = await service.getGreeting("");
		expect(result).toBe("Hello, ! Welcome to Feature Atlas.");
	});
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/bright/Projects/superbuilder-features
bun test features/hello-world/tests/server/hello-world.service.spec.ts
```

Expected: 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/tests/
git commit -m "test(hello-world): add service unit tests"
```

---

## Chunk 2: Client & Admin Migration + Dev Harness

### Task 7: Migrate client — hooks (import transformation)

**Files:**
- Create: `features/hello-world/src/client/hooks/use-hello-world.ts`
- Create: `features/hello-world/src/client/hooks/index.ts`

- [ ] **Step 1: Create `features/hello-world/src/client/hooks/use-hello-world.ts`**

**Key change**: Import `useTRPC` from `@superbuilder/core-trpc` instead of `@/lib/trpc` (app-local). The Core Contract `@superbuilder/core-trpc` package will expose a `useTRPC` hook stub during dev; at scaffold time this import is rewritten to the real app's tRPC client.

> **Note**: The boilerplate's `@/lib/trpc` is an app-local module. In the feature package, we use `@superbuilder/core-trpc` which provides the same `useTRPC` interface. The import transformer in Plan B maps this to the correct app-local path at scaffold time.

```typescript
/**
 * Hello World Hook - tRPC
 *
 * Import changed: @/lib/trpc -> @superbuilder/core-trpc
 */
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@superbuilder/core-trpc";

export function useHelloWorld() {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(trpc.helloWorld.hello.queryOptions());

	return {
		message: data?.message ?? "",
		loading: isLoading,
	};
}
```

- [ ] **Step 2: Create `features/hello-world/src/client/hooks/index.ts`**

```typescript
export { useHelloWorld } from "./use-hello-world";
```

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/src/client/hooks/
git commit -m "feat(hello-world): add client hooks with @superbuilder/core-trpc import"
```

---

### Task 8: Migrate client — pages and routes

**Files:**
- Create: `features/hello-world/src/client/pages/hello-world-card.tsx`
- Create: `features/hello-world/src/client/pages/index.ts`
- Create: `features/hello-world/src/client/routes.ts`
- Create: `features/hello-world/src/client/index.ts`

- [ ] **Step 1: Create `features/hello-world/src/client/pages/hello-world-card.tsx`**

No import changes needed — uses only local hook import.

> **Note**: boilerplate 원본은 한국어 + 이모지(`✨ Hello World Feature`)를 사용하지만, feature 패키지는 다국어/다문화 환경에서 재사용되므로 의도적으로 영문으로 간소화했습니다.

```tsx
/**
 * Hello World Card Component
 */
import { useHelloWorld } from "../hooks";

export function HelloWorldCard() {
	const { message, loading } = useHelloWorld();

	return (
		<div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-6">
			<h2 className="mb-4 text-2xl font-bold text-white">Hello World Feature</h2>
			<p className="text-gray-300">{loading ? "Loading..." : message}</p>
			<div className="mt-4 text-sm text-gray-500">
				This component demonstrates the full feature lifecycle (server, client, admin).
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Create `features/hello-world/src/client/pages/index.ts`**

```typescript
export { HelloWorldCard } from "./hello-world-card";
```

- [ ] **Step 3: Create `features/hello-world/src/client/routes.ts`**

No import changes needed — uses only TanStack Router and local components.

```typescript
/**
 * Hello World Feature - Client Routes
 */
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { HelloWorldCard } from "./pages/hello-world-card";

export const HELLO_WORLD_PATH = "/hello-world";

export const createHelloWorldRoute = <T extends AnyRoute>(parentRoute: T) =>
	createRoute({
		getParentRoute: () => parentRoute,
		path: HELLO_WORLD_PATH,
		component: HelloWorldCard,
	});

export function createHelloWorldRoutes<T extends AnyRoute>(parentRoute: T) {
	return [createHelloWorldRoute(parentRoute)];
}
```

- [ ] **Step 4: Create `features/hello-world/src/client/index.ts`**

```typescript
/**
 * Hello World Feature - Client Entry Point
 *
 * package.json "./client": "./src/client/index.ts"
 *
 * NOTE: 공유 타입은 "./common" entrypoint (package.json "./common")을 통해
 * 접근합니다. client barrel에서 types를 re-export하지 않는 것은 의도된 설계입니다.
 * 이유: entrypoint별 관심사 분리 (client = UI/라우트, common = 공유 타입)
 */

export * from "./routes";
export * from "./pages";
export * from "./hooks";
```

- [ ] **Step 5: Commit**

```bash
git add features/hello-world/src/client/
git commit -m "feat(hello-world): add client pages, routes, and barrel export"
```

---

### Task 9: Migrate admin — pages and routes

**Files:**
- Create: `features/hello-world/src/admin/pages/hello-world-admin.tsx`
- Create: `features/hello-world/src/admin/pages/index.ts`
- Create: `features/hello-world/src/admin/routes.ts`
- Create: `features/hello-world/src/admin/index.ts`

- [ ] **Step 1: Create `features/hello-world/src/admin/pages/hello-world-admin.tsx`**

**Key change**: The boilerplate admin page imports `API_URL` from `@/lib/trpc` and makes raw fetch calls. In the feature package, we use a local constant for the API URL pattern, making it configurable via the dev harness.

> **Note**: boilerplate 원본의 하단 "tRPC React Query Info" 안내 블록은 의도적으로 생략했습니다. 해당 블록은 boilerplate 사용법 안내이며 feature 패키지에서는 불필요합니다.

```tsx
/**
 * Hello World Admin Page
 *
 * Demonstrates REST API + tRPC connectivity testing.
 * Import changed: @/lib/trpc (API_URL) -> local constant
 */
import { useEffect, useState } from "react";
import { Globe, RefreshCw, Server, Sparkles, Zap } from "lucide-react";

/** Default API URL — overridden by dev harness or scaffold config */
const DEFAULT_API_URL = "http://localhost:3002";
const REST_API_URL = `${DEFAULT_API_URL}/api`;
const TRPC_URL = `${DEFAULT_API_URL}/trpc`;

async function trpcQuery<T>(procedure: string, input?: unknown): Promise<T> {
	const url = new URL(`${TRPC_URL}/${procedure}`);
	if (input !== undefined) {
		url.searchParams.set("input", JSON.stringify(input));
	}
	const res = await fetch(url.toString());
	const json = await res.json();
	if (json.error) {
		throw new Error(json.error.message || "tRPC Error");
	}
	return json.result.data;
}

interface ApiState {
	rest: { hello: string | null; greet: string | null };
	trpc: { hello: string | null; greet: string | null };
	loading: boolean;
	error: string | null;
}

/**
 * NOTE: 이 Admin 페이지는 REST API와 tRPC를 동시에 raw fetch로 테스트하는
 * 특수 목적 컴포넌트입니다. 일반 feature UI와 달리 tRPC client 없이 동작해야
 * 하므로 useEffect + useState 패턴을 의도적으로 사용합니다.
 * 또한 feature 패키지 내부이므로 @repo/ui (shadcn) 접근이 불가하여
 * HTML 엘리먼트를 직접 사용합니다.
 */
function useHelloWorldApi() {
	const [state, setState] = useState<ApiState>({
		rest: { hello: null, greet: null },
		trpc: { hello: null, greet: null },
		loading: true,
		error: null,
	});

	const fetchData = async () => {
		setState((prev) => ({ ...prev, loading: true, error: null }));

		try {
			const [restHello, restGreet, trpcHello, trpcGreet] = await Promise.all([
				fetch(`${REST_API_URL}/hello-world`).then((res) => res.text()),
				fetch(`${REST_API_URL}/hello-world/greet?name=Admin`).then((res) => res.text()),
				trpcQuery<{ message: string }>("helloWorld.hello"),
				trpcQuery<{ message: string }>("helloWorld.greet", { name: "Admin" }),
			]);

			setState({
				rest: { hello: restHello, greet: restGreet },
				trpc: { hello: trpcHello.message, greet: trpcGreet.message },
				loading: false,
				error: null,
			});
		} catch (err) {
			setState((prev) => ({
				...prev,
				loading: false,
				error: err instanceof Error ? err.message : "Failed to fetch",
			}));
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	return { ...state, refetch: fetchData };
}

export function HelloWorldAdmin() {
	const { rest, trpc, loading, error, refetch } = useHelloWorldApi();

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="size-5" />
					<h1 className="text-xl font-bold">Hello World</h1>
				</div>
				<button
					type="button"
					onClick={refetch}
					disabled={loading}
					className="hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
				>
					<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
					Refresh
				</button>
			</div>

			<p className="text-muted-foreground">Server API connectivity test (REST API + tRPC)</p>

			{error ? (
				<div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4">
					<p className="text-sm font-medium">Error: {error}</p>
					<p className="text-muted-foreground mt-1 text-xs">Make sure the server is running</p>
				</div>
			) : null}

			<div className="space-y-4">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<Server className="size-4" />
					REST API (/api/hello-world)
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-lg border p-4">
						<div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
							<Globe className="size-3" />
							GET /api/hello-world
						</div>
						{loading ? (
							<div className="bg-muted h-6 w-48 animate-pulse rounded" />
						) : (
							<p className="font-mono text-sm">{rest.hello ?? "No response"}</p>
						)}
					</div>
					<div className="rounded-lg border p-4">
						<div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
							<Globe className="size-3" />
							GET /api/hello-world/greet?name=Admin
						</div>
						{loading ? (
							<div className="bg-muted h-6 w-48 animate-pulse rounded" />
						) : (
							<p className="font-mono text-sm">{rest.greet ?? "No response"}</p>
						)}
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<Zap className="size-4" />
					tRPC (/trpc/helloWorld)
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-lg border p-4">
						<div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
							<Zap className="size-3" />
							helloWorld.hello
						</div>
						{loading ? (
							<div className="bg-muted h-6 w-48 animate-pulse rounded" />
						) : (
							<p className="font-mono text-sm">{trpc.hello ?? "No response"}</p>
						)}
					</div>
					<div className="rounded-lg border p-4">
						<div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
							<Zap className="size-3" />
							{`helloWorld.greet({ name: "Admin" })`}
						</div>
						{loading ? (
							<div className="bg-muted h-6 w-48 animate-pulse rounded" />
						) : (
							<p className="font-mono text-sm">{trpc.greet ?? "No response"}</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Create `features/hello-world/src/admin/pages/index.ts`**

```typescript
export { HelloWorldAdmin } from "./hello-world-admin";
```

- [ ] **Step 3: Create `features/hello-world/src/admin/routes.ts`**

```typescript
/**
 * Hello World Feature - Admin Routes
 */
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { HelloWorldAdmin } from "./pages/hello-world-admin";

export const HELLO_WORLD_ADMIN_PATH = "/hello-world";

export const createHelloWorldAdminRoute = <T extends AnyRoute>(parentRoute: T) =>
	createRoute({
		getParentRoute: () => parentRoute,
		path: HELLO_WORLD_ADMIN_PATH,
		component: HelloWorldAdmin,
	});

export function createHelloWorldAdminRoutes<T extends AnyRoute>(parentRoute: T) {
	return [createHelloWorldAdminRoute(parentRoute)];
}
```

- [ ] **Step 4: Create `features/hello-world/src/admin/index.ts`**

```typescript
/**
 * Hello World Feature - Admin Entry Point
 *
 * package.json "./admin": "./src/admin/index.ts"
 *
 * NOTE: 공유 타입은 "./common" entrypoint를 통해 접근 (client barrel과 동일 설계)
 */

export * from "./routes";
export * from "./pages";
```

- [ ] **Step 5: Commit**

```bash
git add features/hello-world/src/admin/
git commit -m "feat(hello-world): add admin pages, routes, and barrel export"
```

---

### Task 10: Add dev harness (standalone server)

**Files:**
- Create: `features/hello-world/dev/server.ts`

- [ ] **Step 1: Create `features/hello-world/dev/server.ts`**

This is the dev harness from spec Section 6 — runs the feature as a standalone NestJS server with mock DB and auth from `@superbuilder/dev-kit`.

```typescript
/**
 * Hello World Feature - Dev Server
 *
 * Runs the feature standalone with mock dependencies.
 * Usage: bun run dev/server.ts
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { HelloWorldModule } from "../src/server";
import { createMockDbModule } from "@superbuilder/dev-kit/db";
import { createMockAuthModule } from "@superbuilder/dev-kit/auth";

@Module({
	imports: [
		createMockDbModule(),
		createMockAuthModule(),
		HelloWorldModule,
	],
})
class DevAppModule {}

async function bootstrap() {
	const app = await NestFactory.create(DevAppModule);
	app.setGlobalPrefix("api");
	await app.listen(4000);
	console.log("Hello World feature dev server: http://localhost:4000");
	console.log("  REST: http://localhost:4000/api/hello-world");
}

bootstrap();
```

- [ ] **Step 2: Create `features/hello-world/dev/app.tsx`**

스펙 Section 6에서 정의한 클라이언트 dev harness — `DevShell`을 통해 feature의 클라이언트 라우트를 독립 실행합니다.

```tsx
/**
 * Hello World Feature - Dev Client App
 *
 * Runs the feature client standalone with DevShell.
 * Usage: bun run dev/app.tsx
 */
import { createRoot } from "react-dom/client";
import { createHelloWorldRoutes } from "../src/client";
import { DevShell } from "@superbuilder/dev-kit/ui";

createRoot(document.getElementById("root")!).render(
	<DevShell
		apiUrl="http://localhost:4000"
		routes={(root) => createHelloWorldRoutes(root)}
		mockUser={{ id: "dev-user", name: "Developer", role: "admin" }}
	/>,
);
```

- [ ] **Step 3: Commit**

```bash
git add features/hello-world/dev/
git commit -m "feat(hello-world): add dev harness (server + client) for standalone execution"
```

---

### Task 11: Register feature in workspace and verify

**Files:**
- Modify: (none — features/hello-world is auto-included via workspace glob `features/*`)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/bright/Projects/superbuilder-features
bun install
```

Expected: Package resolves and installs without errors. The workspace glob `features/*` in root `package.json` already includes the new package.

- [ ] **Step 2: Verify workspace resolution**

```bash
bun pm ls 2>/dev/null | grep "feature-hello-world"
```

Expected: `@superbuilder/feature-hello-world` appears in the workspace list

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/bright/Projects/superbuilder-features
cd features/hello-world && bun run typecheck
```

Expected: No errors (or only warnings from stub types in core packages)

- [ ] **Step 4: Run tests**

```bash
cd /Users/bright/Projects/superbuilder-features/features/hello-world
bun test
```

Expected: 3 service tests pass

- [ ] **Step 5: Commit any lockfile changes**

```bash
cd /Users/bright/Projects/superbuilder-features
git add bun.lock
git commit -m "chore: update lockfile for hello-world feature"
```

---

### Task 12: Update superbuilder submodule pointer

**Files:**
- Modify: `/Users/bright/Projects/superbuilder/features` (submodule pointer)

- [ ] **Step 1: Push hello-world to superbuilder-features remote**

```bash
cd /Users/bright/Projects/superbuilder-features
git push origin main
```

- [ ] **Step 2: Update submodule pointer in superbuilder**

```bash
cd /Users/bright/Projects/superbuilder
git checkout develop || git checkout -b develop
cd features
git pull origin main
cd ..
```

- [ ] **Step 3: Verify hello-world is accessible from superbuilder**

```bash
cd /Users/bright/Projects/superbuilder
echo 'import { HelloWorldModule } from "@superbuilder/feature-hello-world"; console.log(typeof HelloWorldModule);' | bun run -
```

Expected: Output `function`

- [ ] **Step 4: Commit submodule update**

```bash
cd /Users/bright/Projects/superbuilder
git add features
git commit -m "feat: update superbuilder-features submodule with hello-world feature"
```

---

### Task 13: Verify feature.json can be scanned (integration check)

**Files:** (no new files — verification only)

- [ ] **Step 1: Verify feature.json is readable**

```bash
cd /Users/bright/Projects/superbuilder-features
cat features/hello-world/feature.json | bun -e "const m = JSON.parse(await Bun.stdin.text()); console.log('id:', m.id, 'type:', m.type, 'provides:', Object.keys(m.provides).join(', '));"
```

Expected: `id: hello-world type: page provides: server, client, admin`

- [ ] **Step 2: Verify package exports resolve**

```bash
cd /Users/bright/Projects/superbuilder-features

# Server entry
echo 'import { HelloWorldModule, helloWorldRouter } from "@superbuilder/feature-hello-world"; console.log("server OK");' | bun run -

# Client entry
echo 'import { createHelloWorldRoutes } from "@superbuilder/feature-hello-world/client"; console.log("client OK");' | bun run -

# Admin entry
echo 'import { createHelloWorldAdminRoutes } from "@superbuilder/feature-hello-world/admin"; console.log("admin OK");' | bun run -
```

Expected: All three print "OK"

- [ ] **Step 3: Final verification summary**

Verify these are all true:
- `features/hello-world/feature.json` exists with correct `provides` ✓
- `features/hello-world/package.json` has multi-entrypoint exports ✓
- Server code uses `@superbuilder/core-trpc` (not relative path) ✓
- Client hook uses `@superbuilder/core-trpc` (not `@/lib/trpc`) ✓
- Admin page uses local API_URL constant (not `@/lib/trpc`) ✓
- Unit tests pass ✓
- Typecheck passes ✓
- Package is accessible from both `superbuilder-features` and `superbuilder` (via submodule) ✓

- [ ] **Step 4: Push all changes**

```bash
cd /Users/bright/Projects/superbuilder-features
git push origin main

cd /Users/bright/Projects/superbuilder
git push origin develop
```
