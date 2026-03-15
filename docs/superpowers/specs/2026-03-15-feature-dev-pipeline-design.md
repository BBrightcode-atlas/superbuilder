# Feature Dev Pipeline 설계 스펙

> Feature 개발 전체 흐름의 **인프라 오케스트레이터**.
> AI 작업(spec/plan/implement)은 `onGenerate` 콜백으로 호출자에게 위임.
> CLI에서는 현재 실행 중인 agent가 직접 수행, Desktop에서는 UI/agent session이 수행.

---

## 1. 핵심 원칙

**파이프라인은 인프라만 담당한다.**

| 역할 | 담당 |
|------|------|
| worktree 생성/삭제 | 파이프라인 (`superbuilderFeatureDevPipeline`) |
| git push, gh pr create/merge | 파이프라인 |
| typecheck, lint 실행 | 파이프라인 |
| 승인 게이트 | 파이프라인 → `onApproval` 콜백 |
| **spec 작성** | **호출자** → `onGenerate("spec")` 콜백 |
| **plan 작성** | **호출자** → `onGenerate("plan")` 콜백 |
| **코드 구현** | **호출자** → `onGenerate("implement")` 콜백 |

CLI에서 `/superbuilder-feature-dev` 실행 시 → 현재 agent가 `onGenerate` 콜백을 직접 수행.
Desktop에서 실행 시 → Desktop이 agent session을 통해 수행.
별도 claude CLI를 spawn하지 않는다.

---

## 2. 파이프라인 단계

| # | 단계 | 수행자 | Fatal | 설명 |
|---|------|--------|-------|------|
| 1 | generateSpec | 호출자 (onGenerate) | YES | 사용자 프롬프트 → spec 텍스트 생성 |
| 2 | generatePlan | 호출자 (onGenerate) | YES | spec → plan 텍스트 생성 |
| - | [승인: spec_plan] | 파이프라인 (onApproval) | - | approvalMode 시 호출 |
| 3 | createWorktree | 파이프라인 | YES | boilerplate에 git worktree 생성 |
| 4 | implement | 호출자 (onGenerate) | NO | worktree에서 feature 코드 작성 |
| 5 | verify | 파이프라인 | NO | typecheck + lint |
| - | [승인: human_qa] | 파이프라인 (onApproval) | - | approvalMode 시 호출 |
| 6 | register | 파이프라인 | NO | git push + gh pr create |
| - | [승인: registration] | 파이프라인 (onApproval) | - | approvalMode 시 호출 |
| 7 | complete | 파이프라인 | NO | gh pr merge |
| 8 | cleanup | 파이프라인 | NO | worktree 삭제 |

---

## 3. 인터페이스 정의

### 3.1 Input

```typescript
interface FeatureDevInput {
  prompt: string;              // 사용자의 feature 요청 텍스트
  featureName?: string;        // 명시하지 않으면 onGenerate("spec") 결과에서 추출
  boilerplatePath: string;     // boilerplate repo 로컬 경로
  options?: FeatureDevOptions;
  callbacks?: FeatureDevCallbacks;
}
```

### 3.2 Options

```typescript
interface FeatureDevOptions {
  approvalMode?: boolean;      // default: true
  skipVerify?: boolean;        // verify 단계 건너뛰기
  skipRegister?: boolean;      // register~complete 건너뛰기
  worktreeBasePath?: string;   // default: ~/.superbuilder/worktrees/
}
```

### 3.3 Callbacks

```typescript
type GenerateKind = "spec" | "plan" | "implement";

interface FeatureDevCallbacks {
  onStep?: (step, status, message?) => void;
  onLog?: (message: string) => void;
  onApproval?: (type, context) => Promise<"approved" | "rejected">;
  /**
   * AI 작업 콜백 — 호출자(현재 agent)가 직접 수행.
   * - "spec": prompt → spec 텍스트 반환
   * - "plan": spec → plan 텍스트 반환
   * - "implement": plan → worktree에서 코드 구현 (반환값 무시)
   */
  onGenerate?: (kind: GenerateKind, input: string, featureName: string) => Promise<string>;
}
```

### 3.4 Result

```typescript
interface FeatureDevResult {
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

### 4.1 generateSpec

```
callbacks.onGenerate("spec", userPrompt, featureName)
→ 호출자가 spec 텍스트를 직접 작성하여 반환
→ featureName 미지정 시 spec에서 "FEATURE_NAME: xxx" 추출
```

### 4.2 generatePlan

```
callbacks.onGenerate("plan", specText, featureName)
→ 호출자가 plan 텍스트를 직접 작성하여 반환
```

### 4.3 [승인: spec_plan]

```
approvalMode === true:
  → callbacks.onApproval("spec_plan", { spec, plan })
  → "approved" → continue
  → "rejected" → 종료

approvalMode === false:
  → 자동 통과
```

### 4.4 createWorktree

```
파이프라인이 직접 실행:
  git worktree add {worktreeBase}/{featureName} -b feature/{featureName}
```

### 4.5 implement

```
callbacks.onGenerate("implement", planText, featureName)
→ 호출자가 worktree 디렉토리에서 직접 코드 작성
→ packages/features/{name}/ 생성, feature.json, marker 삽입, commit
```

### 4.6 verify

```
파이프라인이 직접 실행:
  bun run typecheck (worktree에서)
  bun run lint (worktree에서)
→ 실패 시 verifyPassed = false, 계속 진행
```

### 4.7 register

```
파이프라인이 직접 실행:
  git push origin feature/{featureName}
  gh pr create --base develop --title "feat: add {featureName}"
```

### 4.8 complete

```
파이프라인이 직접 실행:
  gh pr merge {prUrl} --merge --delete-branch
```

### 4.9 cleanup

```
파이프라인이 직접 실행:
  git worktree remove {worktreePath} --force
```

---

## 5. CLI 커맨드

### `/superbuilder-feature-dev`

현재 agent가 직접 spec/plan/코드를 작성하고, 파이프라인은 인프라만 담당.

```bash
/superbuilder-feature-dev
/superbuilder-feature-dev --prompt "투표 기능" --name voting
```

### `/superbuilder-feature-verify` (E2E 검증)

전체 파이프라인을 테스트용 feature로 실행하고 체크포인트 검증.

---

## 6. 메인 API 프로시저 (구현 완료)

`packages/trpc/src/router/feature-studio/`:

| 프로시저 | 상태 |
|----------|------|
| `createRequest` | ✅ |
| `getRequest` | ✅ |
| `listQueue` | ✅ |
| `respondToApproval` | ✅ |
| `advance` (상태 머신) | ✅ |
| `appendMessage` | ✅ |
| `saveArtifact` | ✅ |
| `updateStatus` | ✅ |
| `saveWorktree` | ✅ |
| `createRun` | ✅ |
| `updateRun` | ✅ |

---

## 7. 파일 구조

```
packages/atlas-engine/src/pipeline/
├── compose.ts                         (기존 — 프로젝트 생성)
├── superbuilder-feature-dev.ts        (인프라 오케스트레이터)
├── superbuilder-feature-dev-types.ts  (타입 정의)
└── index.ts                           (export)

packages/trpc/src/router/feature-studio/
├── feature-studio.ts                  (13개 프로시저)
└── schema.ts                          (input 스키마)

.agents/commands/
├── superbuilder-feature-dev.md        (CLI 커맨드)
├── superbuilder-feature-verify.md     (E2E 검증)
└── superbuilder-feature-dev-test.md   (실전 테스트 — voting)
```

---

## 8. 환경변수

| 변수 | 용도 |
|------|------|
| `BOILERPLATE_PATH` | boilerplate repo 로컬 경로 |

---

## 9. 에러 처리

| 단계 | 실패 시 |
|------|--------|
| generateSpec | throw (fatal) — onGenerate 콜백 실패 |
| generatePlan | throw (fatal) |
| createWorktree | throw (fatal) — git 명령 실패 |
| implement | 에러 로그, 계속 진행 |
| verify | verifyPassed = false, 계속 진행 |
| register | 에러 로그, 계속 진행 |
| complete | PR merge 실패 시 수동 안내 |
| cleanup | non-fatal |
