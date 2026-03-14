---
description: Composer E2E 테스트 — feature 선택부터 Vercel 배포 + 로그인 성공까지 전체 파이프라인 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# compose-e2e-test: Composer E2E 런타임 테스트

## 개요

composePipeline()의 전체 흐름을 실제로 실행하여 검증한다.
hello-world + comment feature를 선택하고, scaffold → Neon → GitHub → Vercel → seed → 로그인까지 확인.
**통과할 때까지 반복한다.**

## 테스트 설정

| 항목 | 값 |
|------|-----|
| Features | hello-world, comment |
| 프로젝트 이름 | `compose-e2e-test-{timestamp}` |
| 저장 경로 | `/tmp/compose-e2e-test/` |
| Owner email | `admin@superbuilder.app` |
| Owner password | `changeme!!` |

## 사전 조건 확인

1. 환경변수 확인:
   ```bash
   echo "NEON: ${NEON_API_KEY:+SET}"
   echo "VERCEL: ${VERCEL_TOKEN:+SET}"
   gh auth status
   ```

2. superbuilder-features 접근 확인:
   ```bash
   ls /Users/bbright/Projects/superbuilder-features/features/hello-world/feature.json
   ```

3. atlas-engine 빌드 확인:
   ```bash
   cd /Users/bbright/Projects/superbuilder && bun run typecheck --filter=@superbuilder/atlas-engine
   ```

## 실행 절차

### Step 1: composePipeline 실행

atlas-engine의 composePipeline()을 직접 호출하는 스크립트를 작성하고 실행한다.

`/tmp/compose-e2e-test/` 디렉토리를 생성한 뒤, 아래 스크립트를 `/tmp/compose-e2e-runner.ts`로 저장하여 실행:

```typescript
import { composePipeline } from "@superbuilder/atlas-engine";

const timestamp = Date.now();
const projectName = `compose-e2e-test-${timestamp}`;

const result = await composePipeline({
  features: ["hello-world", "comment"],
  projectName,
  targetPath: "/tmp/compose-e2e-test",
  options: {
    neon: true,
    github: true,
    vercel: true,
    install: true,
    ownerEmail: "admin@superbuilder.app",
    ownerPassword: "changeme!!",
    featuresSourceDir: "/Users/bbright/Projects/superbuilder-features/features",
  },
}, {
  onStep: (step, status, msg) => console.log(`[${step}] ${status}: ${msg ?? ""}`),
  onLog: (msg) => console.log(msg),
});

console.log("=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
```

실행 방법:
```bash
cd /Users/bbright/Projects/superbuilder && bun run /tmp/compose-e2e-runner.ts
```

### Step 2: 체크포인트 검증

각 단계의 결과를 확인한다. `result`의 `projectDir`을 `{projectDir}`로 표기한다.

| # | 체크포인트 | 검증 방법 | 기대 결과 |
|---|-----------|----------|----------|
| 1 | scaffold 완료 | `ls {projectDir}/packages/features/hello-world/` | 디렉토리 존재 |
| 2 | import 변환 | `grep -r "@superbuilder" {projectDir}/packages/features/` | 결과 없음 (전부 `@repo/*`로 변환됨) |
| 3 | 마커 삽입 | `grep "HelloWorldModule" {projectDir}/apps/server/src/app.module.ts` | import + module 등록 존재 |
| 4 | client 라우트 | `grep "helloWorld" {projectDir}/apps/app/src/router.tsx` | routes import 존재 |
| 5 | package exports | `cat {projectDir}/packages/features/package.json` | hello-world, comment export 존재 |
| 6 | Neon DB | `result.neon.projectId` 존재 | Neon 프로젝트 ID 출력됨 |
| 7 | .env | `grep DATABASE_URL {projectDir}/.env` | DATABASE_URL 존재 |
| 8 | GitHub | `gh repo view {result.github.repoUrl}` | 200 응답 |
| 9 | Vercel | `curl -sI {result.vercel.deploymentUrl}` | HTTP 200 |
| 10 | DB 테이블 | Neon SQL: `SELECT tablename FROM pg_tables WHERE schemaname='public'` | users, organizations 존재 |
| 11 | Owner seed | DB SQL: `SELECT email FROM users WHERE email='admin@superbuilder.app'` | 행 존재 |
| 12 | 로그인 | POST `{vercel_url}/api/auth/sign-in/email` | session token 반환 |

각 체크포인트를 순서대로 실행한다. 하나라도 실패하면 원인을 분석하고 수정한 뒤 전체를 재실행한다.

### Step 3: 로그인 검증

```bash
curl -X POST "{VERCEL_URL}/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@superbuilder.app","password":"changeme!!"}' \
  -c cookies.txt -v
```

확인 사항:
- HTTP 200 응답
- `Set-Cookie` 헤더에 session token 포함
- 실패 시: DB seed 확인, better-auth 설정 확인, `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` 환경변수 확인

### Step 4: 정리 (Cleanup)

테스트 완료 후 (성공/실패 무관) 생성된 리소스를 정리한다.

```bash
# Neon 프로젝트 삭제
curl -X DELETE "https://console.neon.tech/api/v2/projects/{neon_project_id}" \
  -H "Authorization: Bearer $NEON_API_KEY"

# GitHub repo 삭제
gh repo delete {github_repo_url} --yes

# Vercel 프로젝트 삭제
curl -X DELETE "https://api.vercel.com/v9/projects/{vercel_project_id}" \
  -H "Authorization: Bearer $VERCEL_TOKEN"

# 로컬 디렉토리 삭제
rm -rf /tmp/compose-e2e-test/
rm -f /tmp/compose-e2e-runner.ts
rm -f cookies.txt
```

**재실행 전에 반드시 이전 테스트의 리소스를 정리한다.** GitHub/Vercel 프로젝트 이름이 충돌하면 다음 실행이 실패한다.

## 실패 시 대응

| 실패 단계 | 확인 사항 |
|----------|----------|
| scaffold | boilerplate에 마커가 남아있는지, `.git` 삭제가 정상인지, `gh` 인증 상태 |
| copy | superbuilder-features에 해당 feature의 `src/server/`, `src/client/` 등 구조 확인 |
| transform | `@superbuilder/*` import가 남아있는지 `grep -r "@superbuilder" {projectDir}` |
| connection | 마커 블록이 정상인지 (`[ATLAS:IMPORTS]` ~ `[/ATLAS:IMPORTS]`), `MARKER_MAP` 경로가 boilerplate와 일치하는지 (`apps/server/` 사용해야 함, `apps/atlas-server/`가 아님) |
| exports | `packages/features/package.json`에 export 추가됐는지 확인 |
| neon | `NEON_API_KEY`, `NEON_ORG_ID` 환경변수 확인 |
| github | `gh auth status` 확인, repo 이름 충돌 여부 |
| vercel | `VERCEL_TOKEN` 확인, 프로젝트 이름 충돌 여부 |
| install | 프로젝트에서 수동 `bun install` 실행 후 에러 메시지 확인 |
| seed | `DATABASE_URL` 확인, postgres 패키지 설치 여부 |
| 로그인 | `BETTER_AUTH_SECRET` 설정 여부, `BETTER_AUTH_URL`이 Vercel URL과 일치하는지 확인 |

## 디버깅 팁

1. **scaffold만 단독 테스트**: Neon/GitHub/Vercel을 건너뛰어 scaffold 로직만 확인
   ```typescript
   options: { neon: false, github: false, vercel: false, install: false }
   ```

2. **마커 상태 확인**: boilerplate clone 직후 마커 파일 내용 확인
   ```bash
   grep -n "ATLAS:" {projectDir}/apps/server/src/app.module.ts
   ```

3. **import 변환 전후 비교**: 특정 파일의 변환 결과 확인
   ```bash
   grep -n "from " {projectDir}/packages/features/hello-world/hello-world.module.ts
   ```

$ARGUMENTS
