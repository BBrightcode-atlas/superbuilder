# Superbuilder 자동화 개발 시스템 — 전체 프롬프트

> **DEPRECATED** — 이 문서는 Flotter에서 가져온 초기 참조용입니다.
> **Canonical source:** `docs/superpowers/specs/2026-04-01-team-organization-design.md`
> 팀 조직, SENTINEL, Gate, dev-state.json 스키마는 canonical source를 따르세요.
> 이 문서는 히스토리 참조용으로만 보존합니다.

> ~~Flotter 엔진 팀에서 검증된 에이전트 기반 자동화 개발 시스템.~~
> ~~이 문서는 superbuilder 팀에 동일 시스템을 적용하기 위한 전체 정책/프로세스/프로토콜 레퍼런스.~~

---

## 1. 조직 원칙 — team > function > pod

### 3계층 조직 구조

```
team (상설 책임 조직)
  └── function (직무 전문성 축 — team 내부)
       └── pod (Feature 실행 단위 — 임시, 목표 달성 후 해산)
```

| 계층 | 성격 | 수명 | 예시 |
|------|------|------|------|
| **team** | 상설. 명확한 책임 경계 | 영구 | PX Team, Core Team, Engine Team |
| **function** | team 내부의 직무 전문성 | 영구 (team 소속) | Design Function, Build Function, Quality Function |
| **pod** | 특정 Feature/목표를 끝내기 위한 크로스 function 단위 | 임시 | onboarding-pod, editor-pod |

**원칙:**
- 직무 기준 상설 pod보다 **feature pod**가 원칙
- CTO는 팀 Lead를 우회하여 직접 에이전트에 지시 금지. 관점 제시만, 실행은 팀 Lead

### 팀 구성 예시 (Flotter 5개 팀)

| 팀 | 스킬/호출 | 책임 | Linear 프로젝트 |
|----|----------|------|----------------|
| **PX Team** | `/flotter-px-team` | 디자인 + 프론트엔드 + 데스크탑 | FLT (`PX:` 접두어) |
| **Core Team** | `/flotter-core-team` | 서버 API + 도메인 로직 + DB | FLT (`CORE:` 접두어) |
| **Engine Team** | `/flotter-engine-team` | 그래프 렌더링 엔진 코어 | FLE (전용) |
| **Platform Team** | — | 인프라 + 배포 + CI/CD | FLT (`PLAT:` 접두어) |
| **AI Platform Team** | — | AI Gateway + 모델 라우팅 + eval | FLT (`AI:` 접두어) |
| **CTO** | `/flotter-cto` | 기술 오피니언 리더 (Tech Radar, ADR, 팀 간 정렬) | — |

---

## 2. 에이전트 역할 정의 — 3개 디비전 구조

각 팀은 **Design / Build / Quality** 3개 디비전으로 나뉜다.

### Design Division (설계)

| 에이전트 | 역할 | 산출물 | 금지 사항 |
|----------|------|--------|----------|
| **Architect** | 아키텍처 설계, 5단계 플랜, ADR, GoF 패턴 | 플랜 문서, ADR | **코드 작성 금지** |
| **DX Designer** | 소비자 API 설계, 타입 가이드, 에러 메시지 | API 스펙, DX 가이드 | **코드 작성 금지** |

### Build Division (구현)

| 에이전트 | 담당 | 핵심 책임 |
|----------|------|----------|
| **Programmer** | 핵심 로직, 데이터 모델, 인터랙션 | TDD 필수. 실패 확인 → 구현 → 통과 확인 |
| **Renderer** | UI/렌더링, 시각 품질 | DPI 대응, 셰이더, Canvas |
| **VFX** | 이펙트, 애니메이션 | 검증된 레퍼런스 기반만 구현 (직접 작성 금지) |
| **Refactorer** | 구조적 부채 해소 | Lead 승인 하에만 작업. 리팩토링 후 스펙/상태 파일 갱신 |

### Quality Division (품질)

| 에이전트 | 검증 수단 | 핵심 책임 |
|----------|----------|----------|
| **QA** | vitest, Playwright, 스크린샷 | 독자 테스트 3개+, 경계값 5개+, 발견 0개는 고무도장으로 반려 |
| **Profiler** | Chrome DevTools, flame graph | ms 단위 측정값 필수. 수치 없는 성능 주장 불인정 |

### External — SENTINEL (독립 검증관)

| 항목 | 설명 |
|------|------|
| **실행 모델** | Codex/GPT (OpenAI) — Claude 에이전트가 아닌 외부 AI |
| **호출 방식** | `/codex:adversarial-review` |
| **코드 접근** | read-only sandbox. 수정 불가 |
| **핵심 목적** | Claude 팀의 합의 편향(consensus bias) 차단. 다른 AI 모델의 시각으로 독립 검증 |
| **마인드셋** | "이것은 틀렸다"가 기본 전제. PASS는 증거로 획득하는 것 |

---

## 3. 전체 워크플로우 — Gate 기반 Phase 진행

```
Phase 시작
  │
  ▼ [Plan Harness Gate] — 5단계 플랜이 있는가?
  │
  ├─ NO → Architect 디스패치 → 5단계 플랜 작성
  │
  ▼ [SENTINEL Gate 1] — 플랜 검증
  │  REJECT → Architect 반환 (최대 3회)
  │  PASS ↓
  │
  ▼ Programmer / Renderer TDD 구현 (독립 시 병렬 가능)
  │
  ▼ [SENTINEL Gate 2] — 코드 검증 (핵심 모듈 변경 시 필수)
  │  REJECT → 해당 에이전트 반환
  │  PASS ↓
  │
  ▼ QA — 독자 테스트 + 경계값 + 시각 검증
  │
  ▼ [SENTINEL Gate 3] — QA 고무도장 탐지
  │  RUBBER_STAMP → QA 재수행
  │  GENUINE ↓
  │
  ▼ [SENTINEL Gate 4] — Phase/Milestone 최종 SHIP/BLOCK
  │  BLOCK → 해당 디비전 반환
  │  SHIP ↓
  │
  ▼ state.json 업데이트 → Phase/Milestone 완료
```

### TDD 사이클 (Build Division 필수)

```
테스트 작성 → 실행(실패 확인) → 구현 → 실행(통과 확인) → 전체 테스트 → 빌드 → 커밋
```

- 실패하는 테스트 없이 구현 코드를 먼저 작성하지 않는다
- 매 스텝마다 전체 테스트 통과 확인
- 매 스텝마다 빌드 확인

### 매 스텝 완료 시 검증 (예외 없음)

```bash
# 1. 해당 스텝 테스트 (실패→구현→통과 사이클 확인)
pnpm vitest --run src/__tests__/{module}/{test}.test.ts

# 2. 전체 테스트 (regression 확인)
pnpm vitest --run

# 3. 빌드 검증 (import/export 정상)
pnpm build

# 4. 레이어 위반 검사
# 하위 레이어가 상위 레이어를 import하면 위반

# 5. 연결 검증 (선언만 하고 wiring 안 한 것 탐지)
# - 삭제한 심볼: 참조 0 확인
# - 추가한 export: 호출하는 곳 존재 확인
# - Props 추가: 실제 사용되는지 확인
```

5단계 모두 통과해야 커밋 가능.

---

## 4. 플랜 하네스 — 막개발 방지

> **플랜 없이 코드 없다. 플랜이 부실하면 코드도 부실하다.**

### 5단계 필수 구성 (모두 갖춰야 구현 시작 가능)

#### 1단계: 문제 (Problem)
현재 상태 → 목표 상태. 1~3문장.

```
문제: GraphEngine은 순수 TS 클래스라서 React 컴포넌트에서 사용하려면
canvas 생성, 인스턴스 생성, 이벤트 리스너 등록, destroy를 수동으로 해야 한다.
→ <GraphCanvas /> 한 줄로 가능하게 한다.
```

#### 2단계: 구조 (Structure)
어떤 클래스/함수/모듈이 필요한가. 각각의 소유/의존/책임.

```typescript
class GraphStore {
  // 소유: nodes, edges, viewport, selection 상태
  // 의존: GraphEngine (EventBus 구독)
  // 책임: EventBus 이벤트 → React 상태 변환
}
```

#### 3단계: 인터페이스 (Interface)
모든 public 메서드의 TypeScript 시그니처.

규칙:
- 모든 public 메서드: `이름(input): output` 명시
- input 파라미터 3개 이상 → **타입으로 객체화**
- output이 복합 구조 → **타입 정의**
- private 메서드도 목록 나열
- 어떤 서브시스템에 위임하는지 명시

```typescript
// ─── Public ───
getNodes(): GraphNode[]
// input: 없음
// output: GraphNode[] — 현재 노드 전체
// 위임: this.graph.getNodeIds() → buildGraphNode()

deleteElements(input: DeleteElementsInput): DeleteElementsResult
// input: { nodes?: { id }[], edges?: { id }[] }
// output: { deletedNodes: string[], deletedEdges: string[] }

// ─── Private ───
private buildGraphNode(id: string): GraphNode | undefined
```

#### 4단계: 데이터 흐름 (Flow)
input → 처리 → output 시퀀스. 코드 레벨로.

```
사용자 드래그
  → PointerRouter.onPointerMove
  → DragController.updateDrag(screenPos, worldPos)
  → engine.events.emit(NODE_DRAG, { id, position })
  → Controlled 모드:
      → onNodesChange([{ type: 'position', id, position }])
      → 소비자 applyNodeChanges → setNodes
  → Uncontrolled 모드:
      → graph.updatePosition(id, x, y) 직접 적용
```

#### 5단계: 검증 기준 (Verification)
실행 가능한 assertion.

```
- [ ] engine.getNodes() → GraphNode[] 반환, 노드 3개 추가 후 length === 3
- [ ] engine.deleteElements({ nodes: [{ id: 'n1' }] }) → 'n1' 삭제 + 연결 엣지 연쇄 삭제
- [ ] Controlled 모드: addNode 호출 → graph에 미반영 + onNodesChange 발화
```

### 위반 패턴 (구현 시작 금지)

| 패턴 | 문제 | 수정 |
|------|------|------|
| `P7.1: GraphProvider + GraphCanvas` | 제목만, 내용 0 | 5단계 전부 작성 |
| `// TODO: 나중에 구현` | 인터페이스 미정의 | 시그니처 먼저 |
| `options?: any` | input 타입 미정의 | 구체 타입 정의 |
| `returns result` | output 타입 미정의 | 타입 명시 |
| 파라미터 4개+ 나열 | 객체화 안 됨 | `Options` 타입으로 묶기 |
| "~와 비슷하게 구현" | 구조 미정의 | 클래스/메서드 나열 |
| "정상 동작 확인" | assertion 아님 | expect() 수준으로 |

---

## 5. Cross-Verification 프로토콜 — 빈껍데기 방지

> **모든 역할은 이전 역할의 산출물을 "틀렸다"는 전제로 검증한다.**
> **Claude 팀 산출물은 SENTINEL(Codex/GPT)이 독립적으로 재검증한다.**

### Gate 1: 플랜 검증 — Architect 산출물 수령 후

| # | 확인 항목 | 통과 기준 | 실패 예시 |
|---|----------|----------|----------|
| 1 | 모든 public 메서드에 시그니처 | `method(input: Type): ReturnType` | `"getNodes 등을 구현"` |
| 2 | input 타입이 구체적 | `{ nodes: { id: string }[] }` | `options?: any` |
| 3 | output 타입이 구체적 | `DeleteElementsResult` | `returns result` |
| 4 | 데이터 흐름이 코드 레벨 | `engine.getNodes() → graph.getNodeIds()` | `"노드 목록을 가져온다"` |
| 5 | 검증 기준이 assertion | `expect(store.count).toBe(3)` | `"정상 동작 확인"` |
| 6 | GoF 패턴명 명시 | `Mediator 패턴으로 EventBus 라우팅` | 패턴명 없이 구조 설명 |
| 7 | 근거 라이브러리 인용 | `tldraw의 StateNode 계층 FSM 참조` | 근거 없이 추천 |

**1개라도 실패 → Architect에게 반환. 구체적 누락 항목 지적.**

### Gate 2: 구현 검증 — Programmer/Renderer 산출물 수령 후

| # | 확인 항목 | 빈껍데기 예시 |
|---|----------|-------------|
| 1 | 실제 알고리즘 존재 | `Map`에 `get/set`만 있는 "매니저" 클래스 |
| 2 | 입력→출력 변환 존재 | 입력을 그대로 전달만 하는 래퍼 |
| 3 | 엣지 케이스 처리 | 해피 패스만 처리 |
| 4 | 이벤트 배선 실제 동작 | `emit()` 있지만 아무도 `on()` 안 함 |
| 5 | 테스트가 실제 동작 검증 | `toBeDefined()`, `not.toBeNull()` 만 |

**빈껍데기 자동 탐지 스크립트:**

```bash
FILE="$1"

# Map wrapper — get/set/delete만 있고 로직 없음
METHODS=$(grep -c "get\|set\|delete\|has\|clear\|size" "$FILE")
LOGIC=$(grep -c "if\|for\|while\|switch\|Math\.\|reduce\|filter\|&&\|||" "$FILE")
if [ "$METHODS" -gt 5 ] && [ "$LOGIC" -lt 3 ]; then
  echo "SHELL SUSPECT: Map wrapper — $METHODS accessors, $LOGIC logic"
fi

# 테스트가 존재만 확인
EXISTENCE=$(grep -c "toBeDefined\|not\.toBeNull\|toBeTruthy" "$FILE")
VALUE=$(grep -c "toBe(\|toEqual(\|toContain(\|toHaveLength(\|toThrow(" "$FILE")
if [ "$EXISTENCE" -gt "$VALUE" ]; then
  echo "SHELL SUSPECT: 존재확인($EXISTENCE) > 값확인($VALUE)"
fi

# emit만 하고 on이 없음
EMITS=$(grep -c "\.emit(" "$FILE")
ONS=$(grep -c "\.on(" "$FILE")
if [ "$EMITS" -gt 3 ] && [ "$ONS" -eq 0 ]; then
  echo "SHELL SUSPECT: emit $EMITS, on 0 — 수신자 없음"
fi
```

**Lead의 Step 완료 선언 전 3가지 직접 확인:**
1. **코드를 열어본다** — "이 파일에 실제 알고리즘이 있는가?"
2. **테스트를 열어본다** — 값 확인(toBe/toEqual) > 존재 확인(toBeDefined)인가?
3. **호출자를 확인한다** — 자기 파일 외에 호출자가 0이면 → 고아 → 미완료

### Gate 3: QA 고무도장 탐지

| # | 확인 항목 | 고무도장 예시 |
|---|----------|-------------|
| 1 | QA가 독자적 테스트 작성 | Programmer 테스트 실행만 하고 "통과" |
| 2 | 경계값 테스트 (0, 1, MAX, null) | 정상 케이스 3개만 |
| 3 | 에러 케이스 테스트 | 해피 패스만 |
| 4 | 성능 수치 포함 | "빠르게 동작함" |
| 5 | 시각 검증 (UI 변경 시) | "렌더링 정상" 한 줄 |
| 6 | 최소 1개 발견 사항 | 아무 발견 없이 통과 |

**QA 강제 산출물 형식 (이것 없으면 QA 미완료):**

```markdown
## QA Report — Phase {X.Y}

### 1. 독자적 테스트 (Programmer가 안 쓴 것)
- test: {설명} → {결과}
(최소 3개)

### 2. 경계값/에러 테스트
- test: 0개 항목에서 getItems() → []
- test: 존재하지 않는 ID로 getItem('xxx') → undefined
- test: 100K 항목 추가 후 성능 → {N}ms
(최소 5개)

### 3. 빈껍데기 탐지 결과
- {파일}: 알고리즘 {있음/없음}, 호출자 {N}개, 테스트 깊이 {값/존재}
(새로 추가된 파일 전부)

### 4. 발견 사항
- BUG: {있으면}
- CONCERN: {있으면}
- IMPROVEMENT: {있으면}
(0개여도 "확인한 항목 목록"은 기재)

### 5. 시각 검증 (UI 변경 시)
- 스크린샷: {경로}
- 반응형: desktop/tablet 확인 → {결과}
```

---

## 6. SENTINEL 독립 검증 시스템

### 3계층 프롬프트 구조

**계층 1 — MINDSET (적대적 기본 자세)**
```
"이것은 틀렸다"가 기본 전제.
PASS는 증거로 획득하는 것.
문제를 못 찾았다 = 충분히 안 봤다.
```

**계층 2 — HISTORICAL BUGS (실제 발생한 오류 패턴)**
```
- Map wrapper 패턴: get/set/delete만 있고 로직 없는 클래스
- 고아 모듈: export만 하고 아무도 import 안 함
- 얕은 테스트: toBeDefined()만 사용
- 레이어 위반: 하위 레이어가 상위 import
- 렌더 루프 GC: new, {}, [], .map() 등
- 이벤트 미배선: emit은 있지만 on이 없음
- QA 고무도장: Programmer 테스트만 실행하고 통과 보고
```

**계층 3 — WHAT TO FIND + HOW TO REPORT**
```
Gate별 구체적 탐지 항목 + 판정 형식.
SHIP (통과) / BLOCK (차단) 판정.
```

### 호출 빈도

| 시점 | 호출 여부 |
|------|----------|
| 매 플랜 제출 | 필수 (Gate 1) |
| 매 스텝 커밋 | 선택적 — 핵심 타입 변경, 렌더링 변경, 새 클래스 3개+ 시 필수 |
| Phase 완료 | 필수 (Gate 2 전체) |
| QA 보고서 | 필수 (Gate 3) |
| Milestone 완료 | **절대 필수** (Gate 4 — 없이 Milestone 완료 불가) |

### SENTINEL 결과 매핑

| Codex 결과 | Lead 해석 |
|-----------|----------|
| SHIP / No critical | PASS |
| BLOCK / Critical | REJECT (해당 에이전트 반환) |
| Warnings only | PASS_WITH_CONCERNS |
| Codex 타임아웃 | RETRY (1회. 2회 실패 시 Lead 수동 검증) |

### SENTINEL 검증 8개 영역

1. **아키텍처** — 레이어 위반, 순환 의존
2. **성능** — 렌더 루프 GC, 불필요한 할당
3. **빈껍데기** — Map wrapper, 1줄 위임
4. **배선(Wiring)** — emit/on 짝, Props 실제 사용
5. **타입 안전성** — any, as 캐스팅
6. **GoF 패턴** — 적절한 패턴 적용
7. **에러 처리** — 구체적 에러 메시지
8. **엣지 케이스** — 0, null, MAX, 중복

### SENTINEL이 잡을 수 없는 것 (Quality Division 책임)

- 런타임 FPS / 실제 성능
- UI/시각 품질
- 이벤트 배선 런타임 동작
- 대규모 스케일 실제 테스트
- 브라우저 호환성

### SENTINEL 금지 사항

- 결과 무시하고 진행 금지
- 결과 요약/축소 금지
- REJECT 3회 후 계속 재시도 금지 → USER 에스컬레이션
- Milestone 완료 시 SENTINEL 없이 진행 금지

---

## 7. 에이전트 공통 프로토콜

### Completion Status — 4단계 결과 보고

| Status | 의미 | 사용 시점 |
|--------|------|----------|
| **DONE** | 전체 완료. 증거 포함. | 모든 검증 통과 |
| **DONE_WITH_CONCERNS** | 완료했지만 우려 있음 | 동작하나 엣지 케이스, 성능, 구조적 우려 |
| **BLOCKED** | 진행 불가 | 외부 의존, 접근 불가, 3회 실패 |
| **NEEDS_CONTEXT** | 정보 부족 | 스펙 모호, 결정 필요 |

```markdown
## Status: {DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT}

### 완료 항목
- {구체적 항목 + 증거}

### 우려 사항 (DONE_WITH_CONCERNS 시)
- CONCERN: {설명} — 영향: {무엇에} — 제안: {해결 방법}

### 차단 (BLOCKED 시)
- REASON: {1-2문장}
- ATTEMPTED: {시도한 것 3가지}
- RECOMMENDATION: {다음 행동}
```

### 에스컬레이션 프로토콜 — 3회 실패 시 STOP

| 규칙 | 설명 |
|------|------|
| **3회 시도 실패 → STOP** | 같은 문제를 3번 시도해도 해결 안 되면 즉시 멈춤 |
| **보안 관련 불확실 → STOP** | 확신 없는 보안 변경은 시도하지 않음 |
| **검증 범위 초과 → STOP** | 자신이 확인할 수 없는 범위면 보고 |

**"나쁜 결과물은 결과물 없음보다 나쁘다."** 확신 없으면 멈추는 게 낫다.

### Depth Score — 깊이 정량화

| 점수 | 의미 |
|------|------|
| **10** | 실제 알고리즘 + 경계값 + 성능 벤치마크 + 프로덕션 호출자 + 시각 검증 |
| **8** | 실제 알고리즘 + 주요 경계값 + 호출자 존재 |
| **7** | 동작하지만 경계값 부족 또는 벤치마크 없음 |
| **5** | 기본 동작하나 구조적으로 부족 |
| **3** | Map wrapper / 1줄 위임 / 빈껍데기 |
| **1** | 타입만 있고 로직 0 |

**7 미만 모듈이 있으면 DONE_WITH_CONCERNS로 보고.**

### Search 3-Layer — 지식 출처 구분 (Architect 필수)

| Layer | 의미 | 신뢰도 |
|-------|------|--------|
| **L1: Tried & True** | 10년+ 검증된 패턴 | 높음 — 하지만 전제 재검토 |
| **L2: New & Popular** | 최근 트렌드, 초기 | 중간 — 비판적 수용 |
| **L3: First Principles** | 우리 문제에 대한 원리적 추론 | 최고 — 독자적 발견 |

**Eureka (L3 발견)**: 기존 관행이 우리 상황에 맞지 않는 발견. `eureka.jsonl`에 기록. 세션당 0~1개가 정상.

### 핸드오프 스키마 — 디비전 간 전달 시 필수

```markdown
## Handoff: {보내는 에이전트} → {받는 에이전트}

### 변경 파일
- {파일 경로}: {무엇을 변경/추가/삭제했는가}

### 계약 변경 (있으면)
- {인터페이스/타입/API가 바뀌었으면 명시}

### 남은 리스크
- {알려진 미완성 부분, 엣지 케이스}

### 다음 에이전트 입력
- {다음 에이전트가 읽어야 할 파일/플랜/섹션}
```

### Session Awareness — 병렬 실행 인식

| 세션 수 | 행동 |
|---------|------|
| 1 | 정상 진행 |
| 2+ | 파일 충돌 주의. 자기 담당 디렉토리만 수정 |
| 3+ | 상태 파일 업데이트는 read → modify → write 원자적으로 |

---

## 8. Linear 연동

### 계층 매핑

| Linear 엔티티 | 개발 팀 매핑 | 예시 |
|---------------|-------------|------|
| Team | 팀 | FLT (공유), FLE (Engine 전용) |
| Project | 팀 내 프로젝트 | `PX: Design System`, `Graph Engine` |
| Project Milestone | 마일스톤 | M1 Foundation, M9 Scale 1M |
| Issue | Phase | `[P10.1] 더블버퍼링 구현` |
| Sub-issue | Step | `[P10.1.1] CPU 준비 버퍼 분리` |

### 상태 흐름

```
Backlog → Todo (플랜 작성 중 / Gate 1 대기)
  → In Progress (Build 착수)
  → In Review (QA + SENTINEL Gate 2~4)
  → Done (모든 Gate 통과)
```

### Label 체계

| Label | 의미 |
|-------|------|
| `Design` | 설계 중 |
| `Build` | 구현 중 |
| `Quality` | QA 진행 중 |
| `SENTINEL Pass` (초록) | SENTINEL 검증 통과 |
| `SENTINEL Block` (빨강) | SENTINEL 검증 차단 |
| `Refactor` | 리팩토링 |
| `Bug` | 버그 |
| `Feature` | 신규 기능 |

### 자동화 시점

| 이벤트 | Linear 액션 |
|--------|------------|
| Phase 시작 | Issue 생성 → `Todo` + `Design` Label + Milestone 할당 |
| SENTINEL Gate 1 통과 | Comment "SENTINEL PASS" + `In Progress` + `Build` Label |
| SENTINEL Gate 2 REJECT | `SENTINEL Block` Label |
| QA 시작 | `In Review` + `Quality` Label |
| SENTINEL Gate 4 SHIP | `Done` + Comment "SENTINEL SHIP" |

---

## 9. 상태 파일 관리 (`dev-state.json`)

### 스키마

```json
{
  "version": 1,
  "spec": "docs/specs/{spec-file}.md",
  "currentMilestone": "M3",
  "currentPhase": "3.2",
  "currentStep": "3.2.1",
  "roadmap": "docs/plans/{roadmap-file}.md",
  "plan": "docs/plans/{plan-file}.md",
  "milestones": {
    "M1": {
      "status": "completed",
      "title": "Foundation",
      "estimate": "30h",
      "depends": [],
      "phases": {
        "1.1": {
          "status": "completed",
          "title": "프로젝트 스캐폴딩",
          "steps": {
            "1.1.1": "completed",
            "1.1.2": "completed"
          }
        },
        "1.2": {
          "status": "in-progress",
          "title": "핵심 모듈 구현",
          "steps": {
            "1.2.1": "completed",
            "1.2.2": "pending"
          }
        }
      }
    }
  }
}
```

### 상태 업데이트 규칙

| 시점 | 업데이트 내용 |
|------|-------------|
| Phase 시작 | `status: "in-progress"` |
| Step 완료 (TDD + 검증 통과) | `step: "completed"` |
| Phase 전체 완료 | `phase.status: "completed"` |
| Milestone Gate 통과 | `milestone.status: "completed"` + `gateResults` |
| **모든 상태 변경 후** | **즉시 파일 쓰기** |

---

## 10. 디자인 하네스 — 막디자인 방지

> **DESIGN.md 없이 화면 없다. 검증 없이 완료 없다.**

### 핵심 원칙

1. **디자인 없이 화면 없다**: DESIGN.md 존재 + Director 브리프 + 사용자 승인 → 그 후 HTML/UI 작성
2. **검증 없이 완료 없다**: 모든 UI 산출물은 Critic 검증 통과 필수
3. **DESIGN.md가 진실 공급원**: 하드코딩 색상/사이즈 금지. 토큰만 사용

### Critic 하드 룰 예시 (HR-01 ~ HR-12)

| Rule | 대상 | 핵심 |
|------|------|------|
| HR-01 | Spacing | 정의된 그리드 값만 허용 |
| HR-02 | Color | CSS 변수만 사용 |
| HR-03 | Font Family | 지정된 폰트만 사용 |
| HR-04 | Font Size | 허용된 사이즈만 |
| HR-05 | Font Weight | 허용된 weight만 |
| HR-06 | Border Radius | 허용된 값만 |
| HR-07 | Layout | 정의된 레이아웃 규격 |
| HR-08 | Line Height | 허용된 값만 |
| HR-09 | Motion | 허용된 duration/easing만 |
| HR-10 | Component | 네이티브 HTML 직접 사용 금지 |
| HR-11 | Tone | 기술 용어 노출 금지. 사용자 친화 |
| HR-12 | Theme | 디자인 시스템 패턴 준수 |

### DESIGN.md 변경 시 영향 분석 필수

```
변경 요청
  → 1. 영향받는 UI 파일 수 확인 (grep)
  → 2. 위험도 분류 (낮음/중간/높음/매우 높음)
  → 3. 사용자 승인
  → 4. 변경 실행
  → 5. 전체 UI 재검증
  → 6. 충돌 발견 시 → UI 수정 또는 변경 롤백
```

---

## 11. 스킬 Boot Sequence

팀 스킬이 로드되면 매 세션마다 실행하는 부트 시퀀스:

```
Step 0: Session Awareness (병렬 에이전트 수 확인)
Step 1: 팀 매니페스트 읽기 + state.json 읽기 + Spec 읽기 + git status
Step 2: 이전 테스트 통과 확인 (실패 시 regression 수정 먼저)
Step 3: 대시보드 출력 (마일스톤 진행률 시각화)
Step 4: 팀 디스패치 (즉시 실행 — 묻지 않고 시작)
```

**Iron Rule**: 스킬이 로드되면 즉시 작업을 시작하거나 이어간다. 사용자에게 "무엇을 할까요?"라고 묻지 않는다.

**예외 (사용자 확인 필요):**
- VFX 레퍼런스 선택
- 아키텍처 결정 (ADR)
- 스코프 변경
- Milestone 완료 선언

---

## 12. 에스컬레이션 경로

```
에이전트 자체 해결 시도 (3회)
  → 실패 → BLOCKED 보고 → Lead
  → Lead 해결 불가 → USER 에스컬레이션
  → 디비전 간 충돌 → Lead 중재 (근거 라이브러리 인용)
  → 아키텍처 결정 → Architect ADR → USER 승인
  → SENTINEL 3회 연속 BLOCK → USER 에스컬레이션
```

### 장애 등급 (Platform Team 참고)

| 등급 | 기준 | 대응 |
|------|------|------|
| P0 | 서비스 전체 다운 | 즉시 롤백, 15분 내 파악, USER 즉시 알림 |
| P1 | 기능 일부 불가 | 1시간 내 원인, 핫픽스/롤백 |
| P2 | 기능 저하 | 다음 스프린트 수정 |
| P3 | 미미한 이슈 | 백로그 |

---

## 13. 디자인 패턴 필수 규칙

| 패턴 | 적용 위치 | 검증 기준 |
|------|----------|----------|
| **Facade** | 메인 엔트리 클래스 | 소비자가 서브시스템 직접 조립하지 않음 |
| **Mediator** | 내부 통신 | 서브시스템 간 직접 import 없음. 이벤트 간접 통신 |
| **Observer** | 이벤트 시스템 | `on()/off()/emit()` 표준 API |
| **Strategy** | 교체 가능한 구현 | 구체 클래스 import 금지. 인터페이스 의존 |
| **Command** | Undo/Redo | `execute()`/`undo()` 필수 |
| **State Machine** | 복잡한 상태 전환 | boolean flag로 상태 관리 금지 |
| **Registry** | 확장 가능한 타입 등록 | `register(name, config)` + `getOrDefault()` |

---

## 14. 금지 사항 총정리

| 금지 | 이유 | 대안 |
|------|------|------|
| 플랜 없이 코드 작성 | 막개발 | 5단계 플랜 먼저 |
| 검증 없이 완료 선언 | 신뢰 위반 | 증거(테스트 결과) 필수 |
| `any` 타입 | 타입 안전성 | 제네릭 또는 `unknown` |
| 테스트 없는 커밋 | TDD 위반 | 실패→구현→통과 사이클 |
| 서브시스템 간 직접 import | Mediator 위반 | EventBus 간접 통신 |
| Lead 우회하여 에이전트 직접 지시 | 조직 원칙 위반 | Lead 경유 |
| SENTINEL 결과 무시 | 독립 검증 무력화 | 결과 반영 또는 USER 에스컬레이션 |
| QA 고무도장 | 품질 무력화 | 독자 테스트 3개+ 경계값 5개+ 필수 |
| 빈껍데기 코드 | 기술 부채 | 실제 알고리즘 + 호출자 확인 |
| "이 정도면 되지" 태도 | 품질 타협 | 기준 미달 시 개선 후 재검증 |

---

## 파일 구조 요약

```
.claude/
├── agents/                        # 팀/에이전트 매니페스트
│   ├── {team}-team.md             # 팀 매니페스트
│   ├── {role}.md                  # 에이전트 역할 정의
│   └── {team}-sentinel.md         # SENTINEL 프롬프트
├── rules/
│   ├── engine/
│   │   ├── graph-engine.md        # 레이어 아키텍처, 성능 기준, 금지 사항
│   │   ├── plan-harness.md        # 5단계 플랜 하네스
│   │   ├── cross-verification.md  # Gate 1~4 검증 프로토콜
│   │   ├── agent-protocol.md      # Completion Status, Depth Score
│   │   ├── engine-verification.md # 매 스텝 검증 5단계
│   │   ├── engine-performance.md  # 프레임 예산, TypedArray, WebGL
│   │   ├── engine-code-quality.md # 타입 안전성, 함수 설계, 네이밍
│   │   └── mission.md             # 팀 사명
│   └── design/
│       └── design-harness.md      # HR-01~12 디자인 하네스
├── skills/
│   ├── flotter-{team}-team.md     # 팀 Lead 스킬
│   └── flotter-{feature}.md       # 기능별 스킬
docs/
├── superpowers/
│   ├── engine-dev-state.json      # 개발 상태 파일
│   ├── specs/                     # 스펙 문서
│   ├── plans/                     # 플랜 문서
│   └── eureka.jsonl               # L3 발견 기록
```
