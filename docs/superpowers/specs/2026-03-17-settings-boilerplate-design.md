# Settings Boilerplate 이식 설계

## 개요
superbuilder desktop app의 settings 기능을 superbuilder-app-template에 100% 동일 UI/레이아웃으로 이식.

## 대상 페이지

### Personal 그룹
1. **Account** — 프로필 (아바타 `<input type="file">`, 이름, 이메일) + Sign Out
2. **Appearance** — Theme(라이트/다크/시스템, core/theme 연동) + UI Font 설정 + 언어(core/i18n 연동)
3. **Notifications** — Web Notification API + 브라우저 `<audio>` 알림 사운드

### Organization 그룹
4. **Organization** — 로고, 이름, slug 관리 + 멤버 테이블/초대/역할
5. **Integrations** — `packages/core/integrations/` 범용 provider 등록 프레임워크. feature가 provider를 등록하면 카드 자동 표시.
6. **Billing** — payment 패키지 내장 연동 (Inicis/Polar/LemonSqueezy). superbuilder-features에서 `packages/payment/`로 이동.

## 아키텍처

### 라우팅 구조
- Settings 전용 서브라우트: `/settings/account`, `/settings/appearance`, `/settings/notifications`, `/settings/organization`, `/settings/integrations`, `/settings/billing`
- AppLayout 안에 settings 서브레이아웃 (SettingsSidebar + 콘텐츠)
- TanStack Router `createRoute` 사용
- **Settings routes는 boilerplate core이므로 `[ATLAS:*]` 마커를 사용하지 않고 `router.tsx`에 직접 선언.**
- `/settings` 접근 시 `/settings/account`로 리다이렉트

### 파일 구조 (AGENTS.md "one folder per component" 준수)
```
apps/app/src/pages/settings/
├── settings-layout.tsx              # 서브레이아웃 (사이드바 + Outlet)
├── SettingsSidebar/
│   ├── SettingsSidebar.tsx          # 사이드바 네비게이션
│   └── index.ts
├── account/
│   ├── account-page.tsx
│   └── components/
│       └── ProfileCard/
│           ├── ProfileCard.tsx      # 아바타 업로드 + 이름/이메일
│           └── index.ts
├── appearance/
│   ├── appearance-page.tsx
│   └── components/
│       ├── ThemeSection/
│       │   ├── ThemeSection.tsx     # 라이트/다크/시스템
│       │   └── index.ts
│       ├── FontSection/
│       │   ├── FontSection.tsx      # UI 폰트 선택
│       │   └── index.ts
│       └── LanguageSection/
│           ├── LanguageSection.tsx   # i18n 언어 선택
│           └── index.ts
├── notifications/
│   ├── notifications-page.tsx
│   └── components/
│       ├── NotificationToggle/
│       │   ├── NotificationToggle.tsx  # Web Notification API on/off
│       │   └── index.ts
│       └── SoundPicker/
│           ├── SoundPicker.tsx         # <audio> 기반 알림 사운드 선택
│           └── index.ts
├── organization/
│   ├── organization-page.tsx
│   └── components/
│       ├── OrgInfoCard/
│       │   ├── OrgInfoCard.tsx      # 로고/이름/slug
│       │   └── index.ts
│       ├── MembersTable/
│       │   ├── MembersTable.tsx     # 멤버 목록 + 역할 배지
│       │   └── index.ts
│       └── InviteDialog/
│           ├── InviteDialog.tsx     # 멤버 초대
│           └── index.ts
├── integrations/
│   ├── integrations-page.tsx
│   └── components/
│       └── IntegrationCard/
│           ├── IntegrationCard.tsx  # 범용 integration 카드
│           └── index.ts
└── billing/
    ├── billing-page.tsx
    └── components/
        ├── CurrentPlanCard/
        │   ├── CurrentPlanCard.tsx
        │   └── index.ts
        ├── UpgradeCard/
        │   ├── UpgradeCard.tsx
        │   └── index.ts
        └── InvoiceList/
            ├── InvoiceList.tsx
            └── index.ts
```

### router.tsx 변경
```typescript
// Settings Layout — 마커 없이 직접 선언 (boilerplate core)
const settingsLayoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: () => { throw redirect({ to: "/settings/account" }); },
});

const settingsAccountRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/account",
  component: AccountPage,
});

const settingsAppearanceRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/appearance",
  component: AppearancePage,
});

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/notifications",
  component: NotificationsPage,
});

const settingsOrganizationRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/organization",
  component: OrganizationPage,
});

const settingsIntegrationsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/integrations",
  component: IntegrationsPage,
});

const settingsBillingRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/billing",
  component: BillingPage,
});

// routeTree에 추가
appLayoutRoute.addChildren([
  indexRoute,
  settingsLayoutRoute.addChildren([
    settingsIndexRoute,
    settingsAccountRoute,
    settingsAppearanceRoute,
    settingsNotificationsRoute,
    settingsOrganizationRoute,
    settingsIntegrationsRoute,
    settingsBillingRoute,
  ]),
  // [ATLAS:ROUTES]
  // [/ATLAS:ROUTES]
]),
```

### 사이드바 구조
Desktop의 GeneralSettings.tsx와 동일한 그룹 구조:
- **Personal**: Account, Appearance, Notifications
- **Organization**: Organization, Integrations, Billing

Desktop의 settings-search (필터링) 기능은 1차에서 제외. 사이드바 아이콘은 lucide-react 사용.

## Electron -> Web 전환 매핑

| Desktop (Electron) | Boilerplate (Web) | 비고 |
|---|---|---|
| `electronTrpc.window.selectImageFile` | `<input type="file" accept="image/*">` + FileReader | 파일 선택 |
| `electronTrpc.ringtone.*` | `<audio>` 태그 + Web Audio API | 사운드 미리듣기 |
| `electronTrpc.settings.getNotificationSoundsMuted` | tRPC `userPreference.get/set` | DB 저장 |
| `electronTrpc.window.getPlatform` | 제거 (항상 web) | - |
| `authClient.useSession()` | 동일 (core/auth) | - |
| `apiTrpcClient.*` | tRPC client (동일 패턴) | - |
| `useLiveQuery` (TanStack DB/Electric) | tRPC useQuery (일반 서버 조회) | 실시간 동기화 없음. Settings 특성상 저빈도 업데이트이므로 문제 없음 |
| `renderer/stores/settings-state` (zustand) | 제거 (라우트 기반, 검색 없음) | - |

## tRPC 라우터 설계

Settings 관련 서버 API. boilerplate `packages/core/trpc/`에 추가.

### 신규 라우터
```typescript
// packages/core/trpc/routers/user-preference.ts (신규)
userPreference.get({ key })        // 사용자 환경설정 조회
userPreference.set({ key, value }) // 사용자 환경설정 저장

// packages/core/trpc/routers/user.ts (기존 확장)
user.updateProfile({ name })       // 이름 변경
user.uploadAvatar({ file })        // 아바타 업로드 (presigned URL → S3/R2)

// packages/core/trpc/routers/organization.ts (기존 확장)
organization.update({ id, name })              // 조직명 변경
organization.updateSlug({ id, slug })          // 슬러그 변경
organization.uploadLogo({ id, file })          // 로고 업로드
organization.listMembers({ organizationId })   // 멤버 목록
organization.inviteMember({ email, role })     // 멤버 초대
organization.removeMember({ memberId })        // 멤버 제거
organization.updateMemberRole({ memberId, role }) // 역할 변경
```

### 기존 라우터 (변경 없음)
- `auth.signOut` — 로그아웃 (core/auth)
- `payment.*` — 결제/구독/인보이스 (packages/payment)

### 파일 스토리지
아바타/로고 업로드는 presigned URL 패턴 사용:
1. 클라이언트가 `uploadAvatar` 호출 → 서버가 presigned URL 반환
2. 클라이언트가 presigned URL로 직접 업로드
3. 서버에 URL 저장

스토리지 백엔드는 env 변수로 설정 (`STORAGE_PROVIDER=s3|r2|local`). boilerplate에 `packages/core/storage/` 유틸리티 추가 필요.

## Integration 프레임워크 설계

### 구조 분리 (서버/클라이언트)

서버와 클라이언트 관심사를 분리.

#### 서버: `packages/core/integrations/server/`
```typescript
// provider 서버 인터페이스
interface IntegrationProviderServer {
  id: string;
  name: string;
  description: string;
  category: "project" | "communication" | "storage" | "analytics" | "other";
  configSchema?: ZodSchema;

  getStatus(orgId: string): Promise<IntegrationStatus>;
  connect(orgId: string, config: unknown): Promise<void>;
  disconnect(orgId: string): Promise<void>;
}

// tRPC 라우터
integrations.list()                    // 등록된 provider 목록
integrations.getStatus({ providerId, orgId })  // 연결 상태
integrations.connect({ providerId, orgId, config })
integrations.disconnect({ providerId, orgId })
```

#### 클라이언트: `packages/core/integrations/client/`
```typescript
// 아이콘 등 UI 메타데이터
interface IntegrationProviderMeta {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

// 클라이언트 레지스트리 (React import 가능)
export function registerIntegrationMeta(meta: IntegrationProviderMeta): void;
export function getIntegrationsMeta(): IntegrationProviderMeta[];
```

#### DB 스키마: `packages/drizzle/src/schema/core/integration-connections.ts`
```typescript
export const integrationConnections = pgTable("integration_connections", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  providerId: text("provider_id").notNull(),       // e.g. "linear"
  status: text("status").notNull(),                 // "connected" | "disconnected" | "error"
  externalOrgName: text("external_org_name"),
  config: jsonb("config"),                          // 프로바이더별 설정
  accessToken: text("access_token"),                // 암호화 저장
  refreshToken: text("refresh_token"),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

Feature는 서버 부트 시 `registerIntegration()`을 호출. Settings > Integrations 페이지는 서버 `integrations.list()` + 클라이언트 meta로 IntegrationCard를 렌더링.

## Payment 이동 계획

### 소스
`superbuilder-features/features/payment/` (전체)

### 타겟
`superbuilder-app-template/packages/payment/` (독립 패키지, `packages/features/`와 분리)

> `packages/features/`는 atlas-engine이 동적으로 채우는 feature 호스트이므로, 항상 포함되는 payment는 별도 top-level 패키지로 둔다.

### 상세 변환 체크리스트

#### Import 변환
- `@superbuilder/core-auth` → `@repo/core/auth`
- `@superbuilder/core-trpc` → `@repo/core/trpc`
- `@superbuilder/core-db` → `@repo/drizzle`
- `@superbuilder/core-schema` → `@repo/drizzle/schema`
- `feature.json`의 `dependencies: ["profile"]` 제거 → boilerplate core auth/user 직접 참조

#### Schema 위치
- payment의 12개 테이블 → `packages/payment/src/schema/` 유지 (패키지 내부)
- `packages/drizzle/src/schema-registry.ts`에서 payment schema를 직접 import (마커 아님)
- `drizzle.config.ts`의 schema 스캔 경로에 `packages/payment/src/schema/**/*.ts` 추가

#### NestJS 모듈 등록
- `PaymentModule`을 `apps/server/src/app.module.ts`에 직접 import (마커 아님, core와 동일)
- `paymentRouter`를 `apps/server/src/trpc/router.ts`에 직접 등록

#### Client 라우트 연결
- `createPaymentAuthRoutes`를 `apps/app/src/router.tsx`에 직접 import하여 settings/billing 하위에 배치
- Admin 라우트 (`createPaymentAdminRoutes`)도 `apps/admin/src/router.tsx`에 직접 등록
- `feature.json`의 `provides` 선언은 더 이상 atlas-engine이 처리하지 않으므로 제거하거나 문서용으로만 유지

#### package.json
- 패키지명: `@repo/payment` (기존 `@superbuilder/feature-payment`에서 변경)
- workspace 등록: root `pnpm-workspace.yaml`에 `packages/payment` 추가

### superbuilder-features 정리
- `features/payment/` 디렉토리 삭제
- 다른 feature에서 payment 의존 시 → boilerplate의 `@repo/payment`를 core contract으로 제공

### Billing 페이지와 Payment 관계
- Billing 설정 페이지 (`apps/app/src/pages/settings/billing/`)는 `@repo/payment`의 tRPC 라우터를 직접 호출하는 thin wrapper
- Payment 패키지가 항상 존재하므로 별도 fallback 불필요
- Billing 페이지: 현재 플랜 표시, 업그레이드/다운그레이드, 인보이스 목록

## UI 방침

- **컴포넌트**: shadcn UI 기본 + superbuilder-ui MCP에서 추가 컴포넌트 탐색/설치
- **레이아웃**: HTML 시맨틱 엘리먼트 (`div`, `section`, `nav`, `ul`) + Tailwind
- **아이콘**: lucide-react (boilerplate 표준)
- **Desktop과 동일한 UI 패턴 유지**:
  - Card > CardContent > ul > li 패턴 (Account, Organization)
  - 그리드 카드 (Notifications 사운드, Appearance 테마)
  - Table (멤버 목록)
  - IntegrationCard (Integrations)

## 의존성

### 기존 core 패키지 활용
- `packages/core/auth` — 세션, 로그인/로그아웃
- `packages/core/theme` — 테마 전환
- `packages/core/i18n` — 언어 설정
- `packages/core/trpc` — API 호출

### 신규 core 패키지
- `packages/core/integrations/` — 범용 integration provider 등록 프레임워크 (server + client 분리)
- `packages/core/storage/` — 파일 업로드 유틸리티 (presigned URL, S3/R2/local)

### 이동 패키지
- `packages/payment/` — superbuilder-features에서 이동 (독립 top-level 패키지)

### DB 스키마 추가
- `integration_connections` 테이블 (core schema)
- `user_preferences` 테이블 (알림 설정 등 사용자 환경설정 저장)

## 범위 외 (1차 제외)
- Settings 검색 기능 (desktop의 settings-search)
- Keyboard shortcuts 설정
- Terminal/Git/Models/Behavior 설정 (desktop 전용)
- Devices/API Keys/Permissions 설정 (desktop 전용)
