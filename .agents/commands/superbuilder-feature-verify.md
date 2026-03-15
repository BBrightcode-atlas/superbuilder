---
description: Feature Dev 파이프라인 E2E 검증 — 전체 파이프라인 자동 실행 + 체크포인트 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-verify: Feature Dev 파이프라인 E2E 검증

## 개요

`superbuilderFeatureDevPipeline()`의 전체 흐름을 실제로 실행하여 검증한다.
간단한 테스트용 feature를 승인 게이트 없이 자동으로 개발하고, 각 체크포인트를 순서대로 확인한다.
**통과할 때까지 반복한다.**

## 테스트 설정

| 항목 | 값 |
|------|-----|
| Feature 이름 | `e2e-test-{timestamp}` |
| 프롬프트 | `"간단한 hello world API endpoint와 React 페이지"` |
| 저장 경로 | `/tmp/feature-dev-e2e/` |
| 승인 게이트 | false (자동 진행) |
| 등록 건너뛰기 | true (boilerplate 등록 안 함) |
| 에이전트 | `claude` |

## 사전 조건 확인

```bash
# atlas-engine 빌드 상태 확인
cd /Users/bbright/Projects/superbuilder && bun run typecheck --filter=@superbuilder/atlas-engine

# boilerplate 경로 확인
ls "${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}/superbuilder.json"

# gh 인증 확인
gh auth status

# 임시 디렉토리 생성
mkdir -p /tmp/feature-dev-e2e
```

## 실행 절차

### Step 1: superbuilderFeatureDevPipeline 실행

아래 스크립트를 `/tmp/feature-dev-e2e-runner.ts`로 저장하고 실행한다:

```typescript
import { superbuilderFeatureDevPipeline } from "@superbuilder/atlas-engine";

const timestamp = Date.now();
const featureName = `e2e-test-${timestamp}`;

const result = await superbuilderFeatureDevPipeline({
  name: featureName,
  prompt: "간단한 hello world API endpoint와 React 페이지",
  targetPath: "/tmp/feature-dev-e2e",
  boilerplatePath: process.env.BOILERPLATE_PATH ?? `${process.env.HOME}/Projects/superbuilder-app-boilerplate`,
  approvalMode: false,
  agent: "claude",
  skipVerify: false,
  skipRegister: true,
}, {
  onStep: (step, status, msg) => console.log(`[${step}] ${status}: ${msg ?? ""}`),
  onLog: (msg) => console.log(msg),
});

console.log("=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
```

실행:
```bash
cd /Users/bbright/Projects/superbuilder && bun run /tmp/feature-dev-e2e-runner.ts
```

`result`의 `featureDir`을 `{featureDir}`, `featureName`을 `{featureName}`으로 표기한다.

### Step 2: 체크포인트 검증

각 단계의 결과를 순서대로 확인한다.

| # | 체크포인트 | 검증 방법 | 기대 결과 |
|---|-----------|----------|----------|
| 1 | spec 생성 | `cat /tmp/feature-dev-e2e/{featureName}.spec.md` | spec 파일 존재, 내용 비어있지 않음 |
| 2 | plan 생성 | `cat /tmp/feature-dev-e2e/{featureName}.plan.md` | plan 파일 존재, 구현 단계 목록 포함 |
| 3 | worktree 생성 | `ls {featureDir}/` | 디렉토리 존재 |
| 4 | feature 디렉토리 | `ls {featureDir}/src/` | `server/`, `client/` 또는 `api/` 하위 디렉토리 존재 |
| 5 | feature.json | `cat {featureDir}/feature.json` | `id`, `name`, `version`, `provides` 필드 존재 |
| 6 | typecheck | `cd {featureDir} && bun run typecheck` | exit code 0, 에러 없음 |
| 7 | git commits | `cd {featureDir} && git log --oneline` | 최소 1개 이상의 커밋 존재 |

각 체크포인트를 순서대로 실행한다. 하나라도 실패하면 원인을 분석하고 수정한 뒤 전체를 재실행한다.

### Step 3: 정리 (Cleanup)

테스트 완료 후 (성공/실패 무관) 생성된 리소스를 정리한다.

```bash
# worktree 제거 (boilerplate repo에서)
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
git -C "$BOILERPLATE" worktree remove /tmp/feature-dev-e2e/{featureName} --force 2>/dev/null || true

# 브랜치 삭제 (boilerplate repo에서)
git -C "$BOILERPLATE" branch -D "feature/{featureName}" 2>/dev/null || true

# 로컬 임시 디렉토리 및 파일 삭제
rm -rf /tmp/feature-dev-e2e/
rm -f /tmp/feature-dev-e2e-runner.ts
```

**재실행 전에 반드시 이전 테스트의 리소스를 정리한다.** worktree가 남아있으면 다음 실행이 실패한다.

## 실패 시 대응

| 실패 단계 | 확인 사항 |
|----------|----------|
| spec/plan 생성 | `atlas-engine` 빌드 여부; `packages/atlas-engine/src/pipeline/spec.ts`, `plan.ts` 구현 상태 |
| worktree 생성 | boilerplate repo에 uncommitted changes 없는지; `git -C $BOILERPLATE_PATH status` 확인 |
| feature 디렉토리 | 에이전트가 정상 실행됐는지 `onLog` 출력 확인; `claude --version` 확인 |
| feature.json | 에이전트가 `feature.json`을 생성했는지; spec/plan에 필드 정의가 충분한지 확인 |
| typecheck | `{featureDir}`에서 `bun install` 실행 후 에러 메시지 확인; import 경로 규칙 확인 |
| git commits | 에이전트가 commit을 생성했는지; worktree의 git 설정 확인 |

## 디버깅 팁

1. **단계별 분리 테스트**: spec/plan만 먼저 확인한 뒤 에이전트 실행

2. **에이전트 로그 확인**: `onLog` 콜백으로 에이전트 출력 전체를 캡처
   ```typescript
   onLog: (msg) => {
     fs.appendFileSync("/tmp/agent.log", msg + "\n");
     console.log(msg);
   }
   ```

3. **worktree 상태 확인**:
   ```bash
   BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
   git -C "$BOILERPLATE" worktree list
   ```

4. **feature.json 스키마 확인**:
   ```bash
   cat packages/atlas-engine/src/types/feature-manifest.ts
   ```

## 기술 참조

- **파이프라인 함수**: `packages/atlas-engine/src/pipeline/feature-dev.ts`
- **설계 스펙**: `docs/architecture/subsystems/feature-development-pipeline.md`
- **E2E 테스트 패턴**: `.agents/commands/compose-e2e-test.md`

$ARGUMENTS
