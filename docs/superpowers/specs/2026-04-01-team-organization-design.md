# Superbuilder 에이전트 팀 조직 설계

> 3-repo 아키텍처(superbuilder, superbuilder-features, superbuilder-app-template)를 체계적으로 운영하기 위한 에이전트 팀 조직 설계.

---

## 1. 조직 원칙 — team > function > pod

### 3계층 조직 구조

```
team (상설 책임 조직)
  └── function (직무 전문성 축 — team 내부, Design/Build/Quality)
       └── pod (Feature 실행 단위 — 임시, 목표 달성 후 해산)
```

| 계층 | 성격 | 수명 | 예시 |
|------|------|------|------|
| **team** | 상설. 명확한 책임 경계 | 영구 | Desktop Team, Engine Team, Ecosystem Team |
| **function** | team 내부의 직무 전문성 | 영구 (team 소속) | Design Function, Build Function, Quality Function |
| **pod** | 특정 Feature/목표를 끝내기 위한 크로스 function 단위 | 임시 | compose-stability-pod, sidebar-redesign-pod |

**원칙:**
- 직무 기준 상설 pod보다 **feature pod**가 원칙
- Tech Lead는 팀 내 아키텍처 결정, 팀 간 정렬
- CTO(회사 전체)는 Tech Lead를 우회하여 직접 에이전트에 지시 금지. 관점 제시만.

### 회사 전체 조직에서의 위치

```
CTO (회사 전체 기술 방향 — 1명)
  │
  ├── Tech Lead: Superbuilder
  │     └── Desktop / Engine / Ecosystem Teams
  │
  └── Tech Lead: Flotter
        └── PX / Core / Engine / Platform / AI Teams
```

| 역할 | 범위 | 권한 |
|------|------|------|
| **CTO** | 회사 전체 | Tech Radar, 크로스 프로젝트 ADR, 전사 기술 표준 |
| **Tech Lead** | 프로젝트 단위 | 프로젝트 내 아키텍처, 팀 운영, 플랜 승인 |

---

## 2. 팀 구성 — 3개 팀 + Tech Lead

| 팀 | 스킬 호출 | 책임 | Linear 프로젝트 |
|---|---|---|---|
| **Desktop Team** | `/superbuilder-desktop-team` | Electron UI, 렌더러, UX, tRPC 라우터 | SBD (`DT:` 접두어) |
| **Engine Team** | `/superbuilder-engine-team` | atlas-engine, compose pipeline, 배포 | SBD (`EG:` 접두어) |
| **Ecosystem Team** | `/superbuilder-ecosystem-team` | feature 개발, template, 크로스레포 정합성 | SBD (`EC:` 접두어) |
| **Tech Lead** | `/superbuilder-tech-lead` | 아키텍처 결정, ADR, 팀 간 정렬 | SBD (`TL:` 접두어) |

---

## 3. 에이전트 역할 정의 — 3개 디비전 + External

각 팀은 **Design / Build / Quality** 3개 디비전 + **External(SENTINEL)** 로 구성.

### Design Division (설계)

| 에이전트 | 역할 | 산출물 | 금지 사항 |
|----------|------|--------|----------|
| **Architect** | 아키텍처 설계, 5단계 플랜, ADR | 플랜 문서, ADR | **코드 작성 금지** |
| **DX Designer** | 소비자 API 설계, 타입 가이드 | API 스펙, DX 가이드 | **코드 작성 금지** |

### Build Division (구현)

| 에이전트 | 팀 | 핵심 책임 |
|----------|---|----------|
| **Programmer** | 전 팀 공통 | 핵심 로직, 데이터 모델. TDD 필수 |
| **Renderer** | Desktop | React 컴포넌트, UI, Tailwind + shadcn/ui |
| **Deployer** | Engine | Vercel/Neon/GitHub 배포. 실제 결과 검증 필수 |
| **Template Engineer** | Ecosystem | boilerplate 마커, template 유지보수 |
| **Refactorer** | 전 팀 공통 | 구조적 부채 해소. Lead 승인 하에만 작업 |

### Quality Division (품질)

| 에이전트 | 팀 | 핵심 책임 |
|----------|---|----------|
| **QA** | 전 팀 공통 | 독자 테스트 3개+, 경계값 5개+, 발견 0개는 고무도장으로 반려 |
| **Profiler** | Engine | ms 단위 측정값 필수. 수치 없는 성능 주장 불인정 |
| **Integration Verifier** | Ecosystem | Feature 추가 후 compose E2E 전체 검증 |

### External — SENTINEL (독립 검증관)

| 항목 | 설명 |
|------|------|
| **실행 모델** | Codex (OpenAI) — Claude가 아닌 외부 AI |
| **호출 방식** | `/codex:adversarial-review` |
| **코드 접근** | read-only sandbox. 수정 불가 |
| **핵심 목적** | Claude 팀의 합의 편향(consensus bias) 차단 |
| **마인드셋** | "이것은 틀렸다"가 기본 전제. PASS는 증거로 획득 |

#### SENTINEL 검증 8개 영역 (superbuilder 특화)

| # | 영역 | 체크 항목 |
|---|---|---|
| 1 | 아키텍처 | 레이어 위반, 크로스레포 의존성 방향 |
| 2 | 성능 | 파이프라인 타임아웃, 불필요 API 호출 |
| 3 | 빈껍데기 | Map wrapper, 1줄 위임, 로직 없는 클래스 |
| 4 | 배선(Wiring) | emit/on 짝, tRPC 라우터 실제 호출자 존재 |
| 5 | 타입 안전성 | `any`, `as` 캐스팅 |
| 6 | 거짓 성공 | 배포 결과 실제 검증 없이 성공 선언 탐지 |
| 7 | 크로스레포 정합성 | feature.json ↔ template 마커 ↔ engine 매핑 불일치 |
| 8 | 엣지 케이스 | 0, null, MAX, 중복 feature, 빈 template |

---

## 4. 팀별 전용 규칙

### Desktop Team

- `simple-git` 직접 import 금지 → `git-client.ts` 헬퍼 사용
- tRPC subscription은 observable 패턴만 (async generator 금지)
- UI 변경 시 Screenshot Gate 필수
- 매 스텝마다 `bun run typecheck` 통과 필수

### Engine Team — 거짓 성공 방지 하네스

```
배포 "성공" 선언 전 필수 체크:
1. Vercel deployment status === "READY" (API 확인)
2. 각 앱 URL HTTP 200 응답 확인 (server, app, admin, landing)
3. 로그인 플로우 실제 동작 확인 (E2E)
→ 3개 모두 통과해야 성공. 하나라도 실패하면 BLOCKED 보고
```

### Ecosystem Team

- Feature 추가/수정 후 반드시 `/superbuilder-cross-repo-check` 실행
- Template 변경 후 반드시 `/superbuilder-compose-e2e-test` 실행
- Import 경로: feature 개발 시 `@superbuilder/*`, scaffold 후 `@repo/*` 자동 변환 확인

---

## 5. 전체 워크플로우 — Gate 기반 Phase 진행

```
Feature/Task 시작
  │
  ▼ [Plan Harness Gate] — 5단계 플랜이 있는가?
  │
  ├─ NO → Architect 디스패치 → 5단계 플랜 작성
  │
  ▼ [SENTINEL Gate 1] — 플랜 검증
  │  REJECT → Architect 반환 (최대 3회)
  │  PASS ↓
  │
  ▼ Build Division TDD 구현 (독립 모듈이면 병렬 가능)
  │
  ▼ 매 스텝 완료 시 5단계 검증
  │  ① 해당 스텝 테스트 (RED → GREEN)
  │  ② 전체 테스트 (regression)
  │  ③ bun run typecheck
  │  ④ bun run lint:fix
  │  ⑤ 호출자 존재 확인 (고아 코드 탐지)
  │
  ▼ [SENTINEL Gate 2] — 코드 검증 (핵심 모듈 변경 시)
  │  REJECT → 해당 에이전트 반환
  │  PASS ↓
  │
  ▼ Quality Division — QA 독자 테스트 + 경계값
  │
  ▼ [SENTINEL Gate 3] — QA 고무도장 탐지
  │  RUBBER_STAMP → QA 재수행
  │  GENUINE ↓
  │
  ▼ [팀별 추가 Gate]
  │  Desktop: Screenshot Gate
  │  Engine: Deploy Verification Gate
  │  Ecosystem: Cross-Repo Gate
  │
  ▼ [SENTINEL Gate 4] — Phase/Milestone 최종 SHIP/BLOCK
  │  BLOCK → 해당 디비전 반환
  │  SHIP ↓
  │
  ▼ Linear SBD 이슈 → Done + 커밋
```

### 5단계 플랜 필수 구성

| 단계 | 내용 |
|------|------|
| 1. 문제 (Problem) | 현재 상태 → 목표 상태. 1~3문장 |
| 2. 구조 (Structure) | 클래스/함수/모듈의 소유/의존/책임 |
| 3. 인터페이스 (Interface) | 모든 public 메서드 TypeScript 시그니처 |
| 4. 데이터 흐름 (Flow) | input → 처리 → output 시퀀스 |
| 5. 검증 기준 (Verification) | 실행 가능한 assertion |

### TDD 사이클 (Build Division 필수)

```
테스트 작성 → 실행(실패 확인) → 구현 → 실행(통과 확인) → 전체 테스트 → typecheck → lint → 커밋
```

---

## 6. QA 강제 산출물 형식

```markdown
## QA Report — {Team} / Phase {X.Y}

### 1. 독자적 테스트 (Build가 안 쓴 것)
- test: {설명} → {결과}
(최소 3개)

### 2. 경계값/에러 테스트
- test: 빈 feature 목록으로 compose → {결과}
- test: 존재하지 않는 template repo → {결과}
- test: 동일 feature 중복 선택 → {결과}
(최소 5개)

### 3. 빈껍데기 탐지 결과
- {파일}: 알고리즘 {있음/없음}, 호출자 {N}개, 테스트 깊이 {값/존재}
(새로 추가된 파일 전부)

### 4. 발견 사항
- BUG: {있으면}
- CONCERN: {있으면}
- IMPROVEMENT: {있으면}
(0개여도 "확인한 항목 목록"은 기재)

### 5. 팀별 추가 검증
- [Desktop] 스크린샷: {경로}, 반응형 확인
- [Engine] 배포 URL 응답: server {status}, app {status}
- [Ecosystem] cross-repo-check: {PASS/FAIL}
```

---

## 7. Completion Status + 에스컬레이션

### 4단계 결과 보고

| Status | 의미 | Linear 액션 |
|--------|------|------------|
| **DONE** | 전체 완료, 증거 포함 | → Done |
| **DONE_WITH_CONCERNS** | 완료했지만 우려 | → Done + concern 코멘트 |
| **BLOCKED** | 진행 불가 | → Blocked, USER 알림 |
| **NEEDS_CONTEXT** | 정보 부족 | → 코멘트로 질문 |

### 에스컬레이션 프로토콜

| 규칙 | 설명 |
|------|------|
| **3회 시도 실패 → STOP** | 같은 문제 3번 실패하면 즉시 멈추고 USER 보고 |
| **보안 관련 불확실 → STOP** | 확신 없는 보안 변경 시도 금지 |
| **SENTINEL REJECT 3회 → STOP** | USER 에스컬레이션 |
| **크로스레포 파괴 감지 → STOP** | 다른 레포 빌드 깨뜨리면 즉시 롤백 |

---

## 8. 상태 파일 관리 (`dev-state.json`)

### 팀별 상태 파일 위치

| 팀 | 경로 |
|---|---|
| Desktop | `apps/desktop/dev-state.json` |
| Engine | `packages/atlas-engine/dev-state.json` |
| Ecosystem | `dev-state.json` (루트) |

### 스키마

```json
{
  "version": 1,
  "team": "desktop",
  "techLead": "superbuilder-tech-lead",
  "linearProject": "SBD",
  "linearPrefix": "DT:",
  "currentMilestone": "M1",
  "currentPhase": "1.1",
  "currentStep": "1.1.1",
  "spec": "docs/superpowers/specs/{spec-file}.md",
  "plan": "docs/superpowers/plans/{plan-file}.md",
  "milestones": {
    "M1": {
      "status": "in-progress",
      "title": "Milestone Title",
      "phases": {
        "1.1": {
          "status": "in-progress",
          "title": "Phase Title",
          "steps": { "1.1.1": "pending", "1.1.2": "pending" }
        }
      }
    }
  }
}
```

### 상태 업데이트 규칙

- Phase 시작 → `status: "in-progress"` — 즉시 쓰기
- Step 완료 → `step: "completed"` — 즉시 쓰기
- SENTINEL Gate 통과 → `gateResults` 추가 — 즉시 쓰기
- **모든 상태 변경 후 즉시 파일 쓰기 — 지연 금지**

---

## 9. 핸드오프 스키마

### 디비전 간 전달 (팀 내부)

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

### 크로스 팀 핸드오프

| 시나리오 | 발신 팀 | 수신 팀 |
|---|---|---|
| feature.json 스키마 변경 | Ecosystem | Engine |
| atlas tRPC 라우터 변경 | Engine | Desktop |
| template 마커 추가/변경 | Ecosystem | Engine |
| DB 스키마 변경 | 어느 팀이든 | 모든 팀 |

**규칙:**
1. 발신 팀이 Linear에 크로스팀 이슈 생성 (`CROSS:` 접두어)
2. 핸드오프 문서에 영향 범위 명시
3. 수신 팀 ACKNOWLEDGE 전까지 머지 금지
4. DB 스키마 변경은 모든 팀 ACKNOWLEDGE 필수

---

## 10. 팀 간 경계 규칙

| 변경 대상 | 담당 팀 | 크로스 팀 리뷰 필요 |
|---|---|---|
| `apps/desktop/` | Desktop | Engine (tRPC atlas 라우터 변경 시) |
| `packages/atlas-engine/` | Engine | Ecosystem (scaffold/connection 변경 시) |
| `superbuilder-features/` | Ecosystem | Engine (feature.json 스키마 변경 시) |
| `superbuilder-app-template/` | Ecosystem | Engine (마커 변경 시) |
| `packages/db/`, `packages/local-db/` | 변경 범위에 따라 | 항상 크로스 리뷰 |
| `AGENTS.md`, `.claude/rules/` | Tech Lead | 모든 팀 |

---

## 11. Linear SBD 연동

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
| `SENTINEL Pass` | SENTINEL 검증 통과 |
| `SENTINEL Block` | SENTINEL 검증 차단 |
| `CROSS` | 크로스 팀 핸드오프 |

### 자동화 시점

| 이벤트 | Linear 액션 |
|--------|------------|
| Phase 시작 | Issue 생성 → `Todo` + `Design` Label |
| SENTINEL Gate 1 통과 | Comment + `In Progress` + `Build` Label |
| SENTINEL Gate 2 REJECT | `SENTINEL Block` Label |
| QA 시작 | `In Review` + `Quality` Label |
| SENTINEL Gate 4 SHIP | `Done` + Comment "SENTINEL SHIP" |

---

## 12. 세션 관리

| 세션 수 | 행동 |
|---------|------|
| 1 | 정상 진행 |
| 2+ (같은 팀) | 파일 충돌 주의. 자기 담당 스텝만 수정 |
| 2+ (다른 팀) | 각 팀 자기 디렉토리만. 공유 파일 수정 시 원자적 |
| 3+ | `dev-state.json` 업데이트는 반드시 원자적 |
