---
description: Feature Dev 파이프라인 실전 테스트 — "투표(voting)" feature를 생성하고 통과할 때까지 반복 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev-test: 투표 Feature 생성 + 반복 검증

## 개요

**현재 agent가 직접** "투표(voting)" feature를 설계하고 구현한다.
파이프라인은 인프라(worktree, git, typecheck)만 담당하고,
spec/plan/코드 작성은 agent가 직접 수행한다.
모든 체크포인트가 통과할 때까지 **수정 → 재검증을 반복**한다.

**핵심: superbuilder-features repo의 worktree 안에서 작업**하여
기존 feature 코드와 core contract를 직접 참조하며 구현한다.

---

## Phase 0: 사전 조건

```bash
# 1. atlas-engine 타입체크
cd /Users/bbright/Projects/superbuilder
bun run typecheck --filter=@superbuilder/atlas-engine

# 2. superbuilder-features 경로 확인
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
ls "$FEATURES_REPO/features/"

# 3. features repo에 uncommitted changes 없는지 확인
git -C "$FEATURES_REPO" status --short
# 출력이 비어있어야 함. 있으면: git -C "$FEATURES_REPO" stash

# 4. 이전 테스트 잔여물 정리
git -C "$FEATURES_REPO" worktree list | grep voting && echo "⚠️ 이전 worktree 존재 — 정리 필요"
```

---

## Phase 1: 파이프라인 실행

agent가 아래 순서로 직접 수행:

1. **Worktree 생성** (superbuilder-features에서)
```bash
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
WORKTREE="$HOME/.superbuilder/worktrees/voting"
mkdir -p "$HOME/.superbuilder/worktrees"
git -C "$FEATURES_REPO" worktree add "$WORKTREE" -b "feature/voting"
```

2. **기존 코드 분석** — worktree 내에서 기존 features/ 참조 (bookmark, reaction 등)
3. **Spec 작성** — agent가 직접 투표 기능 spec 작성
4. **Plan 작성** — agent가 직접 구현 계획 작성
5. **구현** — agent가 worktree에서 Write/Edit 도구로 코드 작성:
   - `features/voting/` 디렉토리
   - 서버 (VotingModule, VotingService, VotingController, votingRouter)
   - 위젯 (VoteButtons, useVote)
   - DB 스키마 (votes 테이블)
   - feature.json, package.json, tsconfig.json
   - `git add features/voting/ && git commit`
6. **검증** — `cd features/voting && npx tsc --noEmit` + `npx biome check features/voting/src/`

---

## Phase 2: 체크포인트 검증 (반복)

**하나라도 실패하면 원인 분석 → 수정 → 해당 체크포인트부터 재검증.**

### 검증 대상 경로

```bash
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"
WORKTREE="$HOME/.superbuilder/worktrees/voting"
```

### 체크포인트 목록

| # | 체크포인트 | 검증 커맨드 | 통과 기준 | 실패 시 조치 |
|---|-----------|-----------|----------|------------|
| 1 | worktree 존재 | `ls $WORKTREE/features/` | 디렉토리 존재 | git worktree list로 상태 확인 |
| 2 | feature 디렉토리 | `ls $WORKTREE/features/voting/` | 존재 | agent 출력 로그에서 에러 확인 |
| 3 | feature.json | `cat $WORKTREE/features/voting/feature.json \| jq .id` | `"voting"` | feature.json 수동 생성 후 재검증 |
| 4 | package.json | `cat $WORKTREE/features/voting/package.json \| jq .name` | 패키지명 존재 | 기존 feature 참조하여 생성 |
| 5 | 서버 코드 | `ls $WORKTREE/features/voting/src/server/` | `.ts` 파일 존재 | plan에 서버 구조 명시 확인 |
| 6 | 위젯/클라이언트 | `ls $WORKTREE/features/voting/src/widget/` | `.tsx` 파일 존재 | plan에 위젯 구조 명시 확인 |
| 7 | DB 스키마 | `grep -r "votes" $WORKTREE/features/voting/` | votes 테이블 정의 존재 | schema 파일 확인 |
| 8 | import 경로 | `grep -r "@superbuilder/" $WORKTREE/features/voting/src/` | core-* import만 존재 | @repo/* 사용 안 함 (scaffold 전이므로 @superbuilder/* 사용) |
| 9 | typecheck | `cd $WORKTREE/features/voting && npx tsc --noEmit` | 에러 없음 | 에러 분석 후 수정 |
| 10 | lint | `cd $WORKTREE && npx biome check features/voting/src/` | 에러 없음 | `npx biome check --write --unsafe` |
| 11 | git commits | `git -C $WORKTREE log --oneline \| head -5` | 1개 이상 commit | 수동 commit |

### 반복 검증 루프

```
ROUND=1
while true:
  for checkpoint in 1..11:
    if FAIL: analyze_and_fix() → break
  if all_passed: break
  ROUND++
  if ROUND > 10: "⚠️ 수동 확인 필요" → break
```

---

## Phase 3: Cleanup

```bash
FEATURES_REPO="${FEATURES_REPO_PATH:-$HOME/Projects/superbuilder-features}"

# 1. worktree 제거
git -C "$FEATURES_REPO" worktree remove "$HOME/.superbuilder/worktrees/voting" --force 2>/dev/null || true

# 2. 브랜치 삭제
git -C "$FEATURES_REPO" branch -D "feature/voting" 2>/dev/null || true

# 3. 원격 브랜치 삭제 (push된 경우)
git -C "$FEATURES_REPO" push origin --delete "feature/voting" 2>/dev/null || true
```

---

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 타입: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts`
- 참조 features: `superbuilder-features/features/` (bookmark, reaction 등)
- Core contracts: `superbuilder-features/core/` (core-trpc, core-schema, core-ui, core-auth)

$ARGUMENTS
