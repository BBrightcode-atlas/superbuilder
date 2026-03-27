# Harness Engineering: Agent Context Injection

> Compose 시 생성된 프로젝트에 에이전트가 즉시 작업 가능한 컨텍스트를 자동 주입한다.

## 배경

Superbuilder는 에이전트 하네스다. 프로젝트를 생성하고, 에이전트가 그 안에서 비즈니스 로직을 구현한다. 현재 scaffold는 `.claude/settings.json`(기본 권한)만 주입하며, 에이전트가 프로젝트 구조/규칙/설치된 feature를 이해할 수 있는 컨텍스트가 없다.

### 사용 패턴

```
사람: 시각적으로 확인 + 프롬프트로 지시
에이전트: 설계 스펙을 지키며 코드 구현
```

- 설치된 feature(blog, payment 등)는 완성품 — 사용만 함
- 비즈니스 feature(예: lore-builder)는 에이전트가 새로 만듦
- 비즈니스 스펙은 외부(gstack 등)에서 기획/디자인/설계 후 전달
- 실행 환경: Superbuilder Desktop + 독립 CLI 양쪽

## 설계

### 1. 정적 룰 — app-template 내장

어떤 feature를 선택하든 항상 동일한 불변 룰. template에 미리 포함.

#### 파일 구조

```
superbuilder-app-template/
├── AGENTS.md                     ← 정적 룰 진입점
├── .claude/
│   └── rules/
│       ├── architecture.md       ← 디렉토리 구조, 레이어 규칙
│       ├── code-style.md         ← Biome, 네이밍, 타입 안전성
│       ├── feature-structure.md  ← 비즈니스 feature 생성 패턴
│       ├── database.md           ← Drizzle 스키마 규칙, migration 절차
│       ├── auth.md               ← Better Auth 계약, 금지 패턴
│       ├── api.md                ← tRPC/NestJS 라우터 패턴, public/protected/admin
│       ├── frontend.md           ← React 컴포넌트 구조, shadcn 강제, import 규칙
│       └── spec-intake.md        ← 비즈니스 스펙 수용 절차
├── .cursor/
│   └── rules/                    ← .claude/rules/ 디렉토리 심링크 (Cursor 호환)
└── docs/specs/
    └── README.md                 ← 스펙 배치 가이드
```

#### 룰 내용 (superbuilder 본체 규칙에서 파생)

| 파일 | 소스 | 변환 |
|------|------|------|
| `architecture.md` | superbuilder `.claude/rules/architecture.md` | 3-repo/atlas-engine 내부사항 제거, 생성 프로젝트 구조만 |
| `code-style.md` | superbuilder `AGENTS.md` 코드 품질 섹션 | Biome 설정, 타입 안전성, 네이밍 규칙 |
| `feature-structure.md` | superbuilder `.claude/rules/feature/definition.md` + `steps.md` | page/widget/agent feature 패턴, 폴더 구조 |
| `database.md` | superbuilder `.claude/rules/feature/schema.md` + `AGENTS.md` DB 섹션 | Drizzle 규칙, migration 절차 |
| `auth.md` | superbuilder `.claude/rules/feature/auth.md` | Better Auth 계약, 금지 패턴 |
| `api.md` | superbuilder `.claude/rules/public-api.md` | tRPC procedure 선택 기준, NestJS 패턴 |
| `frontend.md` | superbuilder `CLAUDE.md` FE UI 규칙 + `.claude/rules/feature/widget.md` | shadcn 강제, 컴포넌트 구조, import 규칙 |
| `spec-intake.md` | 신규 작성 | 비즈니스 스펙 수용/재정렬 절차 |

### 2. 동적 생성 — CLAUDE.md

scaffold 단계에서 선택된 feature 기반으로 CLAUDE.md를 생성.

#### 구현

```typescript
// packages/atlas-engine/src/scaffold/generate-claude-md.ts

import type { FeatureManifest } from "../manifest/types";

interface ClaudeMdContext {
  projectName: string;
  features: FeatureManifest[];    // scanFeatureManifests() 결과
  urls: {
    api: string;                   // Vercel 배포 URL
    app: string;
    admin: string;
    landing: string;
  };
}

function generateClaudeMd(ctx: ClaudeMdContext): string
```

#### 생성 결과

```markdown
# {프로젝트명}

## 기술 스택
- Runtime: Bun
- Framework: NestJS (server) + React + Vite (client)
- DB: Drizzle ORM + Neon PostgreSQL
- Auth: Better Auth
- UI: shadcn/ui + TailwindCSS v4

## 설치된 Feature
| Feature | 타입 | 주요 API | 스키마 테이블 |
|---------|------|---------|-------------|
| blog | page | blogRouter (CRUD) | blog_posts, blog_categories |
| payment | page | paymentRouter (checkout, webhook) | payment_orders |

## 프로젝트 구조
apps/app/        ← Vite 클라이언트 (SPA)
apps/admin/      ← 관리자 (Vite)
apps/server/     ← NestJS API
apps/landing/    ← Next.js 랜딩
packages/core/   ← 인프라 (auth, trpc, i18n)
packages/drizzle/ ← DB 스키마

## 비즈니스 Feature 추가 시
1. `docs/specs/` 에 스펙 문서 배치
2. `.claude/rules/` 의 규칙을 따라 구현
3. 상세 규칙은 AGENTS.md 참조

## 환경
- API: {VITE_API_URL}
- App: {APP_URL}
- Admin: {ADMIN_URL}

@AGENTS.md
```

#### 데이터 소스

- **Feature 테이블**: `FeatureManifest`에서 추출
  - `manifest.type` → 타입 (page/widget/agent)
  - `manifest.provides.server.router` → 주요 API (없으면 "-" 표시)
  - `manifest.provides.schema.tables` → 스키마 테이블 (없으면 "-" 표시)
  - widget-only feature 등 server/schema가 없는 경우 해당 컬럼은 "-"로 표시
- **URL**: compose pipeline의 vercel 단계 결과
- **기술 스택**: 정적 (template 고정)

### 3. .mcp.json 자동 주입

compose 시 외부 서비스 MCP 연결을 자동 설정.

#### 구현

```typescript
// packages/atlas-engine/src/scaffold/generate-mcp-json.ts

// env var reference를 문자열로 삽입 (실제 키를 파일에 넣지 않음)
// 사용자가 .env에 NEON_API_KEY를 설정하면 에이전트가 MCP로 DB 접근 가능
function generateMcpJson(): McpConfig
```

#### 생성 결과

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": { "NEON_API_KEY": "${NEON_API_KEY}" }
    },
    "superbuilder-mcp": {
      "type": "url",
      "url": "https://superbuilder-ui.vercel.app/mcp"
    }
  }
}
```

- **Neon**: DB 조회/마이그레이션. 에이전트가 스키마 확인, 데이터 탐색
- **superbuilder-mcp**: UI 컴포넌트 카탈로그 조회. shadcn 강제 룰과 연동

### 4. 스펙 재정렬 — 비즈니스 스펙 수용 절차

별도 도구 없음. `.claude/rules/spec-intake.md`에 절차를 명시하면 에이전트가 따름.

#### spec-intake.md 내용

```markdown
# 비즈니스 스펙 수용 절차

## 스펙 위치
- `docs/specs/` 에 배치된 문서를 비즈니스 스펙으로 인식

## 구현 전 재정렬 (필수)
스펙을 받으면 바로 코딩하지 않는다. 먼저 다음을 수행:

### 1. 스펙 분석
- 스펙에서 요구하는 엔티티, API, 화면 목록 추출

### 2. 프로젝트 룰 매핑
- DB → Drizzle 스키마 규칙(database.md)에 맞게 테이블 설계
- API → tRPC/NestJS 패턴(api.md)에 맞게 라우터 설계
- Auth → Better Auth 계약(auth.md) 활용, 커스텀 auth 금지
- UI → shadcn 컴포넌트 우선(frontend.md), 설치된 feature 위젯 재사용
- 구조 → feature-structure.md 패턴으로 폴더 배치

### 3. 기존 자산 활용
- 설치된 feature의 API를 확인하고 중복 구현 방지
- CLAUDE.md의 "설치된 Feature" 테이블 참조

### 4. 구현 계획 작성
- `docs/specs/{name}/implementation-plan.md` 에 재정렬 결과 저장
- 사람에게 리뷰 요청 후 승인되면 구현 시작
```

#### 스펙 전달 경로

**Desktop**: Superbuilder UI에서 스펙 파일 선택 → `docs/specs/`에 저장 → 에이전트에게 지시 (Desktop UI의 스펙 주입 자동화는 이번 스코프 밖, 향후 확장)

**독립 CLI**: 개발자가 직접 `docs/specs/`에 파일 배치 → 에이전트에게 지시

## 구현 범위

### 변경 대상

| 레포 | 파일/디렉토리 | 작업 |
|------|-------------|------|
| **app-template** | `.claude/rules/*.md` (8개) | 정적 룰 파일 신규 생성 |
| **app-template** | `AGENTS.md` | 룰 진입점 신규 생성 |
| **app-template** | `docs/specs/README.md` | 스펙 배치 가이드 |
| **app-template** | `.cursor/rules` | `.claude/rules` 심링크 |
| **superbuilder** | `packages/atlas-engine/src/scaffold/generate-claude-md.ts` | CLAUDE.md 동적 생성 함수 |
| **superbuilder** | `packages/atlas-engine/src/scaffold/generate-mcp-json.ts` | .mcp.json 생성 함수 |
| **superbuilder** | `packages/atlas-engine/src/scaffold/scaffold.ts` | 기존 scaffold에 위 함수 호출 추가 (git init/commit 단계 직전에 삽입) |

### 안 건드리는 것

- `feature.json` 스키마 변경 없음 (기존 `provides`에서 읽음)
- 새 pipeline 단계 없음 (scaffold 안에서 처리)
- Desktop UI 변경 없음 (이번 스코프 아님)
- superbuilder-features 변경 없음

## 검증

- Compose E2E: feature 선택 후 scaffold → 생성된 프로젝트에 CLAUDE.md, AGENTS.md, .claude/rules/, .mcp.json, docs/specs/ 존재 확인
- CLAUDE.md 내용: 선택된 feature가 테이블에 올바르게 나열되는지 확인
- 에이전트 테스트: 생성된 프로젝트에서 `claude` 실행 → 룰을 인식하는지 확인
