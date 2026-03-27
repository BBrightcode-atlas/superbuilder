# Superbuilder

SaaS 프로젝트 빌더 — 재사용 가능한 feature를 축적하고, 선택하고, 조합하여 프로덕션 레디 프로젝트를 생성한다.

## 개요

Superbuilder는 단순한 scaffold 도구가 아니라 **feature를 순환시키는 플랫폼**이다.

```
Compose (feature 선택 + 프로젝트 생성)
  → 기본 틀 생성 (auth, DB, 인프라 + 선택한 feature)
    → 비즈니스 로직 직접 구현
      → 재사용 가능한 패턴 발견 시
        → Feature로 역추출 (superbuilder-features에 등록)
          → 다음 프로젝트에서 재사용
```

## 3-Repo 아키텍처

| 레포 | 역할 | 브랜치 |
|------|------|--------|
| **superbuilder** (이 레포) | 빌더 도구 — Desktop, atlas-engine, Registry | `develop` → `main` |
| **superbuilder-features** | Feature 코드 저장소 — feature 패키지, Core Contract | `main` |
| **superbuilder-app-template** | 앱 템플릿 — 빈 셸 + `[ATLAS:*]` 마커 | `develop` |

## 주요 구성

### Apps

| 앱 | 설명 |
|----|------|
| `apps/web` | 메인 웹앱 (app.superset.sh) |
| `apps/marketing` | 마케팅 사이트 |
| `apps/admin` | 관리자 대시보드 |
| `apps/api` | API 백엔드 |
| `apps/desktop` | Electron 데스크톱 앱 |
| `apps/docs` | 문서 사이트 |
| `apps/mobile` | React Native 모바일 (Expo) |

### Packages

| 패키지 | 설명 |
|--------|------|
| `packages/atlas-engine` | Feature manifest 읽기, 의존성 해석, 프로젝트 scaffold |
| `packages/ui` | 공유 UI 컴포넌트 (shadcn/ui + TailwindCSS v4) |
| `packages/db` | Drizzle ORM 스키마 |
| `packages/auth` | 인증 |
| `packages/trpc` | 공유 tRPC 정의 |
| `packages/shared` | 공유 유틸리티 |
| `packages/agent` | Agent 로직 |
| `packages/mcp` | MCP 통합 |
| `packages/scripts` | CLI 도구 |

## atlas-engine

Compose 파이프라인의 핵심 엔진. Feature를 읽고, 해석하고, 템플릿에 연결한다.

```
packages/atlas-engine/src/
├── manifest/     — feature.json 스캔, FeatureRegistry 변환
├── resolver/     — 의존성 해석 + 토폴로지 정렬
├── connection/   — provides → 코드 스니펫 도출, 마커에 삽입
├── transform/    — 상대경로 schema import → @repo/drizzle/schema 변환
├── scaffold/     — template clone + feature 복사 + 변환 + connection
└── pipeline/     — composePipeline (scaffold + Neon + GitHub + Vercel + seed)
```

### Compose Pipeline

```
feature 선택 → resolve (의존성) → scaffold (template + features)
  → Neon DB 생성 → GitHub repo → Vercel 배포 (server → app → admin → landing) → seed
```

## 기술 스택

- **패키지 매니저**: Bun
- **빌드**: Turborepo
- **데이터베이스**: Drizzle ORM + Neon PostgreSQL
- **UI**: React + TailwindCSS v4 + shadcn/ui
- **코드 품질**: Biome (포맷팅 + 린팅)

## 개발 명령어

```bash
bun dev                    # 전체 dev 서버 시작
bun test                   # 테스트 실행
bun build                  # 전체 빌드
bun run lint:fix           # lint 자동 수정
bun run typecheck          # 타입 체크
```

### atlas-engine 테스트

```bash
cd packages/atlas-engine
bun test                   # 116 tests
```

## Feature 라이프사이클

1. `scanFeatureManifests(featuresDir)` → feature.json 기반 스캔
2. `manifestsToRegistry()` → FeatureRegistry 변환
3. `resolveFeatures()` → 의존성 해석 + 토폴로지 정렬
4. `scaffold()` → template clone + feature 복사 + import 변환 + connection 삽입
5. `composePipeline()` → scaffold + Neon + GitHub + Vercel + seed

## Import 규칙

- Feature 코드는 `@repo/*` import를 사용 (superbuilder-features, superbuilder-app-template 모두 동일)
- 상대경로 `../../schema` import → `@repo/drizzle/schema`로 자동 변환 (scaffold 시)
- `@superbuilder/*` import는 더 이상 사용하지 않음

## 브랜치 전략

| 브랜치 | 역할 |
|--------|------|
| `develop` | 작업 브랜치 — 모든 개발은 여기서 |
| `main` | 안정 브랜치 — develop에서 PR로 머지 |
| `main_superset` | upstream 원본 추적 전용 |

## 참고 문서

- 3-Repo 아키텍처: `docs/architecture/three-repo-architecture.md`
- Marker 레퍼런스: `docs/architecture/subsystems/marker-reference.md`
- feature.json 스키마: `docs/architecture/subsystems/feature-json-schema.md`
- Composer 파이프라인: `docs/architecture/subsystems/composer-scaffold-pipeline.md`
