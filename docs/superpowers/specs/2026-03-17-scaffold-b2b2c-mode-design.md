# Scaffold Engine B2B2C 모드 분기 설계

## 개요

기존 SaaS scaffold를 전혀 수정하지 않고, B2B2C 모드 전용 scaffold 함수를 별도로 구현한다.
공통 단계는 기존 함수를 import해서 재사용하고, 변경이 필요한 5단계만 새로 만든다.

## 핵심 원칙

- **기존 파일 0개 수정** — SaaS scaffold는 완전히 보존
- 공통 단계는 기존 함수를 `import`해서 호출
- B2B2C 전용 로직만 `*-b2b2c.ts` 파일에 구현

## 파일 구조

```
packages/atlas-engine/src/
├── scaffold/
│   ├── scaffold.ts              # 기존 (변경 없음)
│   ├── scaffold-b2b2c.ts        # 신규 — B2B2C scaffold 오케스트레이터
│   ├── copy-features.ts         # 기존 (변경 없음)
│   ├── copy-features-b2b2c.ts   # 신규 — landing slot 추가, client slot 제외
│   └── landing-page-generator.ts # 신규 — provides.landing.pages → page.tsx 생성
├── connection/
│   ├── deriver.ts               # 기존 (변경 없음)
│   ├── deriver-b2b2c.ts         # 신규 — landing 마커 스니펫 생성
│   ├── apply-connections.ts     # 기존 (변경 없음)
│   └── apply-connections-b2b2c.ts # 신규 — landing 마커 + client 마커 제외
├── pipeline/
│   ├── compose.ts               # 기존 (변경 없음)
│   └── compose-b2b2c.ts         # 신규 — app 배포 제외, admin mode 설정
└── transform/
    ├── import-transformer.ts    # 기존 (변경 없음)
    └── transform-b2b2c.ts       # 신규 — landing 디렉토리 추가, client 제외
```

## scaffoldB2B2C() 흐름

```
scaffoldB2B2C(input: ScaffoldB2B2CInput): Promise<ScaffoldResult>
├── 1~7. scaffold()의 공통 단계 재사용
│   ├── 1. Clone template (gh repo clone)
│   ├── 2. Remove .git
│   ├── 3. Update package.json (project name)
│   ├── 4. Update superbuilder.json
│   ├── 5. Resolve features source
│   ├── 6. Scan feature.json manifests
│   └── 7. Filter selected features
├── 8.  copyFeaturesB2B2C()       — client 제외, landing 추가
├── 9.  transformImportsB2B2C()   — client dir 제외, landing dir 추가
├── 10. applyConnectionsB2B2C()   — client 마커 제외, landing 마커 추가
├── 11. generateLandingPages()    — provides.landing.pages → page.tsx 생성
├── 12. setAdminMode("b2b2c")    — apps/admin/src/lib/project.ts의 APP_MODE 변경
├── 13. Update package exports (기존 재사용)
├── 14. Git init + commit (기존 재사용)
```

### 공통 단계 재사용 전략

`scaffold.ts`의 공통 단계(1~7, 13~14)를 직접 호출하기 위해, 기존 scaffold 함수 내부의 개별 단계들을 import한다.
기존 scaffold.ts가 이미 export하고 있는 헬퍼 함수들:
- `copyFeaturesToTemplate()` — copy-features.ts
- `applyConnections()` — apply-connections.ts
- `transformDirectory()` — import-transformer.ts
- `updateFeatureExports()` — update-package-exports.ts
- `scanFeatureManifests()` — manifest/scanner.ts

기존에 export되지 않는 로직 (clone, clean, update package.json 등)은 scaffoldB2B2C에서 동일 코드를 재구현하거나, scaffold.ts에서 단계별 함수를 extract해서 공유 유틸로 만들 수 있다.
**선호 방안**: scaffold.ts의 공통 로직을 `scaffold/steps.ts`로 추출하여 양쪽에서 사용. 단, scaffold.ts 자체는 수정하지 않고 steps.ts에서 새로 구현한 뒤, 기존 scaffold.ts는 나중에 리팩토링 가능.

## B2B2C Slot 매핑

| Slot | Source (features) | Target (template) | SaaS | B2B2C |
|------|-------------------|-------------------|------|-------|
| server | `src/server` | `packages/features/{id}/` | ✅ | ✅ |
| client | `src/client` | `apps/app/src/features/{id}/` | ✅ | ❌ 제외 |
| admin | `src/admin` | `apps/admin/src/features/{id}/` | ✅ | ✅ |
| schema | `src/schema` | `packages/drizzle/src/schema/features/{id}/` | ✅ | ✅ |
| widgets | `src/widget` | `packages/widgets/src/{id}/` | ✅ | ✅ |
| **landing** | `src/landing` | `apps/landing/src/features/{id}/` | ❌ | ✅ 신규 |

### apps/app 처리

B2B2C에서 `apps/app/`은 **삭제하지 않고 그대로 둔다**. Feature client 코드만 복사하지 않고, Vercel app 배포를 건너뛴다. workspace가 깨지지 않고, 나중에 SaaS 전환도 용이.

## Feature provides 모드별 처리

| provides 키 | SaaS 모드 | B2B2C 모드 |
|---|---|---|
| server | 적용 | 적용 |
| admin | 적용 | 적용 |
| client (= app) | **적용** | **무시** |
| landing | **무시** | **적용** |
| schema | 적용 | 적용 |

## Landing 마커 처리 (삽입형)

기존 마커 시스템(`insertAtMarker`)을 그대로 사용. deriver-b2b2c.ts에서 landing 스니펫을 생성.

| 마커 | 파일 | 삽입 내용 |
|------|------|----------|
| `LANDING_IMPORTS` | `apps/landing/src/app/layout.tsx` | Feature Provider/컴포넌트 import |
| `LANDING_SITEMAP` | `apps/landing/src/app/sitemap.ts` | Feature 페이지 URL 엔트리 |
| `LANDING_LLMS_IMPORTS` | `apps/landing/src/app/llms.txt/route.ts` | Feature 관련 import |
| `LANDING_LLMS_PAGES` | `apps/landing/src/app/llms.txt/route.ts` | return 배열에 페이지 링크 push |
| `LANDING_PROVIDER_IMPORTS` | `apps/landing/src/providers.tsx` | Feature Provider import |

### deriverB2B2C() 스니펫 생성 예시

```typescript
// provides.landing.pages[0] = { path: "/board", widget: { package: "@superbuilder/feature-board/landing", component: "LandingBoardList" } }

// LANDING_IMPORTS
import { LandingBoardList } from "@repo/features/board/landing";

// LANDING_SITEMAP
{ url: "/board", lastModified: new Date() },

// LANDING_LLMS_PAGES
{ title: "게시판", url: "/board", description: "공지사항 및 소식을 확인하세요" },
```

## Landing 페이지 생성 (생성형)

`provides.landing.pages` 배열을 순회하며 파일 생성.

### 생성 경로
```
apps/landing/src/app/(public)/{path}/page.tsx
```

### template: "widget-page" + ssr: true

```tsx
import type { Metadata } from "next";
import { serverTrpc } from "@/lib/trpc";
import { LandingBoardList } from "@repo/features/board/landing";

export const metadata: Metadata = {
  title: "게시판",
  description: "공지사항 및 소식을 확인하세요",
};

export default async function BoardPage() {
  const data = await serverTrpc.board.list.query();
  return (
    <main>
      <LandingBoardList initialData={data} />
    </main>
  );
}
```

### template: "widget-page" + ssr: false

```tsx
import type { Metadata } from "next";
import { LandingBoardList } from "@repo/features/board/landing";

export const metadata: Metadata = {
  title: "게시판",
  description: "공지사항 및 소식을 확인하세요",
};

export default function BoardPage() {
  return (
    <main>
      <LandingBoardList />
    </main>
  );
}
```

### template: "custom"

경고 출력만:
```
ℹ Feature "payment"의 landing 페이지는 template: "custom"입니다. 수동으로 구현하세요.
  경로: apps/landing/src/app/(public)/{path}/page.tsx
```

### generateLandingPages() 구현

```typescript
export async function generateLandingPages(
  templateDir: string,
  manifests: FeatureManifest[],
): Promise<void> {
  for (const manifest of manifests) {
    if (!manifest.provides.landing?.pages) continue;

    for (const page of manifest.provides.landing.pages) {
      if (page.template === "custom") {
        console.log(`ℹ Feature "${manifest.id}"의 ${page.path} 페이지는 custom template입니다.`);
        continue;
      }

      const pagePath = path.join(
        templateDir,
        "apps/landing/src/app/(public)",
        page.path,
        "page.tsx",
      );

      const content = generateWidgetPageContent(page, manifest.id);
      await fs.mkdir(path.dirname(pagePath), { recursive: true });
      await fs.writeFile(pagePath, content, "utf-8");
    }
  }
}
```

## Admin APP_MODE 설정

B2B2C 모드에서 `apps/admin/src/lib/project.ts`의 `APP_MODE`를 `"b2b2c"`로 변경:

```typescript
// setAdminMode()
// apps/admin/src/lib/project.ts 파일에서:
// export const APP_MODE: AppMode = "saas";
// →
// export const APP_MODE: AppMode = "b2b2c";
```

SaaS 모드에서는 boilerplate 기본값 "saas" 유지.

## composePipelineB2B2C() 변경

| Step | SaaS | B2B2C |
|------|------|-------|
| 1. scaffold | `scaffold()` | `scaffoldB2B2C()` |
| 2. Neon DB | ✅ | ✅ (동일) |
| 3. GitHub | ✅ | ✅ (동일) |
| 4. Vercel app | ✅ 배포 | ❌ 건너뜀 |
| 5. Vercel server | ✅ | ✅ (동일) |
| 6. Vercel admin | ✅ | ✅ (동일) |
| 7. Vercel landing | ✅ | ✅ (동일) |
| 8. CORS_ORIGINS | 4개 URL | 3개 (app 제외) |
| 9. Env, install, migrate, seed | ✅ | ✅ (동일) |

## 경고 시스템

B2B2C에서 `provides.client`만 있고 `provides.landing`이 없는 feature:

```
⚠ Feature "analytics"는 provides.landing이 없어 B2B2C 모드에서 공개 UI가 생성되지 않습니다.
  admin에서만 사용 가능합니다.
```

이 경고는 scaffoldB2B2C()의 feature 필터링 단계에서 출력.

## Import 변환 (B2B2C)

기존 `transformDirectory()`를 재사용하되, 대상 디렉토리만 변경:

### SaaS (기존)
1. `packages/features/`
2. `apps/app/src/features/`
3. `apps/admin/src/features/`
4. `packages/drizzle/src/schema/features/`
5. `packages/widgets/src/`

### B2B2C (신규)
1. `packages/features/`
2. `apps/admin/src/features/`
3. `packages/drizzle/src/schema/features/`
4. `packages/widgets/src/`
5. **`apps/landing/src/features/`** (신규 추가)

> `apps/app/src/features/`는 B2B2C에서 코드가 복사되지 않으므로 변환 불필요.

## ScaffoldB2B2CInput 타입

```typescript
export interface ScaffoldB2B2CInput {
  projectName: string;
  targetDir: string;
  featuresToKeep: string[];
  templateRepo?: string;
  featuresSourceDir?: string;
  featuresRepo?: string;
  // B2B2C에서는 mode 필드 불필요 — 함수 자체가 B2B2C 전용
}
```

기존 `ScaffoldInput`과 동일한 구조. mode 필드는 불필요 (함수 자체가 B2B2C 전용이므로).

## 참조 문서

- 전체 B2B2C 설계: `superbuilder-app-boilerplate/docs/superpowers/specs/2026-03-17-b2b2c-architecture-design.md`
- Landing 품질 규칙: `superbuilder-app-boilerplate/.claude/rules/frontend/landing-quality.md`
- Feature provides.landing 스펙: `superbuilder-features/AGENTS.md`
- 기존 scaffold 코드: `packages/atlas-engine/src/scaffold/scaffold.ts`
- 기존 connection 코드: `packages/atlas-engine/src/connection/`
- 기존 pipeline 코드: `packages/atlas-engine/src/pipeline/compose.ts`
- Marker 레퍼런스: `docs/architecture/subsystems/marker-reference.md`
