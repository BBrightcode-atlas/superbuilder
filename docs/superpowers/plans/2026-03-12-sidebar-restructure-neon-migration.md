# Sidebar Restructure + Neon Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the atlas sidebar into Features/Builders sections and replace Supabase with Neon for DB project creation in the Composer pipeline.

**Architecture:** Two independent changes: (1) sidebar UI restructure — pure frontend, no backend impact; (2) Supabase→Neon swap — replace tRPC router, setup UI, composer mutations, deployments deletion logic, and local-db schema columns.

**Tech Stack:** TanStack Router, Electron tRPC (IPC), Neon REST API (`https://console.neon.tech/api/v2/`), Drizzle ORM (SQLite local-db)

---

## Chunk 1: Sidebar Restructure

### Task 1: Restructure AtlasSidebar into two sections

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/AtlasSidebar.tsx`

- [ ] **Step 1: Update AtlasSidebar to grouped sections**

Replace the flat `NAV_ITEMS` array with section-based rendering:

```tsx
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
  HiOutlineCube,
  HiOutlineWrenchScrewdriver,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
} from "react-icons/hi2";

interface NavSection {
  title: string;
  items: ReadonlyArray<{ to: string; label: string; icon: IconType }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Features",
    items: [
      { to: "/atlas/catalog", label: "Catalog", icon: HiOutlineCube as IconType },
      { to: "/atlas/studio", label: "Studio", icon: HiOutlineSparkles as IconType },
    ],
  },
  {
    title: "Builders",
    items: [
      { to: "/atlas/composer", label: "Composer", icon: HiOutlineWrenchScrewdriver as IconType },
      { to: "/atlas/deployments", label: "Deployments", icon: HiOutlineRocketLaunch as IconType },
    ],
  },
];

export function AtlasSidebar() {
  const location = useLocation();

  return (
    <div className="w-52 border-r border-border bg-muted/30 flex flex-col">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="p-4 pb-1 pt-3 first:pt-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h2>
          </div>
          <nav className="px-2 pb-2 space-y-0.5">
            {section.items.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in `AtlasSidebar.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/AtlasSidebar.tsx
git commit -m "refactor(atlas): restructure sidebar into Features and Builders sections"
```

---

## Chunk 2: Local DB Schema — Supabase → Neon columns

### Task 2: Update atlasProjects and atlasIntegrations schema

**Files:**
- Modify: `packages/local-db/src/schema/atlas.ts`

- [ ] **Step 1: Replace Supabase columns with Neon columns**

In `atlasProjects` table:
- `supabaseProjectId` → `neonProjectId`
- `supabaseProjectUrl` → `neonConnectionString`

In `atlasIntegrations` table:
- Service type: `"supabase" | "vercel"` → `"neon" | "vercel"`

```ts
// In atlasProjects table definition, replace:
//   supabaseProjectId: text("supabase_project_id"),
//   supabaseProjectUrl: text("supabase_project_url"),
// With:
    neonProjectId: text("neon_project_id"),
    neonConnectionString: text("neon_connection_string"),
```

```ts
// In atlasIntegrations table definition, replace:
//   service: text("service").$type<"supabase" | "vercel">().notNull().unique(),
// With:
    service: text("service").$type<"neon" | "vercel">().notNull().unique(),
```

- [ ] **Step 2: Verify build**

Run: `cd packages/local-db && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors (downstream consumers will break — fixed in subsequent tasks)

- [ ] **Step 3: Commit**

```bash
git add packages/local-db/src/schema/atlas.ts
git commit -m "refactor(local-db): rename Supabase columns to Neon in atlasProjects schema"
```

---

## Chunk 3: Neon tRPC Router (replacing Supabase)

### Task 3: Create neon.ts tRPC router

**Files:**
- Create: `apps/desktop/src/lib/trpc/routers/atlas/neon.ts`
- Delete: `apps/desktop/src/lib/trpc/routers/atlas/supabase.ts`

- [ ] **Step 1: Create neon.ts**

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicProcedure, router } from "../..";
import { localDb } from "main/lib/local-db";
import { atlasIntegrations, atlasProjects } from "@superset/local-db";
import { encrypt, decrypt } from "../auth/utils/crypto-storage";

const NEON_API = "https://console.neon.tech/api/v2";

async function getNeonApiKey(): Promise<string> {
	const envKey = process.env.NEON_API_KEY;
	if (envKey) return envKey;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, "neon"));
	if (!integration) throw new Error("Neon API key not configured");
	return decrypt(integration.encryptedToken);
}

async function neonFetch(path: string, options: RequestInit = {}) {
	const apiKey = await getNeonApiKey();
	const res = await fetch(`${NEON_API}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Neon API error (${res.status}): ${body}`);
	}
	return res.json();
}

export const createAtlasNeonRouter = () =>
	router({
		saveToken: publicProcedure
			.input(z.object({ token: z.string().min(1) }))
			.mutation(async ({ input }) => {
				// Verify token by calling /projects
				try {
					const res = await fetch(`${NEON_API}/projects?limit=1`, {
						headers: { Authorization: `Bearer ${input.token}` },
					});
					if (!res.ok) throw new Error("Invalid token");
				} catch {
					throw new Error("토큰 검증 실패: Neon에 연결할 수 없습니다");
				}

				const encrypted = encrypt(input.token);

				await localDb
					.delete(atlasIntegrations)
					.where(eq(atlasIntegrations.service, "neon"));

				await localDb.insert(atlasIntegrations).values({
					service: "neon",
					encryptedToken: encrypted,
				});

				return { success: true };
			}),

		removeToken: publicProcedure.mutation(async () => {
			await localDb
				.delete(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "neon"));
			return { success: true };
		}),

		getConnectionStatus: publicProcedure.query(async () => {
			if (process.env.NEON_API_KEY) return { connected: true };
			const [integration] = await localDb
				.select()
				.from(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "neon"));
			return { connected: !!integration };
		}),

		listOrganizations: publicProcedure.query(async () => {
			const data = await neonFetch("/organizations");
			return (data.organizations ?? data ?? []) as Array<{
				id: string;
				name: string;
			}>;
		}),

		createProject: publicProcedure
			.input(
				z.object({
					name: z.string().min(1),
					orgId: z.string().optional(),
					atlasProjectId: z.string().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				const body: Record<string, unknown> = {
					project: { name: input.name },
				};
				if (input.orgId) {
					body.project = { ...body.project as object, org_id: input.orgId };
				}

				const data = await neonFetch("/projects", {
					method: "POST",
					body: JSON.stringify(body),
				});

				const project = data.project;
				const connectionUri =
					data.connection_uris?.[0]?.connection_uri ?? "";

				await localDb
					.update(atlasProjects)
					.set({
						neonProjectId: project.id,
						neonConnectionString: connectionUri,
						updatedAt: Date.now(),
					})
					.where(eq(atlasProjects.id, input.atlasProjectId));

				return {
					id: project.id,
					name: project.name,
					connectionUri,
				};
			}),

		getConnectionString: publicProcedure
			.input(z.object({ projectId: z.string().min(1) }))
			.query(async ({ input }) => {
				const data = await neonFetch(
					`/projects/${input.projectId}/connection_uri`,
				);
				return { connectionUri: data.uri as string };
			}),

		writeEnvFile: publicProcedure
			.input(
				z.object({
					projectPath: z.string(),
					connectionUri: z.string(),
					neonProjectId: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const envPath = join(input.projectPath, ".env");
				let existing = "";
				try {
					existing = await readFile(envPath, "utf-8");
				} catch {
					// File doesn't exist yet
				}

				const neonEnv = [
					`DATABASE_URL=${input.connectionUri}`,
					`NEON_PROJECT_ID=${input.neonProjectId}`,
				].join("\n");

				const newContent = existing
					? `${existing}\n\n# Neon (auto-generated by Composer)\n${neonEnv}\n`
					: `# Neon (auto-generated by Composer)\n${neonEnv}\n`;

				await writeFile(envPath, newContent, "utf-8");
				return { envPath };
			}),
	});
```

- [ ] **Step 2: Delete supabase.ts**

```bash
rm apps/desktop/src/lib/trpc/routers/atlas/supabase.ts
```

- [ ] **Step 3: Verify build**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in files still referencing `supabase` — fixed in next tasks

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/trpc/routers/atlas/neon.ts
git add apps/desktop/src/lib/trpc/routers/atlas/supabase.ts
git commit -m "feat(atlas): add Neon tRPC router, remove Supabase router"
```

---

### Task 4: Update atlas tRPC router index

**Files:**
- Modify: `apps/desktop/src/lib/trpc/routers/atlas/index.ts`

- [ ] **Step 1: Replace supabase with neon**

```ts
import { router } from "../..";
import { createAtlasComposerRouter } from "./composer";
import { createAtlasDeploymentsRouter } from "./deployments";
import { createAtlasFeatureStudioRouter } from "./feature-studio";
import { createAtlasNeonRouter } from "./neon";
import { createAtlasRegistryRouter } from "./registry";
import { createAtlasResolverRouter } from "./resolver";
import { createAtlasVercelRouter } from "./vercel";

export const createAtlasRouter = () =>
	router({
		registry: createAtlasRegistryRouter(),
		featureStudio: createAtlasFeatureStudioRouter(),
		resolver: createAtlasResolverRouter(),
		composer: createAtlasComposerRouter(),
		deployments: createAtlasDeploymentsRouter(),
		neon: createAtlasNeonRouter(),
		vercel: createAtlasVercelRouter(),
	});
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/lib/trpc/routers/atlas/index.ts
git commit -m "refactor(atlas): wire neon router in atlas tRPC index"
```

---

## Chunk 4: Deployments — Supabase → Neon deletion

### Task 5: Update deployments.ts deletion logic

**Files:**
- Modify: `apps/desktop/src/lib/trpc/routers/atlas/deployments.ts`

- [ ] **Step 1: Replace Supabase deletion with Neon deletion**

In the `delete` procedure, replace the Supabase block with Neon:

```ts
// Replace: if (project.supabaseProjectId) { ... supabase deletion ... }
// With:
if (project.neonProjectId) {
	try {
		const token = await getTokenForService("neon");
		if (token) {
			const res = await fetch(
				`https://console.neon.tech/api/v2/projects/${project.neonProjectId}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				},
			);
			if (!res.ok && res.status !== 404) {
				console.warn(`Neon 프로젝트 삭제 실패 (${res.status})`);
			}
		}
	} catch {
		// Neon 삭제 실패해도 로컬 삭제는 진행
	}
}
```

Also update `getTokenForService`:
- Change `"supabase"` references to `"neon"`
- Change env key from `SUPABASE_ACCESS_TOKEN` to `NEON_API_KEY`

```ts
async function getTokenForService(
	service: "neon" | "vercel",
): Promise<string | null> {
	const envKey = service === "neon" ? "NEON_API_KEY" : "VERCEL_TOKEN";
	const envToken = process.env[envKey];
	if (envToken) return envToken;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, service));
	if (!integration) return null;
	return decrypt(integration.encryptedToken);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/lib/trpc/routers/atlas/deployments.ts
git commit -m "refactor(atlas): replace Supabase with Neon in deployments deletion"
```

---

## Chunk 5: UI Components — NeonSetup + DeploymentCard

### Task 6: Create NeonSetup component (replacing SupabaseSetup)

**Files:**
- Create: `apps/desktop/src/renderer/screens/atlas/components/NeonSetup.tsx`
- Delete: `apps/desktop/src/renderer/screens/atlas/components/SupabaseSetup.tsx`

- [ ] **Step 1: Create NeonSetup.tsx**

```tsx
import { useState, useEffect } from "react";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { LuCheck, LuExternalLink, LuKeyboard } from "react-icons/lu";

interface NeonSetupProps {
	onComplete: (orgId: string, orgName: string) => void;
	onSkip: () => void;
}

export function NeonSetup({ onComplete, onSkip }: NeonSetupProps) {
	const [token, setToken] = useState("");
	const [step, setStep] = useState<"token" | "org">("token");

	const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
		electronTrpc.atlas.neon.getConnectionStatus.useQuery();

	const { data: orgs } =
		electronTrpc.atlas.neon.listOrganizations.useQuery(undefined, {
			enabled: status?.connected === true,
		});

	const saveTokenMutation =
		electronTrpc.atlas.neon.saveToken.useMutation({
			onSuccess: () => {
				refetchStatus();
				setStep("org");
			},
		});

	useEffect(() => {
		if (status?.connected && step === "token") {
			setStep("org");
		}
	}, [status?.connected, step]);

	if (statusLoading) {
		return null;
	}

	if (step === "token" && !status?.connected) {
		return (
			<div className="space-y-4 p-4 rounded-lg border border-border">
				<div className="flex items-center gap-2">
					<LuKeyboard className="size-5 text-primary" />
					<h3 className="text-sm font-semibold">Neon 연결</h3>
				</div>

				<p className="text-xs text-muted-foreground">
					Neon 콘솔에서 API 키를 생성하세요.
				</p>

				<Button
					variant="link"
					size="sm"
					className="p-0 h-auto text-xs"
					onClick={() => {
						window.open(
							"https://console.neon.tech/app/settings/api-keys",
							"_blank",
						);
					}}
				>
					<LuExternalLink className="size-3 mr-1" />
					Neon API 키 페이지 열기
				</Button>

				<div className="flex gap-2">
					<Input
						type="password"
						placeholder="napi_xxxxxxxxxxxxxxxx"
						value={token}
						onChange={(e) => setToken(e.target.value)}
						className="font-mono text-xs"
					/>
					<Button
						size="sm"
						disabled={!token.trim() || saveTokenMutation.isPending}
						onClick={() => saveTokenMutation.mutate({ token: token.trim() })}
					>
						{saveTokenMutation.isPending ? "확인 중..." : "연결"}
					</Button>
				</div>

				{saveTokenMutation.error ? (
					<p className="text-xs text-destructive">
						{saveTokenMutation.error.message}
					</p>
				) : null}

				<div className="flex justify-end">
					<Button variant="ghost" size="sm" onClick={onSkip}>
						나중에 연결
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 p-4 rounded-lg border border-border">
			<div className="flex items-center gap-2">
				<LuCheck className="size-5 text-green-500" />
				<h3 className="text-sm font-semibold">Neon 연결됨</h3>
			</div>

			<p className="text-xs text-muted-foreground">
				프로젝트를 생성할 조직을 선택하세요.
			</p>

			{orgs && orgs.length > 0 ? (
				<div className="space-y-2">
					{orgs.map((org) => (
						<Button
							key={org.id}
							variant="outline"
							onClick={() => onComplete(org.id, org.name)}
							className="w-full justify-start h-auto p-3 text-left"
						>
							<div>
								<p className="text-sm font-medium">{org.name}</p>
							</div>
						</Button>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">
					조직을 불러오는 중...
				</p>
			)}

			<div className="flex justify-end">
				<Button variant="ghost" size="sm" onClick={onSkip}>
					나중에 연결
				</Button>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Delete SupabaseSetup.tsx**

```bash
rm apps/desktop/src/renderer/screens/atlas/components/SupabaseSetup.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/NeonSetup.tsx
git add apps/desktop/src/renderer/screens/atlas/components/SupabaseSetup.tsx
git commit -m "feat(atlas): add NeonSetup component, remove SupabaseSetup"
```

---

### Task 7: Update DeploymentCard — Supabase → Neon display

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/DeploymentCard.tsx`

- [ ] **Step 1: Replace Supabase references with Neon**

Change these sections:

```tsx
// Replace: const hasSupabase = !!project.supabaseProjectId;
const hasNeon = !!project.neonProjectId;

// Replace the Supabase link block:
// {project.supabaseProjectUrl ? ( ... Supabase: ... ) : null}
// With:
{project.neonProjectId ? (
	<a
		href={`https://console.neon.tech/app/projects/${project.neonProjectId}`}
		target="_blank"
		rel="noopener noreferrer"
		className="flex items-center gap-1 text-xs text-primary hover:underline"
	>
		<LuExternalLink className="size-3" />
		Neon: {project.neonProjectId}
	</a>
) : null}

// In the delete dialog warning, replace:
// hasSupabase ? "Supabase" : null,
hasNeon ? "Neon" : null,
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/DeploymentCard.tsx
git commit -m "refactor(atlas): show Neon info instead of Supabase in DeploymentCard"
```

---

## Chunk 6: Composer Page — Supabase → Neon pipeline

### Task 8: Update ComposerStepper label

**Files:**
- Modify: `apps/desktop/src/renderer/screens/atlas/components/ComposerStepper.tsx`

- [ ] **Step 1: Change "Supabase" label to "Neon"**

```tsx
// Replace:
//   { label: "Supabase", description: "데이터베이스 프로젝트 생성" },
// With:
  { label: "Neon", description: "데이터베이스 프로젝트 생성" },
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/ComposerStepper.tsx
git commit -m "refactor(atlas): rename Supabase to Neon in ComposerStepper"
```

---

### Task 9: Update Composer page — swap Supabase mutations for Neon

**Files:**
- Modify: `apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx`

- [ ] **Step 1: Replace imports**

```tsx
// Replace:
// import { SupabaseSetup } from "renderer/screens/atlas/components/SupabaseSetup";
// With:
import { NeonSetup } from "renderer/screens/atlas/components/NeonSetup";
```

- [ ] **Step 2: Replace pipeline step label**

```tsx
// In INITIAL_PIPELINE.steps, replace:
//   { label: "Supabase 프로젝트", status: "pending" },
// With:
  { label: "Neon 프로젝트", status: "pending" },
```

- [ ] **Step 3: Replace mutation hooks**

```tsx
// Remove these 3 lines:
// const supabaseCreateMutation = electronTrpc.atlas.supabase.createProject.useMutation();
// const supabaseHealthMutation = electronTrpc.atlas.supabase.waitForHealthy.useMutation();
// const supabaseWriteEnvMutation = electronTrpc.atlas.supabase.writeEnvFile.useMutation();

// Add these 2 lines:
const neonCreateMutation = electronTrpc.atlas.neon.createProject.useMutation();
const neonWriteEnvMutation = electronTrpc.atlas.neon.writeEnvFile.useMutation();
```

- [ ] **Step 4: Replace handleSupabaseComplete with handleNeonComplete**

```tsx
const handleNeonComplete = async (orgId: string, _orgName: string) => {
	if (!pipeline.result) return;

	setSupabasePhase("creating");
	updateStep(3, "running", "Neon 프로젝트 생성 중...");

	try {
		const neonProject = await neonCreateMutation.mutateAsync({
			name: serviceName,
			orgId,
			atlasProjectId: pipeline.result.projectId,
		});

		// Neon projects are available immediately — no health check needed
		updateStep(3, "running", ".env 파일 작성 중...");
		await neonWriteEnvMutation.mutateAsync({
			projectPath: pipeline.result.targetPath,
			connectionUri: neonProject.connectionUri,
			neonProjectId: neonProject.id,
		});
		updateStep(3, "done", `Neon 프로젝트 ${neonProject.name} 생성 완료`);

		setSupabasePhase("done");
		setVercelPhase("setup");
		updateStep(4, "pending", "Vercel 연결을 설정하세요");
	} catch (error) {
		updateStep(
			3,
			"failed",
			error instanceof Error ? error.message : "Neon 프로젝트 생성 실패",
		);
		setSupabasePhase("done");
		setVercelPhase("setup");
		updateStep(4, "pending", "Vercel 연결을 설정하세요");
	}
};
```

Note: The `supabasePhase` / `setSupabasePhase` state variables can be renamed to `dbPhase` / `setDbPhase` for clarity, but it's optional — they work as-is since they're internal state.

- [ ] **Step 5: Update all Supabase UI references**

Replace in the JSX:
- `handleSupabaseComplete` → `handleNeonComplete`
- `<SupabaseSetup` → `<NeonSetup`
- `"Supabase 연결을 설정하세요"` → `"Neon 연결을 설정하세요"`
- `"Supabase 연결을 다시 설정하세요"` → `"Neon 연결을 다시 설정하세요"`
- `"Supabase 재시도"` → `"Neon 재시도"`

Also rename the state variables for clarity:
- `supabasePhase` → `neonPhase`
- `setSupabasePhase` → `setNeonPhase`

- [ ] **Step 6: Verify build**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx
git commit -m "feat(atlas): replace Supabase with Neon in Composer pipeline"
```

---

## Chunk 7: Final Verification

### Task 10: Full type check and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full project type check**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 2: Search for remaining Supabase references in atlas code**

Run: `grep -ri "supabase" apps/desktop/src/lib/trpc/routers/atlas/ apps/desktop/src/renderer/screens/atlas/ apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/ --include="*.ts" --include="*.tsx" -l`
Expected: No results (all Supabase references replaced)

- [ ] **Step 3: Verify no broken imports**

Run: `grep -r "SupabaseSetup\|supabase\.ts\|createAtlasSupabaseRouter" apps/desktop/src/ --include="*.ts" --include="*.tsx" -l`
Expected: No results

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(atlas): clean up remaining Supabase references"
```

- [ ] **Step 5: Create PR**

```bash
git push -u origin HEAD
gh pr create --title "refactor(atlas): sidebar restructure + Supabase → Neon migration" --body "$(cat <<'EOF'
## Summary

- Restructure atlas sidebar into **Features** (Catalog, Studio) and **Builders** (Composer, Deployments) sections
- Replace Supabase with **Neon** for database project creation in Composer pipeline
- Neon REST API (`console.neon.tech/api/v2/`) for project lifecycle management
- `.env` output: `DATABASE_URL` + `NEON_PROJECT_ID`
- No health check polling needed (Neon projects available immediately)

## Changes

| Area | Change |
|------|--------|
| Sidebar | Two-section grouped layout |
| tRPC | `atlas.supabase` → `atlas.neon` |
| UI | `SupabaseSetup` → `NeonSetup` |
| Composer | Neon mutations, no health polling |
| Deployments | Neon project deletion |
| DeploymentCard | Neon project link |
| Local DB | `supabaseProjectId` → `neonProjectId` |

## Test plan

- [ ] Sidebar displays Features and Builders sections correctly
- [ ] Neon token save + validation works
- [ ] Composer creates Neon project and writes .env
- [ ] Deployment card shows Neon project link
- [ ] Project deletion cleans up Neon project
EOF
)" --base develop
```
