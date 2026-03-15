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

---

## Phase 0: 사전 조건

```bash
# 1. atlas-engine 타입체크
cd /Users/bbright/Projects/superbuilder
bun run typecheck --filter=@superbuilder/atlas-engine

# 2. boilerplate 경로 확인
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
ls "$BOILERPLATE/superbuilder.json"

# 3. boilerplate에 uncommitted changes 없는지 확인
git -C "$BOILERPLATE" status --short
# 출력이 비어있어야 함. 있으면: git -C "$BOILERPLATE" stash

# 4. claude CLI 확인
which claude && claude --version

# 5. 이전 테스트 잔여물 정리
git -C "$BOILERPLATE" worktree list | grep voting && echo "⚠️ 이전 worktree 존재 — 정리 필요"
rm -rf /tmp/superbuilder-feature-dev-test/
mkdir -p /tmp/superbuilder-feature-dev-test/
```

---

## Phase 1: 파이프라인 실행

### 실행 스크립트

이 테스트는 **스크립트를 실행하는 것이 아니라**, agent가 직접 수행한다.
파이프라인 함수는 인프라만 담당하고, AI 작업은 agent가 직접 한다.

### 실행 방법

agent가 아래 순서로 직접 수행:

1. **Worktree 생성**
```bash
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
WORKTREE="$HOME/.superbuilder/worktrees/voting"
mkdir -p "$HOME/.superbuilder/worktrees"
git -C "$BOILERPLATE" worktree add "$WORKTREE" -b "feature/voting"
```

2. **Spec 작성** — agent가 직접 투표 기능 spec 작성
3. **Plan 작성** — agent가 직접 구현 계획 작성
4. **구현** — agent가 worktree에서 Write/Edit 도구로 코드 작성:
   - `packages/features/voting/` 디렉토리
   - 서버 (VotingModule, VotingService, VotingController)
   - 클라이언트 (VoteButtons, useVote)
   - DB 스키마 (votes 테이블)
   - feature.json
   - marker 블록 connection 삽입
   - `git add -A && git commit`
5. **검증** — `bun run typecheck && bun run lint`

---

## Phase 2: 체크포인트 검증 (반복)

파이프라인 실행 후 아래 체크포인트를 **순서대로** 검증한다.
**하나라도 실패하면 원인 분석 → 수정 → 해당 체크포인트부터 재검증.**
**모든 체크포인트 통과할 때까지 반복한다.**

### 검증 대상 경로

```bash
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"
WORKTREE="$HOME/.superbuilder/worktrees/voting"
RESULT="/tmp/superbuilder-feature-dev-test/result.json"
```

### 체크포인트 목록

| # | 체크포인트 | 검증 커맨드 | 통과 기준 | 실패 시 조치 |
|---|-----------|-----------|----------|------------|
| 1 | 파이프라인 완료 | `cat $RESULT \| jq .status` | `"registered"` 또는 spec/plan 존재 | 로그 확인: `cat /tmp/superbuilder-feature-dev-test/pipeline.log` |
| 2 | spec 생성 | `cat $RESULT \| jq '.spec \| length'` | 100 이상 | spawnClaude 에러 확인, claude CLI 동작 확인 |
| 3 | plan 생성 | `cat $RESULT \| jq '.plan \| length'` | 100 이상 | spec이 정상이면 plan prompt 확인 |
| 4 | worktree 존재 | `ls $WORKTREE/package.json` | 파일 존재 | git worktree list로 상태 확인 |
| 5 | feature 디렉토리 | `ls $WORKTREE/packages/features/voting/` | 디렉토리 존재 | agent 출력 로그에서 에러 확인 |
| 6 | feature.json | `cat $WORKTREE/packages/features/voting/feature.json \| jq .id` | `"voting"` | agent가 feature.json 생성 안 했으면 수동 생성 후 재검증 |
| 7 | 서버 코드 | `ls $WORKTREE/packages/features/voting/src/server/` | `.ts` 파일 존재 | plan에 서버 구조 명시 확인 |
| 8 | 클라이언트 코드 | `ls $WORKTREE/packages/features/voting/src/client/` | `.tsx` 파일 존재 | plan에 클라이언트 구조 명시 확인 |
| 9 | DB 스키마 | `grep -r "votes" $WORKTREE/packages/features/voting/` | votes 테이블 정의 존재 | schema 파일 확인 |
| 10 | import 경로 | `grep -r "@superbuilder" $WORKTREE/packages/features/voting/` | 결과 없음 (`@repo/*` 사용) | import-map 변환 확인 |
| 11 | typecheck | `cd $WORKTREE && bun run typecheck 2>&1 \| tail -5` | 에러 없음 | 에러 메시지 분석 후 수정 |
| 12 | lint | `cd $WORKTREE && bun run lint 2>&1 \| tail -5` | 에러 없음 | `bun run lint:fix` 실행 |
| 13 | git commits | `git -C $WORKTREE log --oneline \| head -5` | 1개 이상 commit | agent가 commit 안 했으면 수동 commit |
| 14 | marker 삽입 | `grep -n "VotingModule\|voting" $WORKTREE/apps/server/src/app.module.ts` | import + module 등록 | connection 규칙 확인 |

### 반복 검증 루프

```
ROUND=1
while true:
  echo "=== 검증 라운드 $ROUND ==="

  for checkpoint in 1..14:
    run checkpoint
    if FAIL:
      echo "❌ 체크포인트 $checkpoint 실패"
      analyze_and_fix()  # 원인 분석 + 수정
      break  # 처음부터 다시
    else:
      echo "✅ 체크포인트 $checkpoint 통과"

  if all_passed:
    echo "🎉 모든 체크포인트 통과! (라운드 $ROUND)"
    break

  ROUND++
  if ROUND > 10:
    echo "⚠️ 10회 반복 초과 — 수동 확인 필요"
    break
```

---

## Phase 3: 파이프라인 코드 수정 (실패 시)

체크포인트 실패 원인이 **파이프라인 코드 자체의 문제**인 경우:

| 문제 | 수정 대상 | 수정 내용 |
|------|----------|----------|
| spec이 너무 짧음 | 커맨드 문서의 spec 작성 가이드 보강 | 더 상세한 지시사항 추가 |
| plan에 파일 경로 없음 | 커맨드 문서의 plan 작성 가이드 보강 | 정확한 경로 명시 규칙 추가 |
| agent가 feature.json 안 만듦 | 커맨드 문서에 feature.json 필수 명시 | 체크리스트 추가 |
| import 경로 `@superbuilder` 남음 | agent 구현 시 `@repo/*` 사용 규칙 명시 | import 규칙 강화 |
| worktree 생성 실패 | `superbuilder-feature-dev.ts` → createWorktree 단계 | base branch 확인 |
| typecheck 실패 | agent가 에러 분석 후 수정 → 재검증 | 반복 루프 |

**수정 후 반드시:**
1. `bun run typecheck --filter=@superbuilder/atlas-engine` 통과 확인
2. Phase 1부터 재실행 (cleanup 먼저)
3. Phase 2 체크포인트 재검증

---

## Phase 4: 정리 (Cleanup)

모든 검증 통과 후 또는 테스트 종료 시:

```bash
BOILERPLATE="${BOILERPLATE_PATH:-$HOME/Projects/superbuilder-app-boilerplate}"

# 1. worktree 제거
git -C "$BOILERPLATE" worktree remove "$HOME/.superbuilder/worktrees/voting" --force 2>/dev/null || true

# 2. 브랜치 삭제
git -C "$BOILERPLATE" branch -D "feature/voting" 2>/dev/null || true

# 3. 원격 브랜치 삭제 (push된 경우)
git -C "$BOILERPLATE" push origin --delete "feature/voting" 2>/dev/null || true

# 4. 임시 파일 삭제
rm -rf /tmp/superbuilder-feature-dev-test/
```

---

## Phase 5: 결과 보고

최종 출력:

```
## superbuilder-feature-dev-test 결과

Feature: voting (투표)
검증 라운드: N회

### 체크포인트 결과
| # | 항목 | 상태 |
|---|------|------|
| 1 | 파이프라인 완료 | ✅ |
| 2 | spec 생성 | ✅ |
| ... | ... | ... |
| 14 | marker 삽입 | ✅ |

### 파이프라인 수정 사항 (있는 경우)
- buildSpecPrompt: ... 수정
- buildImplementPrompt: ... 수정

### 소요 시간
- 파이프라인 실행: Xmin
- 검증 라운드: N회, 총 Ymin
```

---

## 기술 참조

- 파이프라인: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 타입: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts`
- 스펙: `docs/superpowers/specs/2026-03-15-feature-dev-pipeline-design.md`
- 계획: `docs/superpowers/plans/2026-03-15-superbuilder-feature-dev.md`

$ARGUMENTS
