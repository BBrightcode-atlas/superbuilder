---
description: Feature를 boilerplate에서 superbuilder-features로 마이그레이션
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Feature를 `superbuilder-app-boilerplate` 레포에서 `superbuilder-features` 레포로 마이그레이션한다.

## 입력

- feature 이름 (예: `blog`, `payment`, `community`)
- `$ARGUMENTS`에서 feature 이름을 추출한다

## 1. 사전 조건 확인

아래 3가지를 모두 확인한다. 하나라도 실패하면 중단하고 안내한다.

1. **superbuilder-app-boilerplate** 레포가 로컬에 존재하는지 확인
   - `~/Projects/superbuilder-app-boilerplate` 또는 인접 디렉토리에서 탐색
2. **superbuilder-features** 레포가 로컬에 존재하는지 확인
   - `~/Projects/superbuilder-features` 또는 인접 디렉토리에서 탐색
3. 해당 feature가 boilerplate에 존재하는지 확인
   - `packages/features/{name}/` 디렉토리 존재 여부

## 2. 수집 단계 — boilerplate에서 소스 수집

boilerplate 레포에서 다음 경로의 코드를 수집한다. 모든 경로가 존재하지 않을 수 있으며, 존재하는 것만 수집한다.

| boilerplate 경로 | 용도 |
|---|---|
| `packages/features/{name}/` | server 코드 |
| `apps/app/src/features/{name}/` | client 코드 |
| `apps/system-admin/src/features/{name}/` | admin 코드 |
| `packages/drizzle/src/schema/features/{name}/` | schema 코드 |
| `packages/widgets/src/{name}/` | widget 코드 (선택) |

## 3. 생성 단계 — superbuilder-features에 패키지 구성

`superbuilder-features/features/{name}/` 디렉토리를 생성하고, 수집한 코드를 다음 구조로 배치한다:

```
features/{name}/
├── src/
│   ├── server/       ← packages/features/{name}/ 내용
│   ├── client/       ← apps/app/src/features/{name}/ 내용
│   ├── admin/        ← apps/system-admin/src/features/{name}/ 내용
│   ├── schema/       ← packages/drizzle/src/schema/features/{name}/ 내용
│   ├── widget/       ← packages/widgets/src/{name}/ 내용 (있는 경우)
│   └── common/
│       └── types.ts  ← 공유 타입 (server/client에서 공통으로 쓰는 타입 추출)
├── feature.json
├── package.json
└── tsconfig.json
```

## 4. feature.json 생성

boilerplate의 `superbuilder.json`에서 해당 feature의 메타데이터를 추출하여 `feature.json`을 생성한다.

```json
{
  "id": "{name}",
  "name": "표시 이름",
  "version": "0.1.0",
  "type": "page|widget|agent",
  "group": "그룹명",
  "icon": "아이콘명",
  "description": "설명",
  "dependencies": [],
  "provides": {
    "server": { "module": true, "router": true },
    "client": { "routes": true },
    "admin": { "routes": true },
    "schema": { "tables": ["테이블명"] },
    "widget": false
  }
}
```

- `provides` 필드는 실제 존재하는 코드 기준으로 구성한다
- 존재하지 않는 부분은 `false`로 설정한다

## 5. package.json 생성

```json
{
  "name": "@superbuilder/feature-{name}",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./server": "./src/server/index.ts",
    "./client": "./src/client/index.ts",
    "./admin": "./src/admin/index.ts",
    "./schema": "./src/schema/index.ts",
    "./types": "./src/common/types.ts"
  }
}
```

- 존재하는 부분만 exports에 포함한다

## 6. Import 경로 변환

모든 소스 파일에서 다음 import 경로를 변환한다:

| 기존 경로 | 변환 후 |
|---|---|
| `@repo/features/{name}` | 내부 상대 경로 (`../server/...` 등) |
| `@features/{name}` | 내부 상대 경로 |
| `@repo/core/auth` | `@superbuilder/core-auth` |
| `@repo/drizzle` | `@superbuilder/core-db` 또는 `@superbuilder/core-schema` |
| `@repo/ui` | `@superbuilder/core-ui` |

**주의**: 다른 feature로의 import(`@repo/features/other`)는 `@superbuilder/feature-other`로 변환한다.

## 7. 검증

다음을 순서대로 실행한다:

1. `bun run typecheck` — 타입 체크 통과 확인
2. `bun test` — 테스트 통과 확인 (있는 경우)
3. `feature.json`의 `provides`가 실제 export와 일치하는지 확인

오류가 있으면 수정 후 재검증한다.

## 8. 커밋

검증 통과 후 커밋한다:

```
feat(feature-{name}): migrate from boilerplate
```

$ARGUMENTS
