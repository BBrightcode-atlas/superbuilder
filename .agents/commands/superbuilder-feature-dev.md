---
description: Feature 개발 파이프라인 — spec 생성 → plan → worktree → 구현 → 검증 → 등록까지 한 번에 실행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev: Feature 개발 파이프라인

**너(현재 agent)가 직접** feature를 설계하고 구현한다.
`superbuilderFeatureDevPipeline()`은 인프라(worktree, git, typecheck)만 담당하고,
AI 작업(spec, plan, implement)은 네가 `onGenerate` 콜백을 통해 직접 수행한다.

## 핵심 원칙: superbuilder-features 내부에서 작업

**에이전트는 superbuilder-features repo의 worktree 안에서 직접 작업한다.**
이렇게 하면:
- 기존 feature 패턴(bookmark, reaction 등)을 직접 참조하며 일관된 구조 유지
- core contract(`@superbuilder/core-*`)의 실제 코드를 보고 정확한 import/사용법 파악
- worktree 내에서 typecheck/lint가 monorepo 컨텍스트에서 실행되어 정확한 검증 가능

## 흐름

### Step 1: 사용자 입력 수집

인자가 없으면 대화형으로 묻는다:

1. **feature 이름** — kebab-case (예: `voting`, `comment`)
2. **feature 설명** — 어떤 기능인지 자유롭게
3. **승인 게이트** — 각 단계에서 확인할지 (Y/n)

### Step 2: superbuilder-features에서 worktree 생성

superbuilder-features repo에서 git worktree를 생성한다:

```bash
FEATURES_REPO=${FEATURES_REPO_PATH:-~/Projects/superbuilder-features}
WORKTREE_PATH=~/.superbuilder/worktrees/{featureName}

cd $FEATURES_REPO
git worktree add $WORKTREE_PATH -b feature/{featureName}
```

### Step 3: 기존 코드 분석 + Spec 작성

**worktree 안에서** 기존 코드를 분석한 후 spec을 작성:

1. 기존 feature 구조 참조: `ls features/` (bookmark, reaction 등 패턴 확인)
2. core contract 확인: `core/` 디렉토리의 core-trpc, core-schema, core-ui, core-auth
3. 유사 feature가 있으면 해당 feature의 구조를 참고
4. 사용자 요구사항을 분석하여 spec 작성:
   - Feature 이름, 설명, 타입(page/widget/agent)
   - 서버 컴포넌트 (NestJS modules, controllers, services, tRPC router)
   - 클라이언트 컴포넌트 (React pages/widgets, hooks)
   - DB 스키마 (Drizzle tables)
   - 의존성, API endpoints

### Step 4: Plan 작성

spec을 기반으로 구현 계획 작성:
- 생성할 파일 목록 (정확한 경로: `features/{name}/src/...`)
- 각 파일의 코드
- feature.json manifest
- package.json exports

### Step 5: 구현

**worktree의 `features/{name}/` 디렉토리에서** 직접 파일을 생성하고 코드를 작성:

1. `features/{name}/` 디렉토리 구조 생성
2. feature.json, package.json, tsconfig.json
3. 서버 코드 (module, service, controller, router)
4. 클라이언트 코드 (pages/widgets, hooks, components)
5. DB 스키마 (필요 시)
6. common 타입
7. `git add features/{name}/ && git commit -m "feat({name}): implement feature"`

### Step 6: 검증

**worktree 내에서** 실행:
- `cd features/{name} && npx tsc --noEmit`
- `npx biome check features/{name}/src/`

실패하면 에러를 분석하고 수정한 후 재검증.

### Step 7: PR 생성 + 등록

```bash
cd $WORKTREE_PATH
git push origin feature/{featureName}
gh pr create --repo BBrightcode-atlas/superbuilder-features --base main --head feature/{featureName}
```

## 환경변수

| 변수 | 용도 |
|------|------|
| `FEATURES_REPO_PATH` | superbuilder-features repo 경로 (기본: ~/Projects/superbuilder-features) |

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 타입: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts`
- 참조 features: `superbuilder-features/features/` (bookmark, reaction 등)
- Core contracts: `superbuilder-features/core/` (core-trpc, core-schema, core-ui, core-auth)

$ARGUMENTS
