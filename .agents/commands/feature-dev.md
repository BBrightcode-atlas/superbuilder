---
description: Feature의 독립 실행 환경(dev harness)을 세팅하고 실행
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

Feature를 독립적으로 개발/테스트할 수 있는 dev harness 환경을 세팅하고 실행 안내를 제공한다.

## 입력

- `$ARGUMENTS`에서 feature 이름을 추출한다

## 1. 사전 조건

다음을 확인한다:

- `superbuilder-features` 레포가 로컬에 존재하는지 (`~/Projects/superbuilder-features` 또는 인접 디렉토리)
- `bun`이 설치되어 있는지 (`bun --version`)
- 해당 feature 디렉토리가 존재하는지 (`features/{name}/`)

## 2. Dev Harness 확인

`features/{name}/dev/` 디렉토리에 다음 파일이 존재하는지 확인한다:

- `dev/server.ts` — 백엔드 독립 실행 파일
- `dev/app.tsx` — 프론트엔드 독립 실행 파일

## 3. Dev Harness 생성 (없는 경우)

파일이 없으면 아래 템플릿을 기반으로 생성한다.

### dev/server.ts

```typescript
/**
 * {Name} Feature — 독립 실행 서버
 *
 * 실행: cd features/{name} && bun run dev/server.ts
 * 포트: 4000 (PORT 환경변수로 변경 가능)
 */
import { createDevServer } from "@superbuilder/dev-kit/server";
import { {Name}Module } from "../src/server/{name}.module";

const app = await createDevServer({
  modules: [{Name}Module],
  port: Number(process.env.PORT) || 4000,
});

console.log(`{Name} dev server running on http://localhost:${app.port}`);
```

- `@superbuilder/dev-kit/server`의 `createDevServer`를 사용하여 최소 NestJS 앱을 구성한다
- mock DB와 mock auth가 자동으로 주입된다

### dev/app.tsx

```typescript
/**
 * {Name} Feature — 독립 실행 UI
 *
 * 실행: cd features/{name} && bun run dev/app.tsx
 * 포트: 4001 (UI_PORT 환경변수로 변경 가능)
 */
import { DevShell } from "@superbuilder/dev-kit/ui";
import { routes } from "../src/client/routes";

export default function App() {
  return (
    <DevShell
      featureName="{name}"
      routes={routes}
      apiUrl="http://localhost:4000"
    />
  );
}
```

- `@superbuilder/dev-kit/ui`의 `DevShell`이 라우팅, tRPC provider, mock auth를 자동으로 제공한다

### dev/seed.ts (선택)

feature가 DB를 사용하는 경우 (schema가 있는 경우) seed 파일도 생성한다:

```typescript
/**
 * {Name} Feature — Mock 데이터 시드
 *
 * 실행: cd features/{name} && bun run dev/seed.ts
 */
import { createDevDb } from "@superbuilder/dev-kit/db";
// import { {name}Table } from "../src/schema";

async function seed() {
  const db = await createDevDb();
  // TODO: seed 데이터 삽입
  console.log("Seed complete");
}

seed();
```

## 4. package.json scripts 확인

`features/{name}/package.json`에 dev 관련 scripts가 있는지 확인하고, 없으면 추가한다:

```json
{
  "scripts": {
    "dev": "concurrently \"bun run dev/server.ts\" \"bun run dev/app.tsx\"",
    "dev:server": "bun run dev/server.ts",
    "dev:ui": "bun run dev/app.tsx",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

## 5. 실행 안내

다음을 사용자에게 안내한다:

### 개발 서버 실행
```bash
cd features/{name} && bun dev
```
- 서버: `http://localhost:4000` (API)
- UI: `http://localhost:4001` (프론트엔드)

### 테스트 실행
```bash
cd features/{name} && bun test          # 단위 테스트
cd features/{name} && bun test:watch    # 감시 모드
```

### 타입 체크
```bash
cd features/{name} && bun run typecheck
```

## 6. 트러블슈팅

문제가 발생하면 다음을 확인한다:

| 증상 | 해결 방법 |
|---|---|
| `reflect-metadata` 관련 에러 | `tsconfig.json`의 `emitDecoratorMetadata: true` 확인 |
| `@superbuilder/core-*` not found | `bun install` 재실행. workspace 설정 확인 |
| `@superbuilder/dev-kit` not found | `bun install` 재실행. dev-kit 패키지 존재 확인 |
| Port 충돌 (EADDRINUSE) | `PORT=4002 bun run dev/server.ts`로 포트 변경 |
| DB 연결 에러 | dev harness는 in-memory SQLite를 사용. `createDevDb()` 호출 확인 |
| tRPC 연결 에러 | 서버가 먼저 실행 중인지 확인. `bun dev:server`를 먼저 실행 |

$ARGUMENTS
