# UI Composer Preview Architecture Design

## 날짜: 2026-03-20

## 요약

UI Composer의 프리뷰 시스템을 iframe sandbox + 인라인 CSS 방식에서 **독립 Vite 앱 기반의 실제 shadcn/ui 렌더링 환경**으로 재설계한다. 에이전트가 표준 JSX를 생성하고, Babel in-browser로 변환하여 실제 React + Tailwind + Radix 컴포넌트로 렌더링한다.

## 배경

### 현재 문제

1. **프리뷰 품질 저하**: iframe `srcDoc` + 인라인 CSS ~500줄로는 Tailwind 유틸리티 전체 커버 불가
2. **CDN 차단**: Tailwind CDN이 Electron sandbox에서 `ERR_CONNECTION_REFUSED`
3. **가짜 컴포넌트**: `React.createElement` + vanilla JS 렌더러로는 실제 shadcn 동작(Radix 기반 Dialog, Select 등) 재현 불가
4. **MCP 미활용**: superbuilder-mcp에 901개 에셋이 있지만 프리뷰에서 활용 못함
5. **스펙 부적합**: `var h = React.createElement` 코드는 실제 프로젝트 코드와 괴리

### 설계 결정

| 결정 항목 | 선택 | 이유 |
|-----------|------|------|
| 프리뷰 수준 | 실제 shadcn 동작 (Full fidelity) | Dialog 열림, Select 드롭다운 등 실제 동작 필요 |
| 아키텍처 | `apps/ui-composer` 독립 Vite 앱 | monorepo 내 dev server, `packages/ui` import 가능 |
| 코드 실행 | Babel in-browser JSX 변환 | 에이전트가 자연스러운 JSX/import 작성, 실제 코드에 가까움 |
| 스펙 형태 | 생성 코드 = 스펙 | 별도 포맷 불필요, import 경로만 바꾸면 feature에 사용 |
| 컴포넌트 전략 | base shadcn 번들 + blocks 온디맨드 | 빌드 크기 관리 + 유연한 확장 |
| 코드 포맷 | 표준 JSX + named import | `@/components/ui/*` 패턴, 실제 프로젝트와 동일 |

## 아키텍처

### 전체 구조

```
Desktop (Electron)                    apps/ui-composer (Vite dev server :4100)
┌─────────────────────┐              ┌──────────────────────────────┐
│ UIComposer Panel    │              │ Preview App                  │
│                     │  postMessage │                              │
│ ┌─────────────────┐ │ ──────────> │ 1. Babel standalone 로드     │
│ │ iframe          │ │  (code +    │ 2. JSX → JS 변환             │
│ │ src=:4100       │ │   imports)  │ 3. import map → 실제 컴포넌트│
│ └─────────────────┘ │              │ 4. React.render(App)         │
│                     │ <────────── │ 5. DOM walk → componentTree  │
│ ┌─────────────────┐ │  postMessage│ 6. postMessage(tree)         │
│ │ Component Tree  │ │  (tree)     │                              │
│ │ = UI Spec       │ │              │ ┌──────────────────────┐     │
│ └─────────────────┘ │              │ │ packages/ui-preview  │     │
│                     │              │ │ (shadcn 복제본 66개) │     │
└─────────────────────┘              │ └──────────────────────┘     │
                                     │ ┌──────────────────────┐     │
                                     │ │ MCP 온디맨드 fetch   │     │
                                     │ │ (blocks, calendar..) │     │
                                     │ └──────────────────────┘     │
                                     └──────────────────────────────┘
```

### 신규 패키지/앱

#### `packages/ui-preview` — 프리뷰 전용 shadcn

- `packages/ui`에서 shadcn 컴포넌트만 복사 (66개)
- superbuilder의 `packages/ui`와 **완전 독립** — superbuilder 빌드에 영향 없음
- 자체 tailwind config, 자체 `cn()` util
- Export: `@repo/ui-preview/button`, `@repo/ui-preview/card` 등

#### `apps/ui-composer` — Vite 프리뷰 앱

- React 19 + Tailwind CSS v4 + Vite
- `packages/ui-preview` 의존
- Port 4100, turbo dev 시 함께 기동
- 단일 페이지: 코드 수신 → 변환 → 렌더링 → 트리 전송

## 코드 실행 파이프라인

### 1단계: 코드 전달 (Desktop → Preview)

```ts
postMessage({
  type: "render",
  code: "import { Card } from '@/components/ui/card';\n...",
  theme: "dark"
})
```

### 2단계: Import 해석

```ts
const MODULE_MAP = {
  "react": { useState, useEffect, useRef, useCallback, useMemo, Fragment },
  "@/components/ui/card": { Card, CardHeader, CardTitle, CardContent, CardFooter },
  "@/components/ui/button": { Button },
  "@/components/ui/input": { Input },
  // ... 66개 shadcn base (빌드타임 등록)
};
```

- Babel custom plugin: `import { X } from "path"` → `const { X } = __require("path")`
- `__require`가 MODULE_MAP에서 조회
- miss → Desktop에 `resolveImport` 요청 → MCP fetch → 캐시 등록

### 3단계: Babel 변환 + 실행

```
JSX 코드
  → Babel standalone (preset-react)
  → import → __require 변환 (custom plugin)
  → 샌드박스 내 실행 (iframe 격리)
  → export default 컴포넌트 추출
  → React.render(<App />, root)
```

코드 실행은 이미 격리된 iframe(별도 origin의 Vite 앱) 내에서만 이루어지므로 Desktop 프로세스에는 영향 없음.

### 4단계: 컴포넌트 트리 추출

```
렌더링 완료 (300ms 후)
  → DOM walk (data-component 속성 읽기)
  → ComponentTreeNode[] 구성
  → postMessage({ type: "componentTree", tree })
```

### 5단계: 에러 처리

- Babel 파싱 에러 → 에러 메시지 + 위치 표시
- 런타임 에러 → ErrorBoundary catch → 에러 오버레이
- import 누락 → skeleton fallback + MCP 검색 시도

## 온디맨드 컴포넌트 fetch

### 트리거

`__require()` 호출 시 MODULE_MAP에 없는 경로.

### 흐름

```
__require("@/components/blocks/login-page-01")
  → MODULE_MAP miss
  → Suspense fallback (skeleton)
  → postMessage({ type: "resolveImport", path: "blocks/login-page-01" })

Desktop:
  → tRPC atlas.uiComposer.getComponentBundle({ assetIds: [...] })
  → MCP get_asset_bundle 호출
  → postMessage({ type: "moduleResolved", path, source, dependencies })

Preview:
  → Babel 변환 (의존성 재귀 해석)
  → MODULE_MAP 동적 등록
  → Suspense 해제 → 재렌더링
```

### 의존성 체인 해결

MCP 응답의 `dependencyHints.internal`로 사전 파악. batch fetch로 한 번에 가져옴:

```ts
getComponentBundle({ assetIds: ["login-page-01", "auth-bg-shape", "text-shimmer"] })
```

### 캐시 전략

- **세션 메모리 캐시**: Preview App 내 `Map<path, module>` — 같은 컴포넌트 재변환 방지
- **Desktop 캐시**: `Map<assetId, source>` — 앱 재시작까지 유지, MCP 재요청 방지

## 통신 프로토콜

### Desktop → Preview

```ts
{ type: "render", code: string, theme: "dark" | "light" }
{ type: "moduleResolved", path: string, source: string, dependencies: string[] }
{ type: "viewport", width: number }
{ type: "themeChange", theme: "dark" | "light" }
```

### Preview → Desktop

```ts
{ type: "ready" }  // Preview App 로드 완료
{ type: "componentTree", tree: ComponentTreeNode[] }
{ type: "resolveImport", path: string }
{ type: "renderStatus", status: "success" | "error", error?: string }
{ type: "codeSpec", jsx: string, imports: string[] }
```

### 생명주기

```
Desktop 시작
  → turbo dev → apps/ui-composer 기동 (:4100)
  → iframe src="http://localhost:4100"
  → Preview: postMessage({ type: "ready" })
  → Desktop: Generate 버튼 활성화

생성 완료
  → Desktop: postMessage({ type: "render", code, theme })
  → Preview: Babel → 렌더링 → 트리 추출
  → Preview: postMessage({ type: "componentTree", tree })
  → Preview: postMessage({ type: "renderStatus", status: "success" })
```

### 보안

- postMessage origin 검증: `localhost:4100`만 허용
- Preview iframe sandbox: `allow-scripts allow-same-origin`
- 생성 코드는 Preview App 내부(별도 origin의 격리된 iframe)에서만 실행
- Desktop 프로세스에서 동적 코드 실행 없음

## 에이전트 코드 생성 규격

### 코드 포맷

```jsx
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function StatsCard({ title, value, trend }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <Badge variant={trend > 0 ? "success" : "destructive"}>
          {trend > 0 ? "+" : ""}{trend}%
        </Badge>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [period, setPeriod] = useState("week");
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatsCard title="Revenue" value="$12,345" trend={12.5} />
      </div>
      <Button onClick={() => setPeriod("month")}>Monthly</Button>
    </div>
  );
}
```

### Import 경로 규칙

| 컴포넌트 종류 | import 경로 |
|---|---|
| React hooks | `react` |
| shadcn base (66개) | `@/components/ui/{name}` |
| shadcn-studio blocks | `@/components/blocks/{name}` |
| ai-elements | `@/components/ai/{name}` |
| hooks | `@/hooks/{name}` |

### 프롬프트 변경

- `var h = React.createElement` 금지 → 표준 JSX 사용
- `import` 구문 필수 — 사용하는 모든 컴포넌트를 명시적으로 import
- `export default function App()` 필수 — 진입점
- multi-screen은 기존 TAB 마커 유지

## 컴포넌트 트리 = UI 스펙

### MVP

- 트리 시각화 (현재 Layers 패널)
- 전체 생성 코드 복사 (Copy Code 버튼)
- 코드 자체가 스펙 — `@/components/ui/*` → `@repo/ui/*`로 경로 치환하면 feature 코드로 사용

### 향후 확장

- 컴포넌트 단위 추출 (우클릭 → "컴포넌트로 추출")
- props 자동 추론
- feature-dev 에이전트 연동 (스펙 → 구현 자동화)

## 파일 구조

### `packages/ui-preview/`

```
packages/ui-preview/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── utils.ts              # cn() 유틸
│   └── components/
│       └── ui/
│           ├── button.tsx
│           ├── card.tsx
│           ├── input.tsx
│           ├── ... (66개 shadcn 컴포넌트)
│           └── index.ts      # 전체 re-export
```

### `apps/ui-composer/`

```
apps/ui-composer/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx              # Vite 엔트리
│   ├── App.tsx               # 메시지 수신 + 렌더링 오케스트레이션
│   ├── renderer/
│   │   ├── babel-transform.ts    # Babel standalone + custom import plugin
│   │   ├── module-registry.ts    # MODULE_MAP 관리
│   │   ├── code-executor.ts      # 변환 → 실행 → 마운트
│   │   └── error-boundary.tsx    # 런타임 에러 catch
│   ├── tree/
│   │   ├── dom-walker.ts         # DOM → ComponentTreeNode[]
│   │   └── tree-serializer.ts    # 트리 → JSX 코드 직렬화
│   ├── messaging/
│   │   ├── protocol.ts           # 메시지 타입 정의
│   │   └── handler.ts            # postMessage 수신/발신
│   ├── components/
│   │   ├── PreviewRoot.tsx       # 실제 렌더링 영역
│   │   ├── ErrorOverlay.tsx      # 에러 표시
│   │   └── LoadingSkeleton.tsx   # 온디맨드 fetch 대기
│   └── styles/
│       └── globals.css           # Tailwind + shadcn 테마 변수
```

## Desktop 측 변경

### `UIPreviewFrame.tsx` 변경

- `srcDoc` + `buildPreviewHtml()` 제거
- `src="http://localhost:4100"` iframe으로 교체
- postMessage 기반 통신으로 전환
- `preview-theme.ts` 삭제 (더 이상 불필요)

### `useUIComposerSession.ts` 변경

- 코드 추출 후 `postMessage({ type: "render", code })` 전송
- `resolveImport` 메시지 수신 → MCP fetch → `moduleResolved` 응답

### `ui-composer.ts` (tRPC router) 변경

- `buildPrompt`: JSX 기반 프롬프트로 전면 교체
- `DESIGN_SYSTEM_RULES`: 표준 JSX + import 규칙으로 변경

## turbo 통합

`turbo.json`에 `apps/ui-composer` dev task 추가:

```json
{
  "ui-composer#dev": {
    "dependsOn": ["^build"],
    "persistent": true,
    "cache": false
  }
}
```

`bun dev` 실행 시 Desktop + ui-composer가 함께 기동.

## 구현 순서 (예상)

1. `packages/ui-preview` 생성 — shadcn 컴포넌트 복사 + 독립 패키지
2. `apps/ui-composer` Vite 앱 scaffold — 빈 프리뷰 앱
3. Babel 변환 파이프라인 — module registry + import 치환 + 실행
4. postMessage 통신 — Desktop ↔ Preview 프로토콜
5. Desktop 측 UIPreviewFrame 교체 — srcDoc → iframe src
6. 에이전트 프롬프트 전환 — createElement → JSX
7. 온디맨드 fetch — MCP 연동 + 캐시
8. E2E 검증 — 실제 생성 → 프리뷰 → 트리 확인
