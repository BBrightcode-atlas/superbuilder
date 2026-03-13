# Composer E2E Pipeline Test Plan — Implementation & Execution

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix structural issues, implement missing features, then verify the full Composer E2E pipeline from feature selection to email login success.

**Architecture:** Electron Desktop tRPC → GitHub/Neon/Vercel APIs → Better Auth login

**Tech Stack:** Electron, tRPC, React, SQLite (local-db), Drizzle, Better Auth, Vercel, Neon

---

## Chunk 1: Structural Fixes (구현 완료 — 코드 반영됨)

### Task 1: Agent 완료 대기 게이트 ✅

**문제:** `handleLaunchAgent`가 Agent 실행 즉시 Neon 단계로 자동 전환. Agent가 feature 설치를 완료하기 전에 migration이 실행되면 drizzle 스키마가 없어서 실패.

**수정 내용:**
- [x] `handleLaunchAgent`에서 Neon 자동 전환 제거
- [x] `handleAgentComplete` 핸들러 추가 — 사용자가 "설치 완료 확인" 클릭 시 Neon 진행
- [x] "설치 완료 확인" 버튼 UI 추가 (`agentPhase === "launched" && neonPhase === "idle"`)

**Files modified:**
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx`

---

### Task 2: Random Password + Storage ✅

**수정 내용:**
- [x] `ownerEmail`, `ownerPassword` 컬럼 추가 (`packages/local-db/src/schema/atlas.ts`)
- [x] `ownerPassword` 랜덤 생성 (`crypto.randomUUID().slice(0, 12)`) in `page.tsx`
- [x] `seedOwner`에 `atlasProjectId` 파라미터 추가 (`neon.ts`)
- [x] seed 성공 시 local DB에 `ownerEmail`/`ownerPassword` 저장 (`neon.ts`)
- [x] 하드코딩 `"changeme123!"` → `ownerPassword` 변수로 교체 (`page.tsx`)

**Files modified:**
- `packages/local-db/src/schema/atlas.ts`
- `apps/desktop/src/lib/trpc/routers/atlas/neon.ts`
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx`

---

### Task 3: Password Reveal UI ✅

**수정 내용:**
- [x] `DeploymentCard`에 Owner Email + Password 표시 섹션 추가
- [x] `****` 마스킹 + Eye 아이콘 토글로 reveal
- [x] `LuEye`/`LuEyeOff` 아이콘 import

**Files modified:**
- `apps/desktop/src/renderer/screens/atlas/components/DeploymentCard.tsx`

---

### Task 4: Build Verification

- [ ] **Step 1: TypeScript 빌드 확인**

```bash
cd /Users/bright/Projects/superbuilder && bunx tsc --noEmit -p apps/desktop/tsconfig.json
```

- [ ] **Step 2: Commit all structural fixes**

```bash
git add packages/local-db/src/schema/atlas.ts apps/desktop/src/lib/trpc/routers/atlas/neon.ts apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/composer/page.tsx apps/desktop/src/renderer/screens/atlas/components/DeploymentCard.tsx
git commit -m "feat(desktop): agent completion gate + random owner password + reveal UI"
```

---

## Chunk 2: E2E Pipeline Verification

### Task 5: Pre-flight Checks

- [ ] **Step 1: Verify Electron app builds and runs**

Run: `cd /Users/bright/Projects/superbuilder && bun run dev:desktop` (or check if already running)

- [ ] **Step 2: Verify external service tokens are configured**

Check: Neon API key connected (via Composer settings or env var)
Check: Vercel token connected
Check: GitHub CLI (`gh auth status`) authenticated

- [ ] **Step 3: Verify template exists**

Check: `/tmp/feature-atlas-template/` exists and is a valid git repo with Better Auth setup

- [ ] **Step 4: Verify current user session**

Check: Superbuilder desktop app shows logged-in user with email

---

### Task 6: Execute Full Pipeline — Scaffold + GitHub + Agent

- [ ] **Step 1: Start Composer — select features and configure project**

In Electron: Navigate to Atlas → Composer
Select features: at minimum `auth`
Set project name: `e2e-test-{timestamp}`
Set target path: `/tmp/e2e-test-{timestamp}`
Click Compose

- [ ] **Step 2: Verify CP-1 (Scaffold)**

Check: Pipeline step 0 = "done"
Check: Project directory exists
Check: `.claude/commands/install-features.md` exists
Check: git initialized

- [ ] **Step 3: Verify CP-2 (GitHub Push)**

Check: Pipeline step 1 = "done"
Check: GitHub repo accessible via `gh repo view {owner}/{serviceName}`

- [ ] **Step 4: Verify CP-3 (Feature Install via CLI Agent) — BLOCKING STEP**

**이 단계가 핵심 — Agent 완료까지 대기 필수**

Check: Agent terminal이 열리고 `claude -p` 명령이 실행됨
Check: Agent가 `.claude/commands/install-features.md`를 읽고 feature 복사 시작
Check: 각 feature 디렉토리가 scaffolded 프로젝트에 복사됨
Check: import 경로 수정
Check: `bun install` 성공 (터미널에 에러 없음)
Check: `git add -A && git commit` 성공
Check: `git push origin main` 성공
Check: 터미널에서 Agent 작업 종료 확인

**Agent 완료 후:**
- "설치 완료 확인" 버튼이 보이는지 확인
- 클릭 → Neon 단계로 진행
- Pipeline step 2 = "done"

**CRITICAL:** Agent가 완료되기 전에 Neon 단계로 넘어가면 migration이 실패함.
**CRITICAL:** 프로젝트 파일을 직접 수정하지 않음. 모든 변경은 CLI Agent를 통해서만.

---

### Task 7: Execute Full Pipeline — Neon + Vercel

- [ ] **Step 1: Complete Neon setup (CP-4)**

Select Neon org in UI
Check: Neon project created
Check: .env written with DATABASE_URL, NEON_PROJECT_ID, BETTER_AUTH_SECRET
Check: `drizzle-kit push` migration 성공
Check: Owner seeded with random password
Check: Pipeline step 3 = "done"
Check: 배포 목록에서 Owner email + 마스킹된 password 확인

- [ ] **Step 2: Verify seed in Neon DB**

Use Neon MCP or console to run:
```sql
SELECT id, email, name FROM users LIMIT 5;
SELECT provider_id, account_id FROM accounts LIMIT 5;
SELECT * FROM organizations LIMIT 5;
```

- [ ] **Step 3: Complete Vercel setup (CP-5)**

Select Vercel team in UI
Check: API project created (`{serviceName}-api`, rootDirectory: `apps/atlas-server`)
Check: App project created (`{serviceName}`, rootDirectory: `apps/app`, framework: vite)
Check: API env vars: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, API_URL
Check: App env vars: VITE_API_URL
Check: CORS_ORIGINS on API includes app URL
Check: Git connected to BOTH projects
Check: Pipeline step 4 = "done"

---

### Task 8: Verify Deployment & Login

- [ ] **Step 1: Wait for deployments**

Check Vercel dashboard or use API to confirm both deployments are READY (2-5 min).

- [ ] **Step 2: Verify CP-6 (Deployment Readiness)**

```bash
curl -s -o /dev/null -w "%{http_code}" https://{api-url}/api/auth/ok
curl -s -o /dev/null -w "%{http_code}" https://{app-url}/
```

- [ ] **Step 3: Verify CP-7 (Email Login)**

Navigate to `https://{app-url}` in browser.
Enter superbuilder user email.
Enter generated password (reveal from deployment card Eye icon).
Click login.

Check: Login succeeds (200 response from auth endpoint)
Check: Redirected to dashboard
Check: User info visible

---

### Task 9: Fix Failures & Iterate

Only when previous tasks fail.

- [ ] **Step 1: Diagnose failure**

Common categories:
- Build failure → TypeScript/bundling error
- API error → env vars, DB connection
- Auth error → password hash mismatch, secret mismatch
- CORS error → missing origin
- 404 → wrong route/URL

- [ ] **Step 2: Implement fix in superbuilder codebase (NOT in scaffolded project)**

- [ ] **Step 3: Commit and retry**

```bash
git add -A
git commit -m "fix(desktop): {description}"
```

Clean up previous test artifacts:
```bash
gh repo delete {owner}/{serviceName} --yes
rm -rf /tmp/e2e-test-{timestamp}
```
Delete Neon/Vercel projects via dashboard.

Retry from Task 6.

---

## Completion Criteria

All of these must be true in a single pipeline run:

1. Features selected and scaffold completed
2. GitHub repo created and code pushed
3. CLI Agent installed features — **user confirmed completion before Neon**
4. Neon DB created, migrated, and owner seeded with random password
5. Owner password stored in local DB and shown in deployment card (masked + revealable)
6. Both Vercel projects created with correct env vars
7. Both deployments are live and responding
8. Email login succeeds with seeded credentials
