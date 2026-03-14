---
description: 스펙 문서 대비 구현 완전성 검증 — 누락된 함수/타입/필드/에러 처리를 자동 감지하고 수정
allowed-tools: Bash, Read, Grep, Glob, Write, Edit, Agent
---

# spec-verify: 스펙 대비 구현 검증

스펙 문서의 인터페이스, 함수, 타입 필드, 에러 처리, 콜백 호출이 실제 코드에 빠짐없이 구현되었는지 검증한다.
**통과할 때까지 반복한다.**

## 사용법

```
/spec-verify docs/superpowers/specs/2026-03-15-headless-compose-pipeline-design.md
```

인자: 스펙 문서 경로 (필수)

## 검증 절차

### Phase 1: 스펙에서 계약(Contract) 추출

스펙 문서를 읽고 다음을 추출한다:

1. **exported 함수 목록** — `function composePipeline(`, `async function createNeonProject(` 등
2. **interface/type 정의** — `interface ComposeInput`, `type ComposeStep` 등
3. **interface 필드 목록** — 각 interface의 모든 프로퍼티 (optional 포함)
4. **에러 처리 테이블** — 스펙에 "실패 시 동작" 테이블이 있으면 각 단계별 에러 처리 규칙
5. **콜백 호출 지점** — `callbacks?.onStep?.("resolve", "start")` 등 모든 콜백 호출
6. **환경변수** — 스펙에 명시된 환경변수 목록
7. **파일 구조** — 스펙에 명시된 생성/수정 파일 목록

추출 결과를 테이블로 정리:

```
| 항목 | 타입 | 스펙 위치 |
|------|------|----------|
| composePipeline | function | Section 4 |
| ComposeInput | interface | Section 3 |
| ComposeInput.features | field (string[]) | Section 3 |
| ...
```

### Phase 2: 코드 대비 검증

추출된 각 항목에 대해 실제 코드를 검색:

#### 2.1 함수 존재 확인
```bash
# 스펙에 정의된 각 함수가 export되는지
grep -r "export.*function composePipeline" packages/atlas-engine/src/
grep -r "export.*function createNeonProject" packages/atlas-engine/src/
# ...
```

#### 2.2 타입/인터페이스 존재 확인
```bash
# 스펙에 정의된 각 interface가 export되는지
grep -r "export interface ComposeInput" packages/atlas-engine/src/
grep -r "export type ComposeStep" packages/atlas-engine/src/
# ...
```

#### 2.3 필드 완전성 확인
각 interface의 모든 필드가 실제 타입 정의에 존재하는지:
- 스펙의 `ComposeResult`에 `seed?` 필드가 있으면 → 구현의 `ComposeResult`에도 있어야 함
- 스펙의 `ComposeOptions`에 `ownerEmail?`이 있으면 → 구현에도 있어야 함

#### 2.4 에러 처리 확인
스펙의 에러 처리 테이블 각 행에 대해:
- 해당 단계의 코드에 try/catch 또는 에러 분기가 있는지
- 스펙에 "경고 출력 + 계속 진행"이면 catch 후 continue 패턴인지
- 스펙에 "즉시 에러 반환"이면 throw하는지

#### 2.5 콜백 호출 확인
스펙에 명시된 모든 `onStep` 호출이 실제 코드에 있는지:
```bash
grep "onStep.*resolve.*start" packages/atlas-engine/src/pipeline/compose.ts
grep "onStep.*resolve.*done" packages/atlas-engine/src/pipeline/compose.ts
grep "onStep.*scaffold.*start" packages/atlas-engine/src/pipeline/compose.ts
# ... 모든 step × (start|done|skip|error) 조합
```

#### 2.6 파일 존재 확인
스펙의 "파일 구조" 섹션에 명시된 모든 파일이 실제로 존재하는지.

#### 2.7 barrel export 확인
- `pipeline/index.ts`가 모든 공개 함수/타입을 re-export하는지
- `src/index.ts`가 `./pipeline`을 export하는지
- `package.json`에 `./pipeline` subpath가 있는지

### Phase 3: 결과 출력

검증 결과를 테이블로 출력:

```
## 스펙 대비 검증 결과

| # | 항목 | 타입 | 상태 | 세부사항 |
|---|------|------|------|---------|
| 1 | composePipeline | function | ✅ PASS | pipeline/compose.ts:15 |
| 2 | ComposeInput | interface | ✅ PASS | pipeline/types.ts:3 |
| 3 | ComposeResult.seed | field | ❌ MISS | 타입 정의에 없음 |
| 4 | onStep("seed","start") | callback | ❌ MISS | compose.ts에 호출 없음 |
| 5 | seed 에러 처리 | error | ❌ MISS | try/catch 없음 |
| ...

PASS: 32/37
FAIL: 5/37
```

### Phase 4: 누락 자동 수정

FAIL 항목이 있으면:

1. 각 FAIL 항목에 대해 스펙을 참조하여 코드 수정
2. 수정 후 다시 Phase 2 실행 (재검증)
3. **모든 항목 PASS할 때까지 반복** (최대 5회)
4. 5회 반복 후에도 FAIL이면 사용자에게 보고

### Phase 5: 기존 검증 실행

스펙 대비 검증 통과 후, 기존 검증도 실행:

```bash
bun run typecheck    # 타입 체크
bun test             # 테스트
bun run lint:fix     # 린트 수정
```

실패 시 수정 → 재검증 반복.

## 최종 출력

```
## spec-verify 최종 결과

스펙: docs/superpowers/specs/2026-03-15-xxx.md
검증 반복: 2회

### 스펙 대비: 37/37 PASS ✅
### typecheck: PASS ✅
### test: 105 pass, 0 fail ✅
### lint: 0 issues ✅

총 소요: 3분
```

## 통합 규칙

이 스킬은 다음 시점에 **자동 실행**되어야 한다:

1. Plan의 마지막 Task 완료 후
2. 각 Chunk 완료 후 (Chunk 단위 실행 시)
3. PR 생성 전

**통과 기준**: 스펙 대비 검증 + typecheck + test + lint 모두 PASS
**통과하지 못하면**: 수정 → 재검증 반복 (최대 5회)
