---
description: Feature Dev 파이프라인 E2E 검증 — 전체 파이프라인 자동 실행 + 체크포인트 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-verify: Feature Dev E2E 검증

## 개요

feature dev 파이프라인의 전체 흐름을 검증한다.
**현재 agent가 직접** spec/plan/코드를 작성하고, 파이프라인은 인프라(worktree, git, typecheck)만 담당한다.
**superbuilder-features repo의 worktree 안에서 작업**하여 기존 코드를 참조하며 구현한다.
**통과할 때까지 반복한다.**

## 테스트 설정

| 항목 | 값 |
|------|-----|
| Feature 이름 | `e2e-verify-{timestamp}` |
| 프롬프트 | 간단한 hello API + React 페이지 |
| Features Repo | `$FEATURES_REPO_PATH` 또는 `~/Projects/superbuilder-features` |
| 승인 게이트 | false (자동) |
| 등록 | 건너뛰기 (skipRegister: true) |

## 사전 조건

```bash
cd /Users/bbright/Projects/superbuilder
bun run typecheck --filter=@superbuilder/atlas-engine

FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
ls "$FEATURES_REPO/features/"
git -C "$FEATURES_REPO" status --short  # 비어있어야 함
```

## 실행 절차

### Step 1: Worktree 생성 (superbuilder-features에서)

```bash
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
FEATURE_NAME="e2e-verify-$(date +%s)"
WORKTREE="$HOME/.superbuilder/worktrees/$FEATURE_NAME"

mkdir -p "$HOME/.superbuilder/worktrees"
git -C "$FEATURES_REPO" worktree add "$WORKTREE" -b "feature/$FEATURE_NAME"
```

### Step 2: 기존 코드 분석 + Spec 작성 (agent가 직접)

worktree 내에서 기존 feature 구조를 참조 (features/bookmark, features/reaction 등):

- Feature 이름, 설명
- GET /api/hello 엔드포인트 (tRPC router)
- HelloPage React 페이지
- feature.json manifest

### Step 3: Plan 작성 (agent가 직접)

spec 기반으로 구현 계획:
- 정확한 파일 경로 (`features/{name}/src/...`)
- 각 파일의 코드 내용
- package.json exports

### Step 4: 구현 (agent가 직접)

worktree에서 Write/Edit 도구로 코드 작성:
1. `features/{name}/` 디렉토리 생성
2. 서버 코드, 클라이언트 코드
3. `feature.json`, `package.json`, `tsconfig.json`
4. `git add features/{name}/ && git commit`

### Step 5: 검증

```bash
cd $WORKTREE/features/$FEATURE_NAME && npx tsc --noEmit
cd $WORKTREE && npx biome check features/$FEATURE_NAME/src/
```

### Step 6: 체크포인트 검증

| # | 체크포인트 | 검증 커맨드 | 통과 기준 |
|---|-----------|-----------|----------|
| 1 | worktree | `ls $WORKTREE/features/` | 존재 |
| 2 | feature 디렉토리 | `ls $WORKTREE/features/$FEATURE_NAME/` | 존재 |
| 3 | feature.json | `cat $WORKTREE/features/$FEATURE_NAME/feature.json` | 유효한 JSON |
| 4 | 서버 코드 | `ls $WORKTREE/features/$FEATURE_NAME/src/server/` | .ts 파일 |
| 5 | typecheck | `cd $WORKTREE/features/$FEATURE_NAME && npx tsc --noEmit` | 에러 없음 |
| 6 | lint | `cd $WORKTREE && npx biome check features/$FEATURE_NAME/src/` | 에러 없음 |
| 7 | git commits | `git -C $WORKTREE log --oneline` | 1개 이상 |

**하나라도 실패하면 수정 → 재검증 반복.**

### Step 7: Cleanup

```bash
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
git -C "$FEATURES_REPO" worktree remove "$WORKTREE" --force 2>/dev/null || true
git -C "$FEATURES_REPO" branch -D "feature/$FEATURE_NAME" 2>/dev/null || true
```

## 실패 시 대응

| 실패 단계 | 확인 사항 |
|----------|----------|
| worktree | features repo에 uncommitted changes 확인 |
| feature 디렉토리 | agent가 올바른 경로에 파일 생성했는지 |
| feature.json | 필수 필드(id, name, provides) 확인 |
| typecheck | 에러 메시지 분석, import 경로 확인 |

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 참조 features: `superbuilder-features/features/` (bookmark, reaction 등)
- Core contracts: `superbuilder-features/core/` (core-trpc, core-schema, core-ui, core-auth)

$ARGUMENTS
