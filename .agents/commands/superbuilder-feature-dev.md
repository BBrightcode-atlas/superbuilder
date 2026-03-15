---
description: Feature 개발 파이프라인 — spec 생성 → plan → worktree → 구현 → 검증 → 등록까지 한 번에 실행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev: Feature 개발 파이프라인

**너(현재 agent)가 직접** feature를 설계하고 구현한다.
`superbuilderFeatureDevPipeline()`은 인프라(worktree, git, typecheck)만 담당하고,
AI 작업(spec, plan, implement)은 네가 `onGenerate` 콜백을 통해 직접 수행한다.

## 흐름

### Step 1: 사용자 입력 수집

인자가 없으면 대화형으로 묻는다:

1. **feature 이름** — kebab-case (예: `voting`, `comment`)
2. **feature 설명** — 어떤 기능인지 자유롭게
3. **승인 게이트** — 각 단계에서 확인할지 (Y/n)

### Step 2: 파이프라인 실행 스크립트 작성 + 실행

`/tmp/superbuilder-fd-runner.ts`를 작성하고 superbuilder repo에서 실행:

```typescript
import { superbuilderFeatureDevPipeline } from "../packages/atlas-engine/src/pipeline/superbuilder-feature-dev";

const result = await superbuilderFeatureDevPipeline(
  {
    prompt: "{사용자 프롬프트}",
    featureName: "{feature 이름}",
    boilerplatePath: process.env.BOILERPLATE_PATH ?? `${process.env.HOME}/Projects/superbuilder-app-boilerplate`,
    options: {
      approvalMode: {true/false},
      skipVerify: false,
      skipRegister: {true/false},
    },
  },
  {
    onStep: (step, status, msg) => console.log(`[${step}] ${status}: ${msg ?? ""}`),
    onLog: (msg) => console.log(msg),
    onGenerate: async (kind, input, featureName) => {
      // 이 콜백은 파이프라인이 호출하지만, 실제 작업은 agent가 수행해야 한다.
      // 스크립트에서는 placeholder를 반환하고, agent가 별도로 직접 수행한다.
      return `PLACEHOLDER_${kind}`;
    },
  },
);

console.log(JSON.stringify(result, null, 2));
```

**중요: onGenerate는 placeholder다.** 실제 AI 작업은 아래 Step 3-5에서 네가 직접 한다.

### Step 3: Spec 작성

boilerplate 코드 구조를 먼저 파악한 후, feature spec을 작성:

1. boilerplate의 기존 feature 구조 확인 (`ls packages/features/`)
2. `feature.json` 스키마 확인
3. 사용자 요구사항을 분석하여 spec 작성:
   - Feature 이름, 설명
   - 서버 컴포넌트 (NestJS modules, controllers, services)
   - 클라이언트 컴포넌트 (React pages, hooks)
   - DB 스키마 (Drizzle tables)
   - 의존성
   - API endpoints

### Step 4: Plan 작성

spec을 기반으로 구현 계획 작성:
- 생성할 파일 목록 (정확한 경로)
- 각 파일의 코드
- feature.json manifest
- marker 블록 삽입 위치
- connection 정의

### Step 5: 구현

worktree 디렉토리에서 직접 파일을 생성하고 코드를 작성:

1. `packages/features/{name}/` 디렉토리 구조 생성
2. 서버 코드 작성 (module, service, controller)
3. 클라이언트 코드 작성 (pages, hooks, components)
4. DB 스키마 작성
5. `feature.json` 생성
6. marker 블록에 connection 삽입
7. `git add -A && git commit -m "feat({name}): implement feature"`

### Step 6: 검증

파이프라인이 자동으로 실행:
- `bun run typecheck`
- `bun run lint`

실패하면 에러를 분석하고 수정한 후 재검증.

### Step 7: 등록 (선택)

skipRegister가 false이면 파이프라인이:
- `git push origin feature/{name}`
- `gh pr create --base develop`

## 환경변수

| 변수 | 용도 |
|------|------|
| `BOILERPLATE_PATH` | boilerplate repo 경로 (기본: ~/Projects/superbuilder-app-boilerplate) |

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 타입: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts`
- 스펙: `docs/superpowers/specs/2026-03-15-feature-dev-pipeline-design.md`

$ARGUMENTS
