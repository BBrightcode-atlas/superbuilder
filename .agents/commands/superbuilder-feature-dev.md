---
description: Feature 개발 파이프라인 — spec 생성 → plan → worktree → 구현 → 검증 → 등록까지 한 번에 실행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev: Feature 개발 파이프라인 CLI

## 개요

Desktop UI 없이 CLI에서 직접 feature를 개발한다.
`@superbuilder/atlas-engine`의 `superbuilderFeatureDevPipeline()`을 호출하여
spec 생성 → plan 생성 → worktree 생성 → 구현 → 검증 → 등록까지 전체 파이프라인을 실행한다.

## 입력

`$ARGUMENTS`에서 인자를 파싱한다. 인자가 없으면 대화형 모드로 진행한다.

## 대화형 모드 (인자 없음)

다음 순서로 사용자에게 묻는다:

1. **feature 이름** — kebab-case (예: `user-profile`, `blog-post`)
2. **feature 설명 프롬프트** — 어떤 feature를 만들지 자유롭게 설명
3. **승인 게이트 사용 여부** — spec/plan/등록 단계마다 사람이 검토할지 (Y/n)
4. **등록 건너뛰기 여부** — 개발 완료 후 boilerplate에 등록하지 않을지 (y/N)
5. **에이전트 선택** — `claude` 또는 `codex` (기본값: `claude`)

입력이 확인되면 파이프라인을 실행한다.

## 비대화형 모드 (인자 있음)

### CLI 인자

| 인자 | 설명 | 기본값 |
|------|------|--------|
| `--name <name>` | Feature 이름 (kebab-case) | 필수 |
| `--prompt <text>` | Feature 설명 프롬프트 | 필수 |
| `--path <dir>` | Feature 저장 경로 | `$SUPERBUILDER_FEATURES_PATH` |
| `--no-approval` | 승인 게이트 없이 자동 진행 | false (승인 게이트 활성화) |
| `--agent <name>` | 구현에 사용할 CLI 에이전트 | `claude` |
| `--skip-verify` | typecheck/lint 검증 건너뛰기 | false |
| `--skip-register` | boilerplate 등록 건너뛰기 | false |

### 예시

```bash
# 대화형 모드
/superbuilder-feature-dev

# 비대화형 — 승인 게이트 없이 전체 자동 실행
/superbuilder-feature-dev --name user-profile --prompt "사용자 프로필 조회 및 수정 기능" --no-approval

# 승인 게이트 활성화 + codex 에이전트 사용
/superbuilder-feature-dev --name blog-post --prompt "블로그 포스트 CRUD + 마크다운 에디터" --agent codex

# 등록은 나중에 수동으로 처리
/superbuilder-feature-dev --name notification --prompt "실시간 알림 기능" --skip-register
```

## 환경변수

| 변수 | 설명 |
|------|------|
| `BOILERPLATE_PATH` | boilerplate 레포 로컬 경로 (기본: `~/Projects/superbuilder-app-boilerplate`) |
| `SUPERBUILDER_FEATURES_PATH` | feature 코드 저장 경로 (기본: `~/.superbuilder/worktrees/`) |

## 실행 스크립트

파이프라인을 직접 호출하는 스크립트를 `/tmp/feature-dev-runner.ts`에 생성하고 실행한다:

```typescript
import { superbuilderFeatureDevPipeline } from "@superbuilder/atlas-engine";

const result = await superbuilderFeatureDevPipeline({
  name: "<feature-name>",
  prompt: "<feature-prompt>",
  targetPath: process.env.SUPERBUILDER_FEATURES_PATH ?? `${process.env.HOME}/.superbuilder/worktrees`,
  boilerplatePath: process.env.BOILERPLATE_PATH ?? `${process.env.HOME}/Projects/superbuilder-app-boilerplate`,
  approvalMode: true,       // --no-approval 시 false
  agent: "claude",          // --agent 인자
  skipVerify: false,        // --skip-verify 시 true
  skipRegister: false,      // --skip-register 시 true
}, {
  onStep: (step, status, msg) => console.log(`[${step}] ${status}: ${msg ?? ""}`),
  onLog: (msg) => console.log(msg),
  onApprovalRequired: async (stage, context) => {
    // 승인 게이트: 사용자 입력 대기
    console.log(`\n=== 승인 필요: ${stage} ===`);
    console.log(JSON.stringify(context, null, 2));
    // 대화형: 사용자가 approve/reject 응답
  },
});

console.log("=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
```

실행:
```bash
cd /Users/bbright/Projects/superbuilder && bun run /tmp/feature-dev-runner.ts
```

## 진행 상태 출력

파이프라인 실행 중 다음 형식으로 상태를 출력한다:

```
[spec]     ⏳ running  : spec 생성 중...
[spec]     ✅ done     : spec 저장 완료 → .superbuilder/specs/user-profile.md
[plan]     ⏳ running  : plan 생성 중...
[plan]     ✅ done     : plan 저장 완료 → .superbuilder/plans/user-profile.md
[worktree] ⏳ running  : git worktree 생성 중...
[worktree] ✅ done     : ~/.superbuilder/worktrees/user-profile/ 생성 완료
[agent]    ⏳ running  : claude 에이전트 실행 중...
[agent]    ✅ done     : 구현 완료 — 12개 파일 생성
[verify]   ⏳ running  : typecheck + lint 실행 중...
[verify]   ✅ done     : 검증 통과
[register] ⏳ running  : boilerplate에 등록 중...
[register] ✅ done     : PR 생성 완료 → https://github.com/BBrightcode-atlas/superbuilder-app-boilerplate/pull/42
```

승인 게이트가 있는 경우 각 주요 단계(spec, plan, register) 후 중단하고 사용자 응답을 기다린다.

## 승인 게이트 흐름

`approvalMode: true`(기본값)인 경우:

1. **spec_plan 승인** — spec + plan 생성 후 중단 → 사용자 검토 → `approve` / `reject`
2. **human_qa 승인** — 구현 완료 후 중단 → 사용자 코드 검토 → `approve` / `reject`
3. **registration 승인** — 등록 직전 중단 → 최종 확인 → `approve` / `reject`

`--no-approval` 플래그 사용 시 모든 게이트를 건너뛰고 자동 진행한다.

## 사전 조건 확인

파이프라인 실행 전 다음을 확인한다:

```bash
# atlas-engine 빌드 상태 확인
cd /Users/bbright/Projects/superbuilder && bun run typecheck --filter=@superbuilder/atlas-engine

# boilerplate 경로 확인
ls "${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}/superbuilder.json"

# gh 인증 확인
gh auth status
```

## 기술 참조

- **파이프라인 함수**: `packages/atlas-engine/src/pipeline/feature-dev.ts`
- **spec/plan 생성**: `packages/atlas-engine/src/pipeline/spec.ts`, `plan.ts`
- **worktree 관리**: `packages/atlas-engine/src/scaffold/worktree.ts`
- **boilerplate 등록**: `packages/atlas-engine/src/scaffold/register.ts`
- **설계 스펙**:
  - `docs/architecture/subsystems/feature-lifecycle.md`
  - `docs/architecture/subsystems/feature-development-pipeline.md`
  - `docs/architecture/subsystems/feature-approval-workflow.md`

## 트러블슈팅

| 증상 | 해결 방법 |
|------|----------|
| `superbuilderFeatureDevPipeline is not exported` | `atlas-engine` 빌드 후 재시도: `bun run build --filter=@superbuilder/atlas-engine` |
| worktree 생성 실패 | `~/.superbuilder/worktrees/` 디렉토리 존재 여부 + git 상태 확인 |
| 에이전트 실행 실패 | `claude --version` 또는 `codex --version` 확인 |
| boilerplate not found | `BOILERPLATE_PATH` 환경변수 또는 기본 경로(`~/Projects/superbuilder-app-boilerplate`) 확인 |
| typecheck 실패 | worktree 디렉토리에서 `bun install` 후 `bun run typecheck` 재실행 |
| 승인 게이트에서 멈춤 | `--no-approval` 플래그로 재실행하거나 터미널에서 `approve` 입력 |

$ARGUMENTS
