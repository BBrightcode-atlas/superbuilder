---
description: Feature 패키지의 정합성을 종합 검증
allowed-tools: Bash, Read, Edit, Glob, Grep
---

`superbuilder-features` 레포의 feature 패키지가 규칙을 준수하는지 종합 검증한다.

## 입력

- `$ARGUMENTS`에서 feature 이름을 추출한다
- 이름이 없으면 `features/` 하위의 모든 feature를 검증한다

## 검증 항목

다음 8개 항목을 순서대로 검증한다.

### 1. feature.json 존재 및 필수 필드

`features/{name}/feature.json` 파일을 읽고 다음 필수 필드가 있는지 확인한다:

- `id` — string, feature 이름과 일치해야 함
- `name` — string, 표시 이름
- `version` — string, semver 형식
- `type` — `page` | `widget` | `agent`
- `group` — string
- `icon` — string
- `dependencies` — array
- `provides` — object

### 2. package.json 정합성

- `name`이 `@superbuilder/feature-{id}` 형식인지 확인
- `exports` 필드가 `feature.json`의 `provides`와 일치하는지 확인
  - `provides.server`가 truthy → `exports["./server"]` 존재해야 함
  - `provides.client`가 truthy → `exports["./client"]` 존재해야 함
  - `provides.admin`가 truthy → `exports["./admin"]` 존재해야 함
  - `provides.schema`가 truthy → `exports["./schema"]` 존재해야 함
  - `provides.widget`가 truthy → `exports["./widget"]` 존재해야 함

### 3. Import 규칙 검증

`src/` 하위 모든 `.ts`, `.tsx` 파일에서 import 문을 검사한다.

**허용되는 import**:
- `@superbuilder/core-*` (core 패키지)
- `@superbuilder/feature-*` (다른 feature, dependencies에 선언된 것만)
- 상대 경로 (`./`, `../`)
- npm 패키지 (react, zod 등)

**금지되는 import** (하나라도 있으면 FAIL):
- `@repo/*` — boilerplate 전용 경로
- `@/lib/*`, `@/components/*` — app 내부 경로
- `~/` — app 내부 경로
- 상대 경로로 `../../core/` 등 core 패키지에 접근

### 4. provides 정합성

`feature.json`의 `provides`에 선언된 항목이 실제로 export되는지 확인한다:

| provides 필드 | 확인 대상 |
|---|---|
| `provides.server.module` | `src/server/{name}.module.ts`에서 export 존재 |
| `provides.server.router` | `src/server/{name}.router.ts`에서 export 존재 |
| `provides.client.routes` | `src/client/index.ts`에서 routes export 존재 |
| `provides.admin.routes` | `src/admin/index.ts`에서 routes export 존재 |
| `provides.widget` | `src/widget/index.ts`에서 export 존재 |

### 5. dependencies 검증

`feature.json`의 `dependencies` 배열에 선언된 각 feature가 `features/` 디렉토리에 존재하는지 확인한다.

또한, 소스 코드에서 `@superbuilder/feature-*`를 import하는데 `dependencies`에 선언되지 않은 feature가 있는지 확인한다.

### 6. typecheck

```bash
cd features/{name} && bun run typecheck
```

### 7. test

```bash
cd features/{name} && bun test
```

테스트 파일이 없으면 SKIP으로 표시한다.

### 8. lint

```bash
bun run lint
```

feature 소스에 해당하는 lint 오류만 필터링하여 표시한다.

## 결과 출력

모든 항목을 표 형태로 출력한다:

| # | 항목 | 상태 | 세부사항 |
|---|---|---|---|
| 1 | feature.json | PASS/FAIL | 누락 필드 목록 |
| 2 | package.json | PASS/FAIL | 불일치 항목 |
| 3 | import 규칙 | PASS/FAIL | 금지 패턴 발견 파일:라인 |
| 4 | provides 정합성 | PASS/FAIL | 미스매치 항목 |
| 5 | dependencies | PASS/FAIL | 누락/미선언 목록 |
| 6 | typecheck | PASS/FAIL | 에러 수 |
| 7 | test | PASS/FAIL/SKIP | 실패 테스트 |
| 8 | lint | PASS/FAIL | 에러 수 |

$ARGUMENTS
