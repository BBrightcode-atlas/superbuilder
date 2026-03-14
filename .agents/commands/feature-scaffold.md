---
description: 새 feature 패키지를 처음부터 생성 (scaffold)
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

`superbuilder-features` 레포에 새 feature 패키지를 처음부터 생성한다.

## 입력

`$ARGUMENTS`에서 다음을 추출한다:

- **name** (필수): feature 이름 (kebab-case, 예: `blog`, `user-profile`)
- **type** (필수): `page` | `widget` | `agent`
- **group** (필수): feature 그룹 (예: `content`, `commerce`, `social`)
- **description** (필수): 간단한 설명

인자가 부족하면 사용자에게 질문한다.

## 1. 참조 템플릿

`/Users/bbright/Projects/superbuilder-features/features/hello-world/` 구조를 참조하여 새 feature의 코드를 생성한다. hello-world의 패턴을 따르되 feature 이름과 설명에 맞게 수정한다.

## 2. 디렉토리 생성

`superbuilder-features/features/{name}/` 하위에 전체 구조를 생성한다:

```
features/{name}/
├── src/
│   ├── server/
│   │   ├── {name}.module.ts
│   │   ├── {name}.router.ts
│   │   ├── service/
│   │   │   └── {name}.service.ts
│   │   ├── controller/
│   │   │   └── {name}.controller.ts
│   │   └── index.ts
│   ├── client/           # page/agent type만
│   │   ├── routes.ts
│   │   ├── pages/
│   │   │   └── {Name}Page.tsx
│   │   ├── hooks/
│   │   │   └── use-{name}.ts
│   │   └── index.ts
│   ├── widget/           # widget type만
│   │   ├── {Name}Widget.tsx
│   │   └── index.ts
│   ├── admin/
│   │   ├── routes.ts
│   │   ├── pages/
│   │   │   └── {Name}AdminPage.tsx
│   │   └── index.ts
│   ├── schema/
│   │   └── index.ts      # 빈 스키마 (placeholder)
│   └── common/
│       └── types.ts
├── dev/
│   ├── server.ts
│   └── app.tsx
├── tests/
│   └── {name}.test.ts
├── feature.json
├── package.json
└── tsconfig.json
```

- `page` type: client + admin + server + schema
- `widget` type: widget + server + schema (client 제외)
- `agent` type: client + server + schema (admin 선택)

## 3. feature.json 생성

```json
{
  "id": "{name}",
  "name": "{Name}",
  "version": "0.1.0",
  "type": "{type}",
  "group": "{group}",
  "icon": "Box",
  "description": "{description}",
  "dependencies": [],
  "provides": {
    "server": { "module": true, "router": true },
    "client": { "routes": true },
    "admin": { "routes": true },
    "schema": { "tables": [] },
    "widget": false
  }
}
```

type에 따라 `provides`를 조정한다.

## 4. package.json 생성

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
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

type에 따라 존재하는 엔트리포인트만 exports에 포함한다.

## 5. tsconfig.json 생성

hello-world feature의 tsconfig.json을 참조하여 동일한 설정으로 생성한다.

## 6. 코드 스켈레톤 생성

각 파일에 최소한의 동작하는 코드를 작성한다. hello-world feature의 패턴을 따른다.

### server
- `{name}.module.ts`: NestJS 모듈 데코레이터 + router/service import
- `{name}.router.ts`: tRPC router 기본 구조
- `service/{name}.service.ts`: Injectable 서비스 클래스
- `controller/{name}.controller.ts`: 컨트롤러 (필요시)
- `index.ts`: barrel export

### client (page type)
- `routes.ts`: React Router 라우트 정의
- `pages/{Name}Page.tsx`: 기본 페이지 컴포넌트
- `hooks/use-{name}.ts`: 기본 hook (tRPC query)
- `index.ts`: barrel export

### widget (widget type)
- `{Name}Widget.tsx`: 위젯 컴포넌트
- `index.ts`: barrel export

### admin
- `routes.ts`: admin 라우트 정의
- `pages/{Name}AdminPage.tsx`: admin 페이지 컴포넌트
- `index.ts`: barrel export

### schema
- `index.ts`: 빈 스키마 export (추후 테이블 추가용)

### common
- `types.ts`: 공유 타입 정의 (빈 파일 + TODO 주석)

## 7. Dev Harness 생성

### dev/server.ts
```typescript
// 최소 NestJS 앱 + mock DB/auth
// @superbuilder/dev-kit/db, @superbuilder/dev-kit/auth 사용
```

### dev/app.tsx
```typescript
// 최소 React 앱 + DevShell
// @superbuilder/dev-kit/ui DevShell 사용
```

## 8. 검증

```bash
cd features/{name} && bun run typecheck
```

타입 체크 통과 확인. 오류가 있으면 수정한다.

## 9. 커밋

```
feat(feature-{name}): scaffold new feature package
```

$ARGUMENTS
