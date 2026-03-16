# Settings Boilerplate 이식 설계

## 개요
superbuilder desktop app의 settings 기능을 superbuilder-app-boilerplate에 100% 동일 UI/레이아웃으로 이식.

## 대상 페이지

### Personal 그룹
1. **Account** — 프로필 (아바타 `<input type="file">`, 이름, 이메일) + Sign Out
2. **Appearance** — Theme(라이트/다크/시스템, core/theme 연동) + UI Font 설정 + 언어(core/i18n 연동)
3. **Notifications** — Web Notification API + 브라우저 `<audio>` 알림 사운드

### Organization 그룹
4. **Organization** — 로고, 이름, slug 관리 + 멤버 테이블/초대/역할
5. **Integrations** — `packages/core/integrations/` 범용 provider 등록 프레임워크. feature가 provider를 등록하면 카드 자동 표시.
6. **Billing** — payment feature(Inicis/Polar/LemonSqueezy) 내장 연동. superbuilder-features에서 boilerplate `packages/features/payment/`로 이동.

## 아키텍처

### 라우팅 구조
- Settings 전용 서브라우트: `/settings/account`, `/settings/appearance`, `/settings/notifications`, `/settings/organization`, `/settings/integrations`, `/settings/billing`
- AppLayout 안에 settings 서브레이아웃 (SettingsSidebar + 콘텐츠)
- TanStack Router `createRoute` 사용

### 파일 구조
```
apps/app/src/pages/settings/
├── settings-layout.tsx          # 서브레이아웃 (사이드바 + Outlet)
├── settings-sidebar.tsx         # 사이드바 네비게이션
├── account/
│   ├── account-page.tsx
│   └── components/
│       └── ProfileCard.tsx      # 아바타 업로드 + 이름/이메일
├── appearance/
│   ├── appearance-page.tsx
│   └── components/
│       ├── ThemeSection.tsx     # 라이트/다크/시스템
│       ├── FontSection.tsx      # UI 폰트 선택
│       └── LanguageSection.tsx  # i18n 언어 선택
├── notifications/
│   ├── notifications-page.tsx
│   └── components/
│       ├── NotificationToggle.tsx  # Web Notification API on/off
│       └── SoundPicker.tsx         # <audio> 기반 알림 사운드 선택
├── organization/
│   ├── organization-page.tsx
│   └── components/
│       ├── OrgInfoCard.tsx      # 로고/이름/slug
│       ├── MembersTable.tsx     # 멤버 목록 + 역할 배지
│       └── InviteDialog.tsx     # 멤버 초대
├── integrations/
│   ├── integrations-page.tsx
│   └── components/
│       └── IntegrationCard.tsx  # 범용 integration 카드
└── billing/
    ├── billing-page.tsx
    └── components/
        ├── CurrentPlanCard.tsx
        ├── UpgradeCard.tsx
        └── InvoiceList.tsx
```

### router.tsx 변경
```typescript
// Settings Layout
const settingsLayoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsAccountRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/account",
  component: AccountPage,
});
// ... 나머지 5개 라우트
```

### 사이드바 구조
Desktop의 GeneralSettings.tsx와 동일한 그룹 구조:
- **Personal**: Account, Appearance, Notifications
- **Organization**: Organization, Integrations, Billing

Desktop의 settings-search (필터링) 기능은 1차에서 제외. 사이드바 아이콘은 lucide-react 사용.

## Electron -> Web 전환 매핑

| Desktop (Electron) | Boilerplate (Web) |
|---|---|
| `electronTrpc.window.selectImageFile` | `<input type="file" accept="image/*">` + FileReader |
| `electronTrpc.ringtone.*` | `<audio>` 태그 + Web Audio API |
| `electronTrpc.settings.getNotificationSoundsMuted` | `localStorage` 또는 사용자 preference tRPC |
| `electronTrpc.window.getPlatform` | 제거 (항상 web) |
| `authClient.useSession()` | 동일 (core/auth) |
| `apiTrpcClient.*` | tRPC client (동일 패턴) |
| `useLiveQuery` (TanStack DB/Electric) | tRPC useQuery (일반 서버 조회) |
| `renderer/stores/settings-state` (zustand) | 제거 (라우트 기반, 검색 없음) |

## Integration 프레임워크 설계

### `packages/core/integrations/`
```typescript
// provider 인터페이스
interface IntegrationProvider {
  id: string;              // e.g. "linear", "github", "slack"
  name: string;
  description: string;
  icon: React.ComponentType;
  category: "project" | "communication" | "storage" | "analytics" | "other";
  configSchema?: ZodSchema; // 연결 시 필요한 설정

  // 상태 조회
  getStatus(orgId: string): Promise<IntegrationStatus>;

  // 연결/해제
  connect(orgId: string, config: unknown): Promise<void>;
  disconnect(orgId: string): Promise<void>;
}

// 등록 레지스트리
const integrationRegistry = new Map<string, IntegrationProvider>();

export function registerIntegration(provider: IntegrationProvider): void;
export function getIntegrations(): IntegrationProvider[];
export function getIntegration(id: string): IntegrationProvider | undefined;
```

Feature는 서버 부트 시 `registerIntegration()`을 호출하여 자신을 등록. Settings > Integrations 페이지는 `getIntegrations()`로 등록된 모든 provider를 조회하여 IntegrationCard로 렌더링.

## Payment 이동 계획

### 소스
`superbuilder-features/features/payment/` (전체)

### 타겟
`superbuilder-app-boilerplate/packages/features/payment/`

### 변환
- `@superbuilder/*` import -> `@repo/*` import (atlas-engine transformImports 패턴)
- `feature.json`의 `dependencies: ["profile"]` -> boilerplate core의 auth/user 직접 참조로 변경
- `profile` feature 의존성 제거 (boilerplate에 내장)

### superbuilder-features 정리
- `features/payment/` 디렉토리 삭제
- feature registry에서 payment 제거

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
- `packages/core/integrations` — 범용 integration provider 등록 프레임워크

### 이동 패키지
- `packages/features/payment` — superbuilder-features에서 이동

## 범위 외 (1차 제외)
- Settings 검색 기능 (desktop의 settings-search)
- Keyboard shortcuts 설정
- Terminal/Git/Models/Behavior 설정 (desktop 전용)
- Devices/API Keys/Permissions 설정 (desktop 전용)
