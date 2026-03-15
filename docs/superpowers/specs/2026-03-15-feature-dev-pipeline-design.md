# Feature Dev Pipeline 설계 스펙

> Feature 개발 전체 흐름을 CLI에서 실행 가능한 파이프라인으로 구현.
> composer의 `composePipeline()` 패턴과 동일한 구조.

---

## 1. 목표

Feature Studio의 전체 워크플로우를 `featureDevPipeline()` 함수로 구현하여:
- CLI에서 `/feature-dev` 커맨드로 직접 실행 가능
- Desktop UI에서 동일 함수를 호출하여 오케스트레이션
- 승인 게이트를 콜백으로 추상화하여 자동/수동 모드 전환

---

## 2. 파이프라인 단계 (9단계)

| # | 단계 | DB status | Fatal | 설명 |
|---|------|-----------|-------|------|
| 1 | createRequest | `draft` | YES | Neon DB에 feature_request 레코드 생성 |
| 2 | generateSpec | `spec_ready` | YES | claude CLI spawn → spec 텍스트 생성 → artifact 저장 |
| 3 | generatePlan | `pending_spec_approval` | YES | claude CLI spawn → plan 텍스트 생성 → artifact 저장 |
| - | [승인: spec_plan] | `plan_approved` | - | approvalMode 시 onApproval 콜백 호출 |
| 4 | createWorktree | `plan_approved` | YES | boilerplate repo에 git worktree 생성 |
| 5 | implement | `implementing` | NO | claude/codex CLI spawn → worktree에서 feature 구현 |
| 6 | verify | `verifying` | NO | typecheck + lint 실행 |
| - | [승인: human_qa] | `pending_human_qa` | - | approvalMode 시 onApproval 콜백 호출 |
| 7 | register | `pending_registration` | NO | boilerplate에 PR 생성 (marker + manifest) |
| - | [승인: registration] | `pending_registration` | - | approvalMode 시 onApproval 콜백 호출 |
| 8 | complete | `registered` | NO | PR merge, status 업데이트 |
| 9 | cleanup | - | NO | worktree 삭제 |

### 승인 게이트 동작

시작 시 `approvalMode` 선택:
- `true` (기본): 각 게이트에서 `callbacks.onApproval(type, context)` 호출. CLI는 Y/N 프롬프트, Desktop은 UI 표시. `"rejected"` 시 해당 단계 재실행 또는 중단.
- `false`: 게이트 건너뛰고 전체 자동 실행.

---

## 3. 인터페이스 정의

### 3.1 Input

```typescript
interface FeatureDevInput {
  prompt: string;              // 사용자의 feature 요청 텍스트
  featureName?: string;        // 명시하지 않으면 AI가 spec에서 추출
  boilerplatePath: string;     // boilerplate repo 로컬 경로
  options?: FeatureDevOptions;
  callbacks?: FeatureDevCallbacks;
}
```

### 3.2 Options

```typescript
interface FeatureDevOptions {
  approvalMode?: boolean;      // default: true
  agent?: "claude" | "codex";  // default: "claude"
  skipVerify?: boolean;        // verify 단계 건너뛰기
  skipRegister?: boolean;      // register~complete 건너뛰기
  worktreeBasePath?: string;   // worktree 생성 위치 (default: ~/.superbuilder/worktrees/)
  featuresSourceDir?: string;  // superbuilder-features 경로 (참조용)
}
```

### 3.3 Callbacks

```typescript
type FeatureDevStep =
  | "createRequest"
  | "generateSpec"
  | "generatePlan"
  | "createWorktree"
  | "implement"
  | "verify"
  | "register"
  | "complete"
  | "cleanup";

interface ApprovalContext {
  featureRequestId: string;
  type: "spec_plan" | "human_qa" | "registration";
  artifacts?: { kind: string; content: string }[];
  summary?: string;
}

interface FeatureDevCallbacks {
  onStep?: (
    step: FeatureDevStep,
    status: "start" | "done" | "skip" | "error",
    message?: string,
  ) => void;
  onLog?: (message: string) => void;
  onApproval?: (
    type: "spec_plan" | "human_qa" | "registration",
    context: ApprovalContext,
  ) => Promise<"approved" | "rejected">;
  onProjectSave?: (record: FeatureDevRecord) => Promise<string | void>;
}
```

### 3.4 Record (DB 저장용)

```typescript
interface FeatureDevRecord {
  featureRequestId: string;
  status: string;
  featureName?: string;
  specContent?: string;
  planContent?: string;
  worktreePath?: string;
  branchName?: string;
  prUrl?: string;
  errorMessage?: string;
}
```

### 3.5 Result

```typescript
interface FeatureDevResult {
  featureRequestId: string;
  featureName: string;
  status: string;
  spec?: string;
  plan?: string;
  worktreePath?: string;
  branchName?: string;
  prUrl?: string;
  verifyPassed?: boolean;
}
```

---

## 4. 각 단계 상세

### 4.1 createRequest

```
API 호출: featureStudio.createRequest({ title, rawPrompt })
→ featureRequestId 반환
→ status: "draft"
```

### 4.2 generateSpec

```
claude CLI spawn:
  claude -p "다음 요청을 분석하여 feature spec을 작성하세요: {prompt}"
  --dangerously-skip-permissions

→ 출력 캡처 → spec 텍스트
→ API 호출: featureStudio.saveArtifact({ kind: "spec", content })
→ status: "spec_ready"
```

### 4.3 generatePlan

```
claude CLI spawn:
  claude -p "다음 spec을 기반으로 구현 계획을 작성하세요: {spec}"
  --dangerously-skip-permissions

→ 출력 캡처 → plan 텍스트
→ API 호출: featureStudio.saveArtifact({ kind: "plan", content })
→ status: "pending_spec_approval"
```

### 4.4 [승인: spec_plan]

```
approvalMode === true:
  → callbacks.onApproval("spec_plan", { spec, plan })
  → "approved" → status: "plan_approved", continue
  → "rejected" → status: "customization", stop or re-generate

approvalMode === false:
  → 자동 통과, status: "plan_approved"
```

### 4.5 createWorktree

```
boilerplatePath에서:
  git worktree add {worktreeBasePath}/{featureName} -b feature/{featureName}

→ API 호출: featureStudio.saveWorktree({ path, branchName })
```

### 4.6 implement

```
worktree 디렉토리에서 claude/codex spawn:
  claude --dangerously-skip-permissions -p "
    다음 plan에 따라 feature를 구현하세요.
    Feature name: {featureName}
    Plan: {plan}

    규칙:
    - packages/features/{name}/ 디렉토리에 코드 작성
    - feature.json 생성
    - marker 블록에 connection 삽입
    - superbuilder.json 업데이트
    - 모든 변경 commit + push
  "

→ status: "implementing" → (완료 후) "verifying"
```

### 4.7 verify

```
worktree 디렉토리에서:
  bun run typecheck
  bun run lint

→ 실패 시: status: "failed", errorMessage 저장
→ 성공 시: status: "verifying" (완료)
```

### 4.8 [승인: human_qa]

```
approvalMode === true:
  → callbacks.onApproval("human_qa", { worktreePath, verifyResult })
  → "approved" → continue
  → "rejected" → status: "customization"

approvalMode === false:
  → 자동 통과
```

### 4.9 register

```
atlas-engine의 registerToBoilerplate() 호출:
  → boilerplate develop 브랜치에 PR 생성
  → marker 삽입, manifest 업데이트

→ prUrl 저장
→ status: "pending_registration"
```

### 4.10 [승인: registration]

```
approvalMode === true:
  → callbacks.onApproval("registration", { prUrl })
  → "approved" → continue
  → "rejected" → PR close, status: "customization"

approvalMode === false:
  → 자동 통과
```

### 4.11 complete

```
gh pr merge {prUrl} --merge
→ status: "registered"
```

### 4.12 cleanup

```
git worktree remove {worktreePath}
git branch -d feature/{featureName}
```

---

## 5. CLI 커맨드

### `/feature-dev`

```bash
# 대화형 (승인 게이트 사용 여부 질문 → 프롬프트 입력)
/feature-dev

# 비대화형
/feature-dev --prompt "블로그 댓글 기능" --name comment --path ~/boilerplate
/feature-dev --prompt "결제 기능" --no-approval --agent codex
```

| 인자 | 설명 | 필수 |
|------|------|------|
| `--prompt` | Feature 요청 텍스트 | 필수 |
| `--name` | Feature 이름 (미지정 시 AI 생성) | 선택 |
| `--path` | Boilerplate repo 경로 | 선택 (env fallback) |
| `--no-approval` | 승인 게이트 건너뛰기 | 선택 |
| `--agent` | claude 또는 codex | 선택 |
| `--skip-verify` | 검증 건너뛰기 | 선택 |
| `--skip-register` | 등록 건너뛰기 | 선택 |

### `/feature-verify` (E2E 검증)

```bash
# compose-e2e-test와 동일한 패턴
/feature-verify
```

파이프라인 전체를 테스트용 feature로 실행하고 체크포인트 검증:

| # | 체크포인트 | 검증 방법 |
|---|-----------|----------|
| 1 | request 생성 | DB에 feature_request 레코드 존재 |
| 2 | spec 생성 | artifact kind=spec 존재, 내용 비어있지 않음 |
| 3 | plan 생성 | artifact kind=plan 존재, 내용 비어있지 않음 |
| 4 | worktree 생성 | 파일시스템에 디렉토리 존재 |
| 5 | feature 구현 | packages/features/{name}/ 디렉토리 존재 |
| 6 | feature.json | 유효한 JSON, 필수 필드 존재 |
| 7 | typecheck | 통과 |
| 8 | lint | 통과 |
| 9 | marker 삽입 | grep으로 marker 블록 내 import 확인 |
| 10 | PR 생성 | gh pr view 성공 |
| 11 | DB 상태 | status = registered |

**Cleanup:** worktree 삭제, PR close, DB 레코드 삭제 (테스트 환경)

---

## 6. 메인 API 프로시저 추가

기존 `packages/trpc/src/router/feature-studio/` 에 추가 필요:

| 프로시저 | 타입 | 용도 |
|----------|------|------|
| `appendMessage` | mutation | 대화/이벤트 로그 저장 |
| `saveArtifact` | mutation | spec/plan 등 산출물 저장 |
| `updateStatus` | mutation | 파이프라인이 직접 상태 변경 |
| `saveWorktree` | mutation | worktree 정보 저장 |
| `createRun` | mutation | 실행 추적 레코드 생성 |
| `updateRun` | mutation | 실행 상태 업데이트 |

`advance` 프로시저: 현재 TODO stub → 상태 머신 로직 구현 (현재 status에 따라 다음 status 결정)

---

## 7. 파일 구조

```
packages/atlas-engine/src/pipeline/
├── compose.ts              (기존 — 프로젝트 생성)
├── feature-dev.ts          (신규 — feature 개발 파이프라인)
├── feature-dev-types.ts    (신규 — 타입 정의)
├── types.ts                (기존 — compose 타입)
└── index.ts                (기존 확장 — export 추가)

packages/trpc/src/router/feature-studio/
├── feature-studio.ts       (기존 확장 — 누락 프로시저 추가)
└── schema.ts               (기존 확장 — 새 input 스키마)

.agents/commands/
├── feature-dev.md          (기존 수정 — 파이프라인 호출)
└── feature-verify.md       (신규 — E2E 검증)
```

---

## 8. 환경변수

| 변수 | 용도 |
|------|------|
| `SUPERBUILDER_FEATURES_PATH` | superbuilder-features 로컬 경로 |
| `BOILERPLATE_PATH` | boilerplate repo 로컬 경로 |
| `ANTHROPIC_API_KEY` | claude CLI 인증 (자동) |

---

## 9. 에러 처리

| 단계 | 실패 시 |
|------|--------|
| createRequest | throw (fatal) |
| generateSpec | throw (fatal) — AI 호출 실패 |
| generatePlan | throw (fatal) |
| createWorktree | throw (fatal) — git 명령 실패 |
| implement | status → "failed", errorMessage 저장, 계속 가능 |
| verify | 실패 내용 기록, 계속 진행 |
| register | status → "failed", errorMessage 저장 |
| complete | PR merge 실패 시 수동 안내 |
| cleanup | non-fatal, 경고만 |
