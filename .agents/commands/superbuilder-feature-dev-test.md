---
description: Feature Dev 파이프라인 실전 테스트 — "투표(voting)" feature를 생성하고 통과할 때까지 반복 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev-test: 투표 Feature 생성 + 반복 검증

## 개요

`superbuilderFeatureDevPipeline()`으로 실제 "투표(voting)" feature를 생성하고,
모든 체크포인트가 통과할 때까지 **수정 → 재검증을 반복**한다.

이 테스트는 단순 hello-world가 아닌 **실전 수준의 feature**를 생성하여
파이프라인의 완성도를 검증한다.

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

`/tmp/superbuilder-feature-dev-test/runner.ts` 저장:

```typescript
import { superbuilderFeatureDevPipeline } from "@superbuilder/atlas-engine";
import { appendFileSync } from "node:fs";

const LOG_FILE = "/tmp/superbuilder-feature-dev-test/pipeline.log";

const result = await superbuilderFeatureDevPipeline(
  {
    prompt: `투표(Voting) 기능을 만들어주세요.

요구사항:
- 게시글이나 댓글에 찬성/반대 투표 가능
- 사용자당 한 번만 투표 가능 (중복 투표 방지)
- 투표 변경 가능 (찬성 → 반대)
- 투표 취소 가능
- 투표 수 집계 (찬성/반대 각각)

서버: NestJS 모듈 (VotingModule, VotingService, VotingController)
- POST /api/votes — 투표 생성/변경
- DELETE /api/votes/:id — 투표 취소
- GET /api/votes/count?targetType=post&targetId=xxx — 집계 조회

클라이언트: React 컴포넌트
- VoteButtons 컴포넌트 (찬성/반대 버튼 + 카운트 표시)
- useVote hook (투표 상태 관리)

DB 스키마 (Drizzle):
- votes 테이블: id, userId, targetType(post|comment), targetId, value(up|down), createdAt, updatedAt
- unique constraint: (userId, targetType, targetId)`,
    featureName: "voting",
    boilerplatePath: process.env.BOILERPLATE_PATH ?? `${process.env.HOME}/Projects/superbuilder-app-boilerplate`,
    options: {
      approvalMode: false,
      agent: "claude",
      skipVerify: false,
      skipRegister: true, // PR 생성은 안 함 (테스트 환경)
    },
  },
  {
    onStep: (step, status, msg) => {
      const line = `[${step}] ${status}: ${msg ?? ""}`;
      console.log(line);
      appendFileSync(LOG_FILE, line + "\n");
    },
    onLog: (msg) => {
      console.log(msg);
      appendFileSync(LOG_FILE, msg + "\n");
    },
  },
);

console.log("\n=== RESULT ===");
console.log(JSON.stringify(result, null, 2));

// 결과를 파일로도 저장
import { writeFileSync } from "node:fs";
writeFileSync(
  "/tmp/superbuilder-feature-dev-test/result.json",
  JSON.stringify(result, null, 2),
);
```

실행:
```bash
cd /Users/bbright/Projects/superbuilder && bun run /tmp/superbuilder-feature-dev-test/runner.ts
```

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
| spec이 너무 짧음 | `superbuilder-feature-dev.ts` → `buildSpecPrompt()` | 프롬프트 보강 |
| plan에 파일 경로 없음 | `superbuilder-feature-dev.ts` → `buildPlanPrompt()` | 프롬프트 보강 |
| agent가 feature.json 안 만듦 | `superbuilder-feature-dev.ts` → `buildImplementPrompt()` | 프롬프트에 feature.json 필수 명시 |
| import 경로 `@superbuilder` 남음 | `superbuilder-feature-dev.ts` → `buildImplementPrompt()` | `@repo/*` 사용 규칙 명시 |
| worktree 생성 실패 | `superbuilder-feature-dev.ts` → createWorktree 단계 | base branch 확인 |
| typecheck 실패 | `superbuilder-feature-dev.ts` → verify 단계 | verify 후 자동 수정 단계 추가 고려 |

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
