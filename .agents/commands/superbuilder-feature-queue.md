---
description: Feature Queue — 여러 feature를 한번에 요청하고 자동 큐로 관리하며 순차/병렬 진행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-queue: 배치 Feature 개발 큐

여러 feature 요청을 한번에 제출하면 큐에 쌓이고, 가벼운 것은 병렬로 / 무거운 것은 순차로 자동 진행한다.
각 아이템은 기존 `superbuilderFeatureDevPipeline`을 통해 처리된다.

## 사용 예시

```
/superbuilder-feature-queue 카카오톡 나에게 보내기, 슬랙 채널 웹훅 연동, 카카오 싱크 로그인
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
1. **어떤 기능들을 만들까요?** — 쉼표로 구분하여 입력 (예: `카카오톡 나에게 보내기, 슬랙 웹훅, 카카오 로그인`)
2. **병렬 처리?** — 가벼운 기능은 자동 병렬 (기본 Y)

### Step 2: 복잡도 분류

각 요청을 분석하여 `estimatedComplexity`를 판단한다:

| 복잡도 | 기준 | 예시 |
|--------|------|------|
| `light` | 단일 API 연동, 단순 CRUD, 외부 서비스 래퍼 | 슬랙 웹훅, 카카오 나에게 보내기 |
| `medium` | DB 스키마 + UI + 서버 | 댓글, 좋아요, 투표 |
| `heavy` | 복잡한 비즈니스 로직, 결제, 인증 연동 | 카카오 싱크 로그인, 결제 시스템 |

### Step 3: 배치 제출

서버 API에 배치를 제출한다. `/tmp/superbuilder-queue-submit.ts`를 작성하고 실행:

```typescript
// superbuilder repo에서 실행
const API_URL = process.env.API_URL ?? "http://localhost:3100";

const response = await fetch(`${API_URL}/api/trpc/featureQueue.submitBatch`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.AUTH_TOKEN}`,
  },
  body: JSON.stringify({
    json: {
      title: "{배치 제목}",
      items: [
        { rawPrompt: "{요청1}", title: "{이름1}", estimatedComplexity: "light" },
        { rawPrompt: "{요청2}", title: "{이름2}", estimatedComplexity: "medium" },
        // ...
      ],
      // concurrencyLimit는 서버가 자동 계산 (all light → 전체 병렬)
    }
  }),
});

const { result } = await response.json();
console.log(`배치 생성 완료: ${result.data.json.batch.id}`);
console.log(`아이템 ${result.data.json.items.length}건`);
```

생성된 `batchId`를 기록한다.

### Step 4: 큐 처리 실행

배치의 아이템을 하나씩 (또는 병렬로) 처리한다.

**각 아이템에 대해 `/superbuilder-feature-dev` 와 동일한 과정을 수행한다:**

1. `nextItems` API로 처리할 아이템 조회
2. 아이템 상태를 `processing`으로 업데이트 (sessionId 포함)
3. 해당 아이템의 `rawPrompt`를 기반으로 feature spec → plan → implement → verify
4. 완료 시 `completed`로 업데이트, 실패 시 `failed` + `lastError`
5. 다음 아이템으로 이동

**처리 루프:**

```
while (nextItems가 있음) {
  item = nextItems[0]  // 또는 병렬이면 여러 개
  updateItemStatus(item.id, "processing", sessionId)

  try {
    // superbuilder-feature-dev 과정 실행
    1. Spec 생성 (네가 직접)
    2. Plan 생성 (네가 직접)
    3. Worktree 생성
    4. 코드 구현 (네가 직접)
    5. 검증 (typecheck + lint)

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
📦 배치: "카카오 연동 3종" (batch-id)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] 카카오톡 나에게 보내기 (light)
  ├─ spec: 완료
  ├─ plan: 완료
  ├─ implement: 진행중...
  ├─ verify: 대기
  └─ status: processing

[2/3] 슬랙 채널 웹훅 연동 (light)
  └─ status: pending (병렬 처리 중)

[3/3] 카카오 싱크 로그인 (heavy)
  └─ status: pending
```

### Step 6: 상태 조회 (`--status`)

현재 사용자의 활성 배치 목록을 조회하여 출력:

```
활성 배치 목록:
━━━━━━━━━━━━━

1. "카카오 연동 3종" (abc-123)
   상태: processing | 2/3 완료 | 0 실패
   생성: 2026-03-16 15:30

2. "결제 시스템" (def-456)
   상태: pending | 0/2 완료
   생성: 2026-03-16 14:00
```

## 환경변수

| 변수 | 용도 |
|------|------|
| `API_URL` | 서버 API URL (기본: http://localhost:3100) |
| `AUTH_TOKEN` | 인증 토큰 |
| `FEATURES_REPO_PATH` | superbuilder-features repo 경로 (기본: ~/Projects/superbuilder-features) |

## 기술 참조

- Queue 스키마: `packages/db/src/schema/feature-studio.ts` (featureQueueBatches, featureQueueItems)
- Queue tRPC: `packages/trpc/src/router/feature-queue/`
- Queue Processor: `packages/atlas-engine/src/pipeline/queue-processor.ts`
- Feature Dev Pipeline: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`

$ARGUMENTS
