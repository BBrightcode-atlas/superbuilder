# Composer E2E Pipeline Test Plan

> **For agentic workers:** Use this plan with ralph-loop. Each iteration: run the full pipeline in Electron, verify each checkpoint, fix failures, commit fixes, and retry.

**Goal:** Verify the complete Composer pipeline from feature selection to successful email login on the deployed Vercel app.

**Architecture:** Electron Desktop → tRPC IPC → main process → external APIs (GitHub, Neon, Vercel)

---

## Pre-requisites (Before First Iteration)

### Required Implementation Changes

These changes MUST be implemented before E2E testing can pass. Each item is a code change in the superbuilder repo.

#### P-1: Random Password Generation + Storage

**Current state:** `page.tsx:357` hardcodes `"changeme123!"`. `atlasProjects` schema has no password field.

**Required changes:**

1. **Schema**: Add `ownerPassword` column to `packages/local-db/src/schema/atlas.ts`:
   ```typescript
   ownerPassword: text("owner_password"), // encrypted, generated per project
   ```

2. **page.tsx**: Replace hardcoded password with `crypto.randomUUID().slice(0, 12)` or similar, store in pipeline state, pass to seedOwner, and save to local DB after seed success.

3. **neon.ts seedOwner**: Already accepts `password` param — no change needed.

4. **Local DB update**: After successful seedOwner, update `atlasProjects` with encrypted password.

#### P-2: Password Reveal UI in Project Info

**Required changes:**

1. Project detail/info page: Display owner password as `****` by default.
2. Eye icon toggle to reveal actual password.
3. Read from `atlasProjects.ownerPassword` (decrypt if encrypted).

#### P-3: Verify Template Better Auth Compatibility

**Current state:** Template at `/tmp/feature-atlas-template/` has Better Auth server + client setup. Must verify:

1. `packages/core/auth/server.ts` reads `API_URL` env var for `baseURL`
2. `apps/app/src/lib/auth-client.ts` reads `VITE_API_URL` env var
3. `apps/atlas-server/vercel.json` handles `/api/auth/*` routes correctly for serverless

---

## Test Pipeline Checkpoints

### CP-1: Feature Selection & Scaffold

**Action:** In Composer UI, select features (at minimum: `auth`), set project name and path, click Compose.

**Verify:**
- [ ] Pipeline step 0 shows "done"
- [ ] Project directory created at specified path
- [ ] Template files cloned correctly
- [ ] `.claude/commands/install-features.md` exists with selected features
- [ ] `git init` succeeded (git repo initialized)
- [ ] Local DB `atlas_projects` row created with correct `name`, `localPath`, `features`

**Failure recovery:** If scaffold fails, check template clone logic in `composer.compose` tRPC mutation.

---

### CP-2: GitHub Repository Creation & Push

**Action:** Pipeline automatically creates GitHub repo and pushes.

**Verify:**
- [ ] Pipeline step 1 shows "done"
- [ ] GitHub repo exists at `https://github.com/{owner}/{serviceName}`
- [ ] Repo is private
- [ ] `main` branch has all template files
- [ ] Local DB `atlas_projects.gitRemoteUrl` is set
- [ ] `pipeline.result.gitHubOwner` and `gitHubRepo` are populated

**Failure recovery:** Check `gh` CLI authentication. Verify `pushToGitHub` mutation.

---

### CP-3: Feature Installation via CLI Agent (BLOCKING STEP)

**Action:** Click "Agent 실행" button. Agent opens terminal and runs `install-features.md`.

**CRITICAL FLOW:**
1. Electron creates terminal session via `terminalCreateOrAttach` tRPC
2. Runs `claude -p --dangerously-skip-permissions` with install-features prompt
3. Agent reads `.claude/commands/install-features.md` inside scaffolded project
4. Agent copies feature source dirs, fixes imports, runs `bun install`, commits, pushes
5. **User MUST wait for Agent to complete** before proceeding
6. User clicks "설치 완료 확인" button → pipeline advances to Neon step

**Pre-requisite implementation:** Task 3.5 in the plan — Agent completion confirmation gate. Without this, the pipeline auto-advances to Neon before features are installed, causing migration failure.

**Verify:**
- [ ] Terminal opens in the scaffolded project directory
- [ ] `claude -p` command executes successfully
- [ ] Agent reads `.claude/commands/install-features.md`
- [ ] Features are copied from source directories to correct paths
- [ ] Import paths are fixed (sed/edit operations)
- [ ] `bun install` succeeds (no dependency errors)
- [ ] `git add -A && git commit` succeeds
- [ ] `git push origin main` succeeds
- [ ] Agent terminates or shows completion message
- [ ] User clicks "설치 완료 확인" button
- [ ] Pipeline step 2 shows "done"
- [ ] Pipeline does NOT advance to Neon until confirmation clicked

**Failure recovery:** If agent fails mid-install, check terminal output. Common issues:
- Missing source feature directories
- Import path mismatches
- TypeScript compilation errors after feature injection
- `bun install` dependency resolution failures
- Agent timeout or crash

**CRITICAL:** Do NOT manually edit scaffolded project files. All changes must go through the CLI agent.
**CRITICAL:** Do NOT click "설치 완료 확인" until Agent has pushed to main.

---

### CP-4: Neon Database Setup

**Action:** Select Neon organization, pipeline creates Neon project.

**Verify:**
- [ ] Neon project created with name `{serviceName}`
- [ ] Connection string returned
- [ ] `.env` file written with `DATABASE_URL`, `NEON_PROJECT_ID`, `BETTER_AUTH_SECRET`
- [ ] `drizzle-kit push` succeeds (migration)
- [ ] Owner user seeded: `users`, `accounts`, `organizations`, `members`, `profiles` tables populated
- [ ] Pipeline step 3 shows "done"
- [ ] Local DB `atlas_projects.neonProjectId` and `neonConnectionString` set

**DB verification (post-seed):**
```sql
SELECT * FROM users WHERE email = '{superbuilder_user_email}';
SELECT * FROM accounts WHERE provider_id = 'credential' AND account_id = '{superbuilder_user_email}';
SELECT * FROM organizations;
SELECT * FROM members;
SELECT * FROM profiles WHERE email = '{superbuilder_user_email}';
```

**Failure recovery:**
- Migration failure: Check `packages/drizzle/drizzle.config.ts` path resolution
- Seed failure: Check Better Auth password hashing compatibility (scrypt N=16384, r=16, p=1)
- Connection failure: Verify Neon API key is valid

---

### CP-5: Vercel Dual Project Deployment

**Action:** Select Vercel team, pipeline creates API + App projects.

**Verify:**
- [ ] API project created: `{serviceName}-api` with `rootDirectory: "apps/atlas-server"`
- [ ] API env vars set: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `API_URL`
- [ ] App project created: `{serviceName}` with `rootDirectory: "apps/app"`, framework: vite
- [ ] App env vars set: `VITE_API_URL` pointing to API project URL
- [ ] `CORS_ORIGINS` set on API project (includes both app and api URLs)
- [ ] Git connected to BOTH projects (triggers deployment)
- [ ] Pipeline step 4 shows "done"
- [ ] Local DB `atlas_projects.vercelProjectId` and `vercelUrl` updated

**Failure recovery:**
- Project name conflict: Vercel may add suffix — check `aliases` in response
- Git connection failure: Verify GitHub Integration installed on Vercel account
- Env var already exists: Update logic in `setEnvVars` handles this

---

### CP-6: Deployment Readiness

**Action:** Wait for Vercel deployments to complete (both API and App).

**Verify:**
- [ ] API deployment: `https://{serviceName}-api.vercel.app` returns non-404
- [ ] API health: `GET https://{api-url}/api/health` or similar returns 200
- [ ] API auth endpoint: `GET https://{api-url}/api/auth/ok` returns response
- [ ] App deployment: `https://{serviceName}.vercel.app` loads (non-blank page)
- [ ] App shows login page or redirect to login

**Failure recovery:**
- Build failure: Check Vercel deployment logs via dashboard
- API 500: Check DATABASE_URL env var is correct, Neon project is accessible
- App blank page: Check VITE_API_URL env var points to correct API URL
- CORS error in browser: Check CORS_ORIGINS includes app URL

---

### CP-7: Email Login Success

**Action:** Navigate to app URL, enter superbuilder user's email and seeded password, click login.

**Verify:**
- [ ] Login page renders with email/password form
- [ ] Email field accepts superbuilder user's email
- [ ] Password field accepts the generated password (from P-1)
- [ ] Login request sent to `{api-url}/api/auth/sign-in/email`
- [ ] Response: 200 with session token
- [ ] Redirected to dashboard/home page after login
- [ ] User name/email visible in UI after login

**Failure recovery:**
- 401 Unauthorized: Password hash mismatch — verify scrypt params match Better Auth expectations
- 500 on auth endpoint: Check BETTER_AUTH_SECRET env var matches what was used during seed
- CORS blocked: Check CORS_ORIGINS on API project
- Network error: Check VITE_API_URL is https (not http)

---

## Iteration Protocol (for ralph-loop)

Each ralph-loop iteration:

1. **Read this plan** — find first unchecked checkpoint
2. **Run Electron Composer** — execute pipeline up to that checkpoint
3. **Verify** — check all items in the checkpoint
4. **If failure:**
   - Diagnose root cause
   - Implement fix in superbuilder code
   - Commit with `fix(desktop): {description}`
   - Retry from failed checkpoint
5. **If success:**
   - Mark checkpoint items as checked
   - Proceed to next checkpoint
6. **When all CP-1 through CP-7 pass:** Pipeline is E2E verified

## Completion Promise

All checkpoints CP-1 through CP-7 pass in a single pipeline run without manual intervention (except UI clicks for feature selection, Neon org selection, and Vercel team selection).

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent install takes too long | Skip agent step initially, manually verify later |
| Vercel deployment takes 2-5 min | Use `waitForReady` mutation or manual check |
| Neon cold start latency | Retry connection after 10s |
| Template Better Auth config mismatch | Verify env var names match before testing |
| GitHub rate limiting | Use authenticated `gh` CLI |
| Password hash format mismatch | Verify scrypt params: N=16384, r=16, p=1, dkLen=64, format `salt_hex:key_hex` |
