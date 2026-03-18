---
description: Feature Queue — 여러 feature를 한번에 요청하고 자동 큐로 관리하며 순차/병렬 진행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-queue: 배치 Feature 개발 큐

여러 feature 요청을 한번에 제출하면 큐에 쌓이고, 가벼운 것은 병렬로 / 무거운 것은 순차로 자동 진행한다.
각 아이템은 `/superbuilder-feature-dev`와 동일한 과정을 수행한다.

## 핵심 원칙: superbuilder-features 내부에서 작업

각 feature 아이템을 처리할 때 **superbuilder-features repo의 worktree 안에서 직접 작업**한다.
기존 feature 코드, core contract를 바로 참조하며 구현하여 일관된 품질을 보장한다.

## 사용 예시

```
/superbuilder-feature-queue 카카오톡 나에게 보내기, 슬랙 채널 웹훅 연동
/superbuilder-feature-queue --resume <batchId>
/superbuilder-feature-queue --status
```

## 흐름

### Step 1: 입력 파싱

`$ARGUMENTS`를 분석한다:

- **`--resume <batchId>`**: 기존 배치 재개 → Step 4로 이동
- **`--status`**: 현재 활성 배치 목록 조회 → Step 6으로 이동
- **그 외**: 쉼표(`,`) 또는 줄바꿈으로 분리하여 feature 요청 목록으로 처리

인자가 없으면 대화형으로 묻는다:
1. **어떤 기능들을 만들까요?** — 쉼표로 구분하여 입력 (예: `카카오톡 나에게 보내기, 슬랙 웹훅`)
2. **병렬 처리?** — 가벼운 기능은 자동 병렬 (기본 Y)

### Step 2: 복잡도 분류

각 요청을 분석하여 `estimatedComplexity`를 판단한다:

| 복잡도 | 기준 | 예시 |
|--------|------|------|
| `light` | 단일 API 연동, 단순 CRUD, 외부 서비스 래퍼 | 슬랙 웹훅, 카카오 나에게 보내기 |
| `medium` | DB 스키마 + UI + 서버 | 댓글, 좋아요, 투표 |
| `heavy` | 복잡한 비즈니스 로직, 결제, 인증 연동 | 결제 시스템, 실시간 채팅 |

### Step 3: 배치 제출

DB에 직접 배치를 생성하거나 서버 API를 통해 제출한다.
생성된 `batchId`를 기록한다.

### Step 4: 큐 처리 실행

배치의 아이템을 하나씩 (또는 병렬로) 처리한다.

**각 아이템마다:**

1. 아이템 상태를 `processing`으로 업데이트
2. **superbuilder-features에서 worktree 생성**: `git worktree add ~/.superbuilder/worktrees/{name} -b feature/{name}`
3. **worktree 안에서 기존 features 참조하며 구현** (핵심!)
   - `ls features/` → 유사 feature 패턴 참조
   - `core/` → core contract 확인
   - spec → plan → implement → verify
4. 완료 시 `completed`로 업데이트 + PR 생성, 실패 시 `failed` + `lastError`
5. 다음 아이템으로 이동

**처리 루프:**

```
while (nextItems가 있음) {
  item = nextItems[0]
  updateItemStatus(item.id, "processing", sessionId)

  try {
    // superbuilder-features worktree에서 직접 작업
    1. Worktree 생성 (superbuilder-features repo에서)
    2. worktree 내 기존 코드 분석
    3. Spec 생성 (네가 직접)
    4. Plan 생성 (네가 직접)
    5. 코드 구현 (네가 직접, worktree 안에서)
    6. 검증 (typecheck + lint, worktree 안에서)
    7. git push + PR 생성

    updateItemStatus(item.id, "completed", resumeToken={결과 정보})
  } catch (error) {
    updateItemStatus(item.id, "failed", lastError=error)
  }

  nextItems = nextItems API 재조회
}
```

**중단 시 재개:**
- 각 아이템에 `sessionId`와 `resumeToken`이 저장됨
- `--resume <batchId>`로 재실행하면 `pending` 상태인 아이템부터 이어서 처리
- 이미 `completed`인 아이템은 건너뜀

### Step 5: 진행 상황 출력

처리 중 아래 형식으로 진행 상황을 출력한다:

```
📦 배치: "카카오 연동 2종" (batch-id)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/2] 카카오톡 나에게 보내기 (light)
  ├─ worktree: ~/.superbuilder/worktrees/kakao-me
  ├─ spec: 완료
  ├─ plan: 완료
  ├─ implement: 진행중...
  ├─ verify: 대기
  └─ status: processing

[2/2] 슬랙 채널 웹훅 연동 (light)
  └─ status: pending
```

### Step 6: 상태 조회 (`--status`)

현재 사용자의 활성 배치 목록을 조회하여 출력.

## 환경변수

| 변수 | 용도 |
|------|------|
| `FEATURES_REPO_PATH` | superbuilder-features repo 경로 (기본: ~/Projects/superbuilder-features) |

## 기술 참조

- Queue 스키마: `packages/db/src/schema/feature-studio.ts` (featureQueueBatches, featureQueueItems)
- Queue tRPC: `packages/trpc/src/router/feature-queue/`
- Queue Processor: `packages/atlas-engine/src/pipeline/queue-processor.ts`
- Feature Dev Pipeline: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- 참조 features: `superbuilder-features/features/` (bookmark, reaction 등)
- Core contracts: `superbuilder-features/core/` (core-trpc, core-schema, core-ui, core-auth)

$ARGUMENTS
