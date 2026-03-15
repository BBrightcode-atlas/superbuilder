# Headless Compose Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** atlas-engine에 composePipeline() 공통 오케스트레이터를 추출하여 Desktop UI와 CLI agent 양쪽에서 프로젝트 생성 파이프라인을 실행 가능하게 한다.

**Architecture:** Desktop tRPC 라우터의 neon/vercel/github/seed 로직을 atlas-engine/pipeline 모듈로 추출. composePipeline()이 8단계를 순서대로 실행. Desktop은 thin wrapper, CLI는 compose.md 스킬을 통해 호출.

**Tech Stack:** TypeScript, Bun, Neon API, Vercel API, GitHub CLI (gh), better-auth

**Spec:** docs/superpowers/specs/2026-03-15-headless-compose-pipeline-design.md

| 항목 | 값 |
|------|-----|
| **작업 레포** | superbuilder |
| **작업 디렉토리** | packages/atlas-engine |
| **브랜치** | develop |
| **완료 기준** | composePipeline() 함수 동작, superbuilder-compose.md 스킬 작성, Desktop composer.ts thin wrapper로 리팩토링, `/superbuilder-spec-verify` 통과 |

---

## Chunk 1: Pipeline Types & 개별 단계 함수 추출 (Task 1–8)

### Task 1: `pipeline/types.ts` — 공통 타입 정의

**파일:** `packages/atlas-engine/src/pipeline/types.ts`

- [ ] 1-1. Spec 섹션 3의 인터페이스를 기반으로 아래 타입 정의:
  - `ComposeInput` — `{ features: string[]; projectName: string; targetPath: string; options?: ComposeOptions }`
  - `ComposeOptions` — `{ neon?: boolean; github?: boolean; vercel?: boolean; githubOrg?: string; private?: boolean; install?: boolean; boilerplateRepo?: string; ownerEmail?: string; ownerPassword?: string; neonApiKey?: string; neonOrgId?: string; vercelToken?: string; vercelTeamId?: string }`
  - `ComposeResult` — `{ projectDir, projectName, resolved, removedFeatures, keptFeatures, neon?, github?, vercel?, installed, seed? }`
  - `ComposeCallbacks` — `{ onStep?, onLog? }`
  - `ComposeStep` — `"resolve" | "scaffold" | "neon" | "github" | "vercel" | "env" | "install" | "seed"`
  - `NeonResult` — `{ projectId: string; databaseUrl: string }`
  - `GitHubResult` — `{ repoUrl: string; owner: string; repo: string }`
  - `VercelResult` — `{ projectId: string; deploymentUrl: string }`
  - `SeedResult` — `{ systemOrgId: string; ownerEmail: string; ownerPassword: string }`
- [ ] 1-2. `ResolvedFeatures` 타입은 `../manifest/types`에서 re-export
- [ ] 1-3. Commit: `feat(atlas-engine): add pipeline types for compose orchestrator`

**참고:** API key 파라미터(`neonApiKey`, `vercelToken`)는 CLI 환경에서 환경변수 대신 직접 전달할 수 있도록 옵션에 포함한다. 환경변수 fallback은 각 모듈에서 처리.

---

### Task 2: `pipeline/neon.ts` — Neon DB 프로젝트 생성

**파일:** `packages/atlas-engine/src/pipeline/neon.ts`

Desktop `atlas/neon.ts`의 `createProject` mutation (123–162행)과 `neonFetch` 헬퍼 (30–45행)에서 추출.

- [ ] 2-1. `neonFetch(path, options, apiKey)` 헬퍼 함수 구현
  - Desktop 버전과 동일하되, `apiKey`를 직접 파라미터로 받음
  - `NEON_API = "https://console.neon.tech/api/v2"`
  - 에러 시 `Neon API error (status): body` 메시지
- [ ] 2-2. `createNeonProject(input)` 함수 구현
  - Input: `{ projectName: string; orgId?: string; apiKey?: string }`
  - apiKey 해결 순서: 파라미터 → `process.env.NEON_API_KEY` → Error
  - orgId 해결 순서: 파라미터 → `process.env.NEON_ORG_ID` → 생략(개인 프로젝트)
  - Neon API `POST /projects` 호출 (Desktop `neon.ts` 132–147행과 동일 로직)
  - Returns: `NeonResult` (`{ projectId, databaseUrl }`)
  - Desktop과의 차이: `localDb` 업데이트 없음 (순수 함수)
- [ ] 2-3. Commit: `feat(atlas-engine): extract neon project creation to pipeline module`

**추출 원본 (Desktop neon.ts):**
```
neonFetch(): 30-45행 → apiKey를 파라미터로 변경
createProject mutation body: 132-161행 → 순수 함수로 변환, localDb 제거
```

---

### Task 3: `pipeline/github.ts` — GitHub repo 생성 + push

**파일:** `packages/atlas-engine/src/pipeline/github.ts`

Desktop `atlas/composer.ts`의 `pushToGitHub` mutation (143–179행)에서 추출.

- [ ] 3-1. `pushToGitHub(input)` 함수 구현
  - Input: `{ projectDir: string; repoName: string; org?: string; private?: boolean }`
  - `org` 기본값: `"BBrightcode-atlas"`
  - `private` 기본값: `true`
  - `gh repo create ${org}/${repoName} --private --source ${projectDir} --push` 실행 (composer.ts 155–159행 참조)
  - `gh repo view --json url,owner,name` 으로 결과 조회 (composer.ts 161–164행 참조)
  - Returns: `GitHubResult` (`{ repoUrl, owner, repo }`)
  - Desktop과의 차이: `localDb` 업데이트 없음, `atlasProjectId` 불필요
- [ ] 3-2. `execFile` 사용 시 `node:child_process`의 `promisify(execFile)` 패턴 사용
- [ ] 3-3. Commit: `feat(atlas-engine): extract github push to pipeline module`

**추출 원본 (Desktop composer.ts):**
```
pushToGitHub mutation: 143-179행 → 순수 함수로 변환, localDb 제거
```

---

### Task 4: `pipeline/vercel.ts` — Vercel 프로젝트 생성 + 배포

**파일:** `packages/atlas-engine/src/pipeline/vercel.ts`

Desktop `atlas/vercel.ts`의 `vercelFetch` (23–38행), `createProject` (97–196행), `setEnvVars` (198–265행), `connectGitRepo` (267–320행), `deploy` (362–407행) 에서 추출.

- [ ] 4-1. `vercelFetch(path, options, token)` 헬퍼 함수 구현
  - Desktop 버전과 동일하되, `token`을 직접 파라미터로 받음
  - `VERCEL_API = "https://api.vercel.com"`
- [ ] 4-2. `deployToVercel(input)` 오케스트레이터 함수 구현
  - Input: `{ repoUrl: string; projectName: string; envVars?: Record<string, string | undefined>; token?: string; teamId?: string; gitOwner?: string; gitRepo?: string; framework?: string }`
  - token 해결 순서: 파라미터 → `process.env.VERCEL_TOKEN` → Error
  - 내부적으로 순서대로 실행:
    1. **createProject** — `POST /v10/projects` (vercel.ts 110–196행 로직)
       - `gitRepository` 포함하여 생성 시도 → 실패 시 git 없이 fallback (vercel.ts 144–170행)
       - `gitOwner`/`gitRepo`는 `repoUrl`에서 파싱 (e.g., `https://github.com/org/repo` → `org`, `repo`)
    2. **setEnvVars** — `POST /v10/projects/{projectId}/env` (vercel.ts 221–262행 로직)
       - `envVars` 중 `undefined` 값은 제외
       - 이미 존재하면 `PATCH /v9/projects/{projectId}/env`로 업데이트 시도
    3. **connectGitRepo** — git 연동 실패 시에만 `PATCH /v9/projects/{projectId}` (vercel.ts 283–295행)
  - Returns: `VercelResult` (`{ projectId, deploymentUrl }`)
  - `deploymentUrl`은 Vercel 프로젝트 alias 기반 URL (vercel.ts 173–176행 참조)
  - Desktop과의 차이: `localDb` 업데이트 없음, `atlasProjectId` 불필요
  - 참고: 실제 deploy trigger는 git push 시 자동으로 발생하므로 별도 `POST /v13/deployments`는 호출하지 않는다. git 연동만 완료하면 충분.
- [ ] 4-3. Commit: `feat(atlas-engine): extract vercel deployment to pipeline module`

**추출 원본 (Desktop vercel.ts):**
```
vercelFetch(): 23-38행 → token을 파라미터로 변경
createProject: 110-196행 → gitRepository fallback 로직 포함
setEnvVars: 221-262행 → 이미 존재 시 PATCH fallback
connectGitRepo: 283-295행 → git 미연결 시에만 실행
```

---

### Task 5: `pipeline/env.ts` — .env 파일 생성

**파일:** `packages/atlas-engine/src/pipeline/env.ts`

Desktop `atlas/neon.ts`의 `writeEnvFile` mutation (173–208행)에서 추출 + `BETTER_AUTH_SECRET` 자동 생성 추가.

- [ ] 5-1. `writeEnvFile(projectDir, vars)` 함수 구현
  - Input: `projectDir: string, vars: Record<string, string | undefined>`
  - `undefined` 값인 키는 건너뛴다
  - 기존 `.env` 파일이 있으면 내용 뒤에 append (Desktop neon.ts 202–204행 참조)
  - 없으면 새로 생성
- [ ] 5-2. `BETTER_AUTH_SECRET` 자동 생성
  - `vars`에 `BETTER_AUTH_SECRET`이 없으면 `randomBytes(32).toString("base64")`로 생성하여 추가
  - `node:crypto`의 `randomBytes` 사용 (openssl 대신 — 외부 프로세스 의존 없음)
- [ ] 5-3. `.env` 파일 앞에 `# Auto-generated by Superbuilder Composer` 주석 추가 (신규 생성 시)
- [ ] 5-4. Commit: `feat(atlas-engine): extract env file writer to pipeline module`

**추출 원본 (Desktop neon.ts):**
```
writeEnvFile mutation: 173-208행 → 순수 함수로 변환
BETTER_AUTH_SECRET: 자동 생성 로직 추가 (기존에는 Desktop UI에서 별도 전달)
```

---

### Task 6: `pipeline/install.ts` — 의존성 설치 + DB push

**파일:** `packages/atlas-engine/src/pipeline/install.ts`

Desktop `atlas/neon.ts`의 `runMigration` mutation (210–262행) + `bun install` 로직에서 추출.

- [ ] 6-1. `installDependencies(projectDir)` 함수 구현
  - `execFile("bun", ["install"], { cwd: projectDir, timeout: 120_000 })`
  - `--frozen-lockfile` 먼저 시도 → 실패 시 `bun install` (Desktop neon.ts seedOwner 346–353행 패턴 참조)
- [ ] 6-2. `pushDatabase(projectDir)` 함수 구현
  - `.env`에서 `DATABASE_URL` 읽기 (Desktop neon.ts 229–232행 참조)
  - `bunx drizzle-kit push --force` 실행, cwd는 `${projectDir}/packages/drizzle` (Desktop neon.ts 234–248행 참조)
  - DATABASE_URL을 환경변수로 전달
- [ ] 6-3. `installFeatures(input)` 오케스트레이터 함수 구현
  - Input: `{ projectDir: string }`
  - 순서: `installDependencies()` → `pushDatabase()` (`.env`에 DATABASE_URL 존재 시에만)
- [ ] 6-4. Commit: `feat(atlas-engine): extract install and migration to pipeline module`

**추출 원본 (Desktop neon.ts):**
```
bun install: seedOwner 346-353행 (frozen-lockfile fallback 패턴)
runMigration: 210-262행 → drizzle-kit push 로직
```

---

### Task 7: `pipeline/seed.ts` — 초기 데이터 시딩

**파일:** `packages/atlas-engine/src/pipeline/seed.ts`

Desktop `atlas/neon.ts`의 `seedOwner` mutation (264–403행)에서 **거의 그대로** 추출.

- [ ] 7-1. `seedInitialData(input)` 함수 구현
  - Input: `{ projectDir: string; ownerEmail?: string; ownerPassword?: string; ownerName?: string; projectSlug?: string }`
  - 기본값: `ownerEmail = "admin@superbuilder.app"`, `ownerPassword = "changeme!!"`, `ownerName = "Admin"`, `projectSlug`은 프로젝트 디렉토리명에서 추출
  - Returns: `SeedResult` (`{ systemOrgId, ownerEmail, ownerPassword }`)
- [ ] 7-2. 비밀번호 해싱 — Desktop neon.ts 286–293행 **그대로** 복사
  - `scryptSync`로 Better Auth 호환 포맷 생성: `salt_hex:key_hex`
  - N=16384, r=16, p=1, dkLen=64
- [ ] 7-3. 임시 seed 스크립트 생성 — Desktop neon.ts 296–337행 **그대로** 복사
  - `_seed-owner.mjs` 파일 생성
  - `postgres` 패키지로 직접 SQL 실행
  - users, accounts, organizations, members, profiles 테이블에 INSERT
  - `crypto.randomUUID()`로 ID 생성
- [ ] 7-4. seed 스크립트 실행 — Desktop neon.ts 359–374행 **그대로** 복사
  - `bun run ${seedPath}` 실행
  - DATABASE_URL, SEED_NAME, SEED_EMAIL, SEED_PASSWORD_HASH, SEED_PROJECT_SLUG 환경변수 전달
  - 결과 JSON 파싱하여 `{ userId, orgId }` 추출
- [ ] 7-5. 정리: 임시 파일 삭제 (`unlink(seedPath)`)
- [ ] 7-6. `.env`에 `SYSTEM_ORG_ID` 추가 — seed 성공 시 `.env` 파일에 append
- [ ] 7-7. Desktop과의 차이: `localDb` 업데이트 없음, `atlasProjectId` 불필요
- [ ] 7-8. Commit: `feat(atlas-engine): extract seed owner to pipeline module`

**추출 원본 (Desktop neon.ts seedOwner):**
```
비밀번호 해싱: 286-293행 → 그대로 복사
seed 스크립트: 296-337행 → 그대로 복사
스크립트 실행: 343-376행 → localDb 관련 코드 제거
정리: 376행, 394행 → 그대로 복사
```

**CRITICAL:** 이 함수는 Desktop neon.ts의 `seedOwner` (264–403행)의 핵심 로직을 **거의 그대로** 가져온다. 순수 함수로 만들기 위해 `localDb` 관련 코드만 제거하고 나머지는 동일하게 유지.

---

### Task 8: `pipeline/index.ts` — barrel export

**파일:** `packages/atlas-engine/src/pipeline/index.ts`

- [ ] 8-1. 모든 pipeline 모듈 export:
  ```typescript
  export * from "./types";
  export { createNeonProject } from "./neon";
  export { pushToGitHub } from "./github";
  export { deployToVercel } from "./vercel";
  export { writeEnvFile } from "./env";
  export { installFeatures } from "./install";
  export { seedInitialData } from "./seed";
  ```
  (composePipeline은 Chunk 2에서 추가)
- [ ] 8-2. Commit: `feat(atlas-engine): add pipeline barrel export`

---

## Chunk 2: Compose Pipeline 오케스트레이터 (Task 9–11)

### Task 9: `pipeline/compose.ts` — composePipeline() 메인 함수

**파일:** `packages/atlas-engine/src/pipeline/compose.ts`

- [ ] 9-1. `composePipeline(input, callbacks?)` 함수 구현
  - Spec 섹션 4의 의사코드를 기반으로 8단계 순차 실행
  - 기본 옵션: `{ neon: true, github: true, vercel: true, install: false, private: true, githubOrg: "BBrightcode-atlas" }`
- [ ] 9-2. **Step 1 — resolve**: `fetchRemoteManifest()` → `resolveFeatures(manifest, input.features)`
  - `fetchRemoteManifest()`에 `boilerplateRepo` 전달 (옵션에 있으면)
  - 실패 시 즉시 에러 throw (fatal)
- [ ] 9-3. **Step 2 — scaffold**: `scaffold()` 호출
  - Input 매핑: `{ projectName, targetDir: join(targetPath, projectName), featuresToKeep: resolved.resolved, boilerplateRepo }`
  - 실패 시 즉시 에러 throw (fatal)
  - 기존 `scaffold()` 함수를 그대로 사용 (atlas-engine의 `scaffold/scaffold.ts`)
- [ ] 9-4. **Step 3 — neon**: `createNeonProject()` 호출 (opts.neon이 true일 때)
  - 실패 시 경고 출력 + 계속 진행 (`onStep("neon", "error", message)`)
  - `neonResult`가 없으면 이후 단계에서 DATABASE_URL 없이 진행
- [ ] 9-5. **Step 4 — github**: `pushToGitHub()` 호출 (opts.github가 true일 때)
  - 실패 시 경고 출력 + 계속 진행
- [ ] 9-6. **Step 5 — vercel**: `deployToVercel()` 호출 (opts.vercel이 true이고 githubResult가 있을 때)
  - github 없으면 자동 skip
  - 실패 시 경고 출력 + 계속 진행
  - `envVars`에 `DATABASE_URL` 전달 (neonResult가 있으면)
- [ ] 9-7. **Step 6 — env**: `writeEnvFile()` 호출 (항상 실행)
  - `DATABASE_URL`, `NEON_PROJECT_ID` (neonResult에서), `VERCEL_URL` (vercelResult에서) 등 전달
  - 실패 시 경고 + 계속
- [ ] 9-8. **Step 7 — install**: `installFeatures()` 호출 (opts.install이 true일 때)
  - 실패 시 에러 출력 + 수동 안내 메시지 전달
- [ ] 9-9. **Step 8 — seed**: `seedInitialData()` 호출 (opts.install이 true이고 opts.neon이 true일 때)
  - install과 neon 모두 성공해야 실행 (DB 필요)
  - 실패 시 에러 출력 + 수동 안내 메시지 전달
- [ ] 9-10. `ComposeResult` 구성하여 반환
- [ ] 9-11. 에러 처리 패턴: 각 non-fatal 단계는 try/catch로 감싸고, `callbacks?.onStep?.(step, "error", error.message)` 호출 후 `callbacks?.onLog?.(fallbackMessage)` 호출
- [ ] 9-12. Commit: `feat(atlas-engine): implement composePipeline orchestrator`

---

### Task 10: `packages/atlas-engine/src/index.ts` — pipeline export 추가

**파일:** `packages/atlas-engine/src/index.ts`

- [ ] 10-1. 기존 export 목록 끝에 `export * from "./pipeline";` 추가
  - 현재 내용: `export * from "./boilerplate"; ... export * from "./transform";`
  - 추가 후: 마지막 줄에 `export * from "./pipeline";`
- [ ] 10-2. Commit: `feat(atlas-engine): export pipeline module from package root`

---

### Task 11: `packages/atlas-engine/package.json` — subpath export 추가

**파일:** `packages/atlas-engine/package.json`

- [ ] 11-1. `exports` 필드에 `"./pipeline": "./src/pipeline/index.ts"` 추가
  - 기존 exports: `"."`, `"./manifest"`, `"./resolver"`, `"./boilerplate"`, `"./scaffold"`, `"./connection"`, `"./transform"`
  - 추가: `"./pipeline": "./src/pipeline/index.ts"`
- [ ] 11-2. Commit: `feat(atlas-engine): add pipeline subpath export`

---

## Chunk 3: Desktop 리팩토링 (Task 12–13)

### Task 12: `composer.ts` — thin wrapper로 리팩토링

**파일:** `apps/desktop/src/lib/trpc/routers/atlas/composer.ts`

- [ ] 12-1. `composePipeline`을 `@superbuilder/atlas-engine`에서 import
- [ ] 12-2. `compose` mutation 리팩토링:
  - 기존: `loadRegistry()` → `resolveFeatures()` → `scaffold()` 직접 호출
  - 변경: `composePipeline()` 호출 (install: false)
  - Desktop 전용 콜백: `onStep`/`onLog`는 로그만 출력 (또는 생략)
  - `composePipeline()` 반환값에서 프로젝트 정보 추출하여 `localDb`에 저장 (기존 72–82행 로직 유지)
  - Input 매핑:
    ```
    composePipeline({
      features: input.selected,
      projectName: input.projectName,
      targetPath: input.targetPath,
      options: {
        neon: false,      // Desktop은 별도 UI 단계에서 실행
        github: false,    // Desktop은 별도 UI 단계에서 실행
        vercel: false,    // Desktop은 별도 UI 단계에서 실행
        install: false,   // Desktop은 launchInstallAgent로 별도 실행
      },
    })
    ```
  - 참고: Desktop UI는 Neon/GitHub/Vercel을 개별 UI 단계에서 실행하므로 compose에서는 scaffold만 실행
- [ ] 12-3. `pushToGitHub` mutation 리팩토링:
  - `@superbuilder/atlas-engine`의 `pushToGitHub`를 import하여 호출
  - `localDb` 업데이트는 Desktop mutation에서 유지 (pipeline 함수 호출 후)
- [ ] 12-4. `getSuperbuilderPath()`, `getAtlasPath()` 함수 제거 (더 이상 사용하지 않음)
  - `composePipeline()`이 boilerplate를 직접 clone하므로 로컬 경로 불필요
- [ ] 12-5. `launchInstallAgent` mutation은 변경 없음 (Desktop UI 전용 유지)
- [ ] 12-6. Commit: `refactor(desktop): use composePipeline from atlas-engine in composer`

**리팩토링 범위:**
```
제거: getSuperbuilderPath(), getAtlasPath() (15-25행)
변경: compose mutation (29-91행) → composePipeline() 호출로 교체
변경: pushToGitHub mutation (143-179행) → pipeline/github.ts 함수 호출로 교체
유지: launchInstallAgent mutation (93-141행) → 변경 없음
```

---

### Task 13: Desktop neon.ts / vercel.ts — 향후 마이그레이션 메모만 추가

**파일:** Desktop의 neon.ts, vercel.ts

- [ ] 13-1. 현재 단계에서는 Desktop의 neon.ts, vercel.ts tRPC 라우터를 **변경하지 않는다**
  - 이유: Desktop UI는 각 단계(Neon 생성, Vercel 배포)를 개별 UI 버튼으로 실행하므로, tRPC procedure 그대로 유지해야 함
  - pipeline 함수들은 독립적인 순수 함수이므로, Desktop 라우터와 공존 가능
  - 향후 필요 시 Desktop 라우터에서 pipeline 함수를 내부적으로 호출하도록 리팩토링 가능
- [ ] 13-2. `neon.ts` 파일 상단에 주석 추가:
  ```typescript
  // NOTE: 공통 로직은 @superbuilder/atlas-engine/pipeline의 createNeonProject(), seedInitialData()로 추출됨.
  // Desktop UI 전용 tRPC procedure들은 localDb 연동이 필요하므로 여기 유지.
  // 향후 리팩토링 시 pipeline 함수를 내부적으로 호출하도록 변경 가능.
  ```
- [ ] 13-3. `vercel.ts` 파일 상단에 주석 추가:
  ```typescript
  // NOTE: 공통 로직은 @superbuilder/atlas-engine/pipeline의 deployToVercel()로 추출됨.
  // Desktop UI 전용 tRPC procedure들은 localDb 연동이 필요하므로 여기 유지.
  ```
- [ ] 13-4. Commit: `docs(desktop): add migration notes to neon and vercel routers`

---

## Chunk 4: CLI 스킬 (Task 14)

### Task 14: `.agents/commands/superbuilder-compose.md` — CLI agent 스킬

**파일:** `.agents/commands/superbuilder-compose.md`

- [ ] 14-1. 스킬 설명 헤더 작성:
  - 목적: 프로젝트 생성 파이프라인 실행 (feature 선택 → scaffold → 배포)
  - 두 가지 모드: 대화형 (인자 없음), 비대화형 (인자 전달)
- [ ] 14-2. **대화형 모드** 흐름 정의:
  1. `fetchRemoteManifest()`로 feature 목록 조회 (`@superbuilder/atlas-engine`에서)
  2. 그룹별 feature 목록 표시 (core, content, commerce, community, system, template)
  3. 사용자에게 feature 선택 요청 (콤마 구분 이름)
  4. `resolveFeatures()`로 의존성 해결 → 자동 포함 feature 표시
  5. 프로젝트 이름 질문
  6. 저장 경로 질문 (기본값: `~/Projects`)
  7. 소유자 이메일 질문 (seed용)
  8. `composePipeline()` 호출 (`install: true`)
  9. 각 단계 진행 상황 텍스트 출력
  10. 완료 결과 요약 출력
- [ ] 14-3. **비대화형 모드** 흐름 정의:
  - `--features blog,comment,payment --name my-app --path ~/Projects` 형식
  - 또는 `--config compose.json` 형식 (JSON 파일 읽기)
  - 인자 파싱 후 바로 `composePipeline()` 실행
- [ ] 14-4. Spec 섹션 5의 대화 예시를 포함
- [ ] 14-5. 환경변수 요구사항 명시:
  - `NEON_API_KEY` — Neon DB 생성 시 필요
  - `GITHUB_TOKEN` — gh CLI가 자동 사용
  - `VERCEL_TOKEN` — Vercel 배포 시 필요
  - `NEON_ORG_ID` — Neon organization (선택)
- [ ] 14-6. 에러 시 대응 안내:
  - scaffold 실패: "boilerplate repo 접근 권한 확인 (gh auth status)"
  - neon 실패: "NEON_API_KEY 환경변수 확인"
  - vercel 실패: "VERCEL_TOKEN 환경변수 확인"
- [ ] 14-7. Commit: `feat: add superbuilder-compose CLI skill for headless project creation`

---

## Chunk 5: 스펙 대비 검증 + 빌드 검증 (Task 15-16)

### Task 15: `/superbuilder-spec-verify` 실행 — 스펙 대비 구현 완전성 검증

**필수**: 이 단계는 통과할 때까지 반복한다 (최대 5회).

- [ ] 15-1. `/superbuilder-spec-verify docs/superpowers/specs/2026-03-15-headless-compose-pipeline-design.md` 실행
  - Phase 1: 스펙에서 함수/인터페이스/필드/에러 처리/콜백 호출 추출
  - Phase 2: 실제 코드에서 각 항목 존재 여부 검증
  - Phase 3: 결과 테이블 출력 (PASS/FAIL)
  - Phase 4: FAIL 항목 자동 수정
  - Phase 5: typecheck + test + lint 실행

- [ ] 15-2. FAIL 항목이 있으면:
  - 스펙을 참조하여 누락 코드 구현
  - 수정 후 15-1 재실행
  - 모든 항목 PASS할 때까지 반복

- [ ] 15-3. 수정사항 커밋: `fix(atlas-engine): implement missing spec requirements`

### Task 16: 최종 빌드 검증

- [ ] 16-1. `packages/atlas-engine` typecheck:
  ```bash
  cd packages/atlas-engine && bun run typecheck
  ```
- [ ] 16-2. `apps/desktop` typecheck (composer.ts 리팩토링 검증):
  ```bash
  bun run typecheck --filter=@superset/desktop
  ```
- [ ] 16-3. 프로젝트 루트 lint:
  ```bash
  bun run lint:fix
  ```
- [ ] 16-4. atlas-engine 테스트:
  ```bash
  bun test packages/atlas-engine/
  ```
- [ ] 16-5. 에러 있으면 수정 → 16-1부터 재실행
- [ ] 16-6. 최종 커밋: `chore: verify pipeline module build and tests`

---

## 참고사항

### 에러 처리 정책

| 단계 | 실패 시 동작 | 분류 |
|------|-------------|------|
| resolve | 즉시 에러 반환 (순환 의존성, 누락 feature) | **Fatal** |
| scaffold | 즉시 에러 반환 (clone 실패, manifest 없음) | **Fatal** |
| neon | 경고 출력 + 계속 진행 (DB 없이도 scaffold 완료) | Non-fatal |
| github | 경고 출력 + 계속 진행 (로컬에만 프로젝트 유지) | Non-fatal |
| vercel | 경고 출력 + 계속 진행 (github 없으면 자동 skip) | Non-fatal |
| env | 경고 출력 + 계속 진행 | Non-fatal |
| install | 에러 출력 + 수동 안내 메시지 | Non-fatal |
| seed | 에러 출력 + 수동 안내 메시지 | Non-fatal |

### Desktop vs CLI 차이점

| 항목 | Desktop UI | CLI Agent |
|------|-----------|-----------|
| 진입점 | tRPC mutation (composer.ts) | compose.md 스킬 |
| Neon/GitHub/Vercel | compose에서 skip → 별도 UI 단계 | compose에서 한번에 실행 |
| install | false (launchInstallAgent로 별도) | true (파이프라인 내에서) |
| 진행 표시 | UI progress bar | 텍스트 출력 |
| API key 소스 | localDb 암호화 토큰 | 환경변수 |
| localDb 저장 | Desktop mutation에서 처리 | 없음 |

### 테스트 전략

Pipeline 모듈은 외부 API (Neon, Vercel, GitHub CLI)를 호출하는 오케스트레이션 함수이므로 유닛 테스트를 작성하지 않는다. 대신:
- Typecheck로 타입 정합성 검증
- 향후 E2E 통합 테스트에서 실제 파이프라인 실행 검증
- `compose.md` 스킬을 통한 수동 검증
