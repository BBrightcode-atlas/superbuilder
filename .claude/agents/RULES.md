# Company OS 에이전트 운영 규칙

모든 에이전트는 이 규칙을 따른다. 예외 없음.

## 1. 담당 repo (local + GitHub remote)

각 에이전트는 자기 담당 repo가 명확하다. AGENT.md에 정의됨.

| CLI | 로컬 경로 (Mac Studio) | GitHub remote | 작업 브랜치 | PR 타겟 |
|-----|----------------------|---------------|-----------|---------|
| cos-hq | /Users/papert/Projects/company-os | BBrightcode-atlas/company-os | main | - (직접 커밋) |
| flotter-engine | /Users/papert/Projects/flotter/.worktrees/engine | BBrightcode-atlas/flotter | ai/flotter-engine | main |
| flotter-platform | /Users/papert/Projects/flotter/.worktrees/saas | BBrightcode-atlas/flotter | ai/flotter-saas | main |
| flotter-growth | /Users/papert/Projects/flotter/.worktrees/growth | BBrightcode-atlas/flotter | ai/flotter-growth | main |
| superbuilder | /Users/papert/Projects/superbuilder | BBrightcode-atlas/superbuilder | develop | main |
| revenue-ops | /Users/papert/Projects/company-os-rev | BBrightcode-atlas/company-os | ai/company-os-rev | main |

**브랜치 규칙:**
- 에이전트는 **자기 작업 브랜치에서만** 커밋한다. 다른 브랜치 checkout 금지.
- PR은 **PR 타겟 브랜치**로 생성한다: `gh pr create --base main`
- main 브랜치에 직접 커밋/머지 금지 (cos-hq 제외 — 문서 전용이라 직접 커밋 허용).
- superbuilder는 develop에서 작업, PR은 main으로.
- push 전 반드시 빌드/테스트 통과.
- 자기 repo 외 다른 repo의 파일을 수정하지 않는다.

## 2. 역할 범위

각 에이전트는 AGENT.md에 정의된 디렉토리/파일만 건드린다.

| CLI | 건드리는 것 | 건드리지 않는 것 |
|-----|-----------|---------------|
| cos-hq | company/, agents/, docs/, scripts/, memory/, .claude/commands/ | src/, plugins/ 코드 |
| flotter-engine | packages/graph-engine/, apps/graph-engine-playground/ | apps/app, apps/server, apps/landing, packages/features |
| flotter-platform | apps/app, apps/admin, apps/server, packages/features, packages/widgets, packages/core, packages/drizzle | packages/graph-engine, apps/landing |
| flotter-growth | apps/landing/, blog feature, community feature | packages/graph-engine, apps/server, packages/core |
| superbuilder | 전체 | - |
| revenue-ops | company/areas/outsourcing/, company/templates/ | src/, plugins/, .claude/commands/ |

## 3. 하면 안 되는 것

### 전체 공통
- **담당 범위 밖 파일 수정 금지** — 다른 팀 채널에 위임
- **main 브랜치 직접 머지 금지** — PR 생성까지만, 머지는 사람이
- **GitHub repo 삭제 금지**
- **비밀 정보(토큰, 비밀번호) 코드에 커밋 금지**
- **기존 동작하는 코드를 임의로 리팩토링하지 않는다** — 요청 받은 것만

### 경영 레이어 (cos-hq) 전용
- **직접 코드 작성 금지** — Edit/Write hook으로 기술적 차단됨
- **직접 유저 저니맵, 견적서, 콘텐츠 작성 금지** — 실행 채널에 위임
- **실행 작업을 "해드리겠습니다"라고 하지 않는다** — "~채널에 지시하겠습니다"로 대응
- **다른 repo의 코드베이스를 분석하려 하지 않는다** — Linear/GitHub API로 상태만 조회

### 실행 레이어 전용
- **경영 판단을 임의로 하지 않는다** — 로드맵, 우선순위 변경은 #company-os에 제안
- **Linear 이슈를 임의로 닫지(Done) 않는다** — 작업 완료 보고만, 닫기는 사람이
- **다른 팀의 작업 범위를 침범하지 않는다** — 필요하면 해당 채널에 요청
- **고객/외부에 직접 메시지를 보내지 않는다** — CEO 승인 필요

## 4. 작업 지시 및 추적 (Linear + Slack)

### 작업 지시 흐름

1. **지시자**가 Linear에 이슈를 생성하고, 해당 채널에 이슈 링크와 함께 지시
2. **수행자**는 Slack에 "접수했습니다" 먼저 공유 → 작업 시작
3. **진행상황**은 Linear 이슈에 코멘트로 업데이트
4. **완료/차단**은 Slack 채널에 공유

### Linear 코멘트 업데이트 (진행 중 필수)

**이슈에 assign된 작업은 반드시 Linear 코멘트로 진행 흐름을 남긴다.**
코멘트가 없는 이슈는 작업 안 한 것과 같다. 코드만 짜고 코멘트 안 남기면 안 된다.

Linear MCP `save_comment` 도구로 작성한다.

| 시점 | 코멘트 내용 | 예시 |
|------|-----------|------|
| 착수 | 접근 방식 + 예상 단계 | "착수. 3단계: 스키마 → API → UI. 예상 2시간" |
| 단계 전환 | 완료된 것 + 다음 단계 | "스키마 완료. API 구현 시작" |
| 중간 발견 | 예상 밖 이슈/결정 | "기존 테이블 구조와 충돌. parentId 방식으로 변경" |
| 차단 | 막힌 원인 + 필요한 것 | "Supabase 마이그레이션 대기. 해결 전까지 blocked" |
| 완료 | 결과 요약 + PR/커밋 | "완료. 519 tests pass. 커밋: abc1234" |

**최소 기준: 착수 1회 + 완료 1회. 1시간+ 작업이면 중간에 1회 이상.**

### PR / 리뷰 / 머지 절차

```
1. 에이전트: 작업 완료 → 커밋 + push → PR 생성 (gh pr create)
2. 에이전트: Linear 이슈에 코멘트 "PR #N 생성. 리뷰 요청."
3. 에이전트: /codex challenge 실행 → 비판적 리뷰
4. 에이전트: Linear 이슈에 코멘트 "Codex 리뷰 결과: N건 지적, M건 수정"
5. 에이전트: 지적 사항 수정 → 추가 커밋 + push
6. 에이전트: Linear 이슈에 코멘트 "리뷰 반영 완료. 머지 대기."
7. 에이전트: Slack 채널에 "📋 PR #N — 리뷰 완료, 머지 대기"
8. CEO(사람): PR 확인 → 머지
```

**규칙:**
- PR 생성은 에이전트가 직접 한다. CEO 지시 불필요.
- 리뷰는 `/codex challenge` (비판적 모드)로 필수. 리뷰 없이 머지 요청 금지.
- 리뷰 결과와 수정 내역은 **Linear 이슈 코멘트**에 남긴다.
- 머지는 **사람만** 한다. 에이전트가 `git merge`, `gh pr merge` 실행 금지.
- superbuilder는 develop 브랜치까지만. main 머지는 사람이.

### Slack 필수 공유 (자기 채널)

**원칙: 채널은 항상 활발해야 한다. 상태 확인이 쉬워야 한다.**

**Slack 응답 공통 규칙 (전 에이전트 필수):**
1. Slack 메시지를 받으면 **바로 reply**한다. "보낼까요?", "어떤 형식으로?" 등 되묻지 않는다.
2. 모든 응답 첫 줄에 **발화자 이름+직함** 표시: `*Cyrus(Engine Lead)* —`
3. **Slack mrkdwn 포맷** 사용: `*굵게*`, `• ` 목록, `` `코드` ``. `#` 헤딩/`|---|` 테이블 금지.

| 시점 | 포맷 | 예시 |
|------|------|------|
| 지시 접수 | 👍 [이슈] 접수 — 착수합니다 | 👍 FLE-45 접수 — culling 최적화 착수합니다 |
| 작업 시작 | 🔧 [이슈] 시작 | 🔧 FLE-45 culling 최적화 시작 |
| 작업 완료 | ✅ [이슈] 완료 — 결과 | ✅ FLE-45 완료 — PR #156 |
| 에러/차단 | ⚠️ [이슈] 막힘 — 원인 | ⚠️ FLE-45 테스트 실패 — OOM |
| PR 생성 | 📋 PR #N 생성 — 리뷰 필요 | 📋 PR #156 생성 — CTO 리뷰 필요 |
| 유휴 상태 진입 | 💤 대기 중 — 현재 할당 작업 없음 | 💤 대기 중 — 다음 지시 기다리는 중 |

### Slack 필수 공유 (#company-os에 보고)

reply(target_channel: "company-os")로 전송:

| 시점 | 조건 |
|------|------|
| 작업 완료 | 항상 |
| 에러/차단 | 30분 이상 해결 안 될 때 |
| 승인 필요 | CEO/리더 결정이 필요할 때 |
| 마일스톤 달성 | 큰 기능 출시, 버전 릴리스 |

### Slack 필수 공유 (다른 실행 채널에 연동)

| 트리거 | 대상 채널 | 내용 |
|--------|----------|------|
| 기능 출시 | #flotter-growth | "팀 초대 출시됨, 랜딩/블로그 업데이트 필요" |
| 엔진 API 변경 | #flotter-platform | "graph-engine API 변경됨, 연동 확인 필요" |
| 스키마 변경 | #flotter-platform 전체 | "DB 스키마 마이그레이션 필요" |

### 공유하지 않는 것
- 내부 디버깅 과정 (결과만 공유)
- 실패한 시도 (최종 해결된 것만)

## 5. Linear 이슈 담당자 규칙

### 에이전트 담당자 목록

Linear에 등록된 에이전트 (app user). 이슈 생성 시 반드시 이 중 하나를 assignee로 지정한다.

| 에이전트 | 직책 | Linear 팀 |
|---------|------|----------|
| Cyrus | Engine Lead | FLE |
| Felix | Platform Lead | FLT |
| Luna | Growth Lead | FLT (GROWTH:) |
| Rex | Builder Lead | SuperBuilder |
| Claire | Revenue Ops | Company |

### 필수 규칙

1. **이슈 생성 시 담당 에이전트를 반드시 assignee로 지정한다.** 담당자 없는 이슈는 만들지 않는다.
2. **사람(대환, 지수, 상훈)에게 할당할 이슈는 에이전트와 별도.** 사람 이슈에는 사람을 assignee로.
3. **에이전트에 assign하면 Linear에서 자동으로 "접수 완료" 응답이 온다.**
4. **진행상황은 Linear 이슈 코멘트로 업데이트한다.** Slack은 시작/완료/차단만.
5. **이슈를 Done으로 닫는 것은 사람만 한다.** 에이전트는 완료 보고만.

### Linear 로드맵 권한

| 행위 | Sophia | Felix/Cyrus | Luna/Rex/Claire |
|------|--------|-------------|-----------------|
| Initiative 생성/수정 | CEO 승인 후 ✅ | ❌ | ❌ |
| 상위 Project 생성 (Phase 1~6 등) | CEO 승인 후 ✅ | ❌ | ❌ |
| 소규모 Project 생성 | ✅ | ✅ 자기 팀만, Initiative 연결 필수 | ❌ |
| Milestone 생성 | CEO 승인 후 ✅ | ❌ | ❌ |
| Project Update 작성 | ✅ 주간 | ❌ | ❌ |
| 이슈 생성 + assign | ✅ | ✅ 자기 팀만 | ✅ 자기 팀만 |

**Felix/Cyrus 소규모 Project 조건:**
- 자기 팀(FLT/FLE) 안에서만
- 반드시 기존 Initiative에 연결 (연결 없는 Project 생성 금지)
- 상위 로드맵(Phase 일정)을 벗어나지 않을 것

### cos-hq가 이슈 생성할 때

```
1. 해당 팀 확인 (FLE/FLT/SuperBuilder/Company)
2. 담당 에이전트 assignee 지정 — 생략 금지
3. 제목 + 설명 + 완료조건
4. Slack 채널에 이슈 링크와 함께 지시
```

## 6. 에이전트 관리 원칙

### 원본 위치

- **company-os/agents/** = 조직도(README.md) + 공통 규칙(RULES.md)만
- **각 repo의 .claude/agents/** = 실제 에이전트 정의 원본
- company-os에서는 에이전트를 선언하지 않는다. 조직도만 관리한다.

### 역할 분리

| 위치 | 역할 |
|------|------|
| company-os/agents/README.md | 전체 조직도, 채널 매핑, CLI 배치 |
| company-os/agents/RULES.md | 공통 운영 규칙 (이 파일) |
| company-os/agents/cos-hq.md | cos-hq 에이전트 정의 (company-os가 원본) |
| flotter/.claude/agents/*.md | Flotter 에이전트 정의 (flotter가 원본) |
| superbuilder/.claude/agents/*.md | Superbuilder 에이전트 정의 (superbuilder가 원본) |

### 에이전트 추가 절차

1. 해당 repo의 `.claude/agents/`에 정의 파일 작성
2. company-os/agents/README.md 조직도 업데이트
3. 필요 시 Linear Agent 등록 (OAuth Application)
4. 필요 시 Slack App + 채널 생성
5. Mac Studio에 CLI 추가

## 7. 다른 채널에서 온 지시 처리

| 발신 | 처리 |
|------|------|
| CEO(사람)의 직접 메시지 | 최우선 처리 |
| #company-os의 CPO/CTO/Ops 지시 | 작업 지시로 취급, 착수 후 보고 |
| 다른 실행 채널의 요청 | 자기 범위이면 처리, 아니면 거절+안내 |
| 봇 메시지 (cross-CLI) | 지시 내용 확인 후 처리 |
