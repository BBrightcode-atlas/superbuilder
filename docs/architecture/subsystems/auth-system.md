# Auth System 아키텍처

> Feature가 auth를 올바르게 사용하기 위한 통합 레퍼런스.

---

## 1. 핵심 원칙

- **better-auth** 기반 세션 인증 (JWT 아님)
- Feature는 `@superbuilder/core-auth`, `@superbuilder/core-trpc`만 사용
- Scaffold 시 `@repo/core/auth`, `@repo/core/trpc`로 자동 변환
- tRPC와 REST 양쪽 모두 **동일한 auth 수준** 적용

---

## 2. Procedure / Guard 매핑

| 접근 수준 | tRPC Procedure | REST Guard | 용도 |
|----------|---------------|------------|------|
| **공개** | `publicProcedure` | (없음) | 누구나 접근 — 목록 조회, 랜딩 데이터 |
| **로그인 필수** | `protectedProcedure` | `@UseGuards(BetterAuthGuard)` | 내 데이터, 프로필, 작성 |
| **관리자 전용** | `adminProcedure` | `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)` | CRUD, 통계, 설정 |

> `authProcedure`는 `protectedProcedure`의 alias.

---

## 3. Feature에서 사용법

### tRPC Router

```typescript
import { publicProcedure, protectedProcedure, adminProcedure, createTRPCRouter } from "@superbuilder/core-trpc";

export const bookingRouter = createTRPCRouter({
  // 공개
  getAvailable: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(({ input }) => service.getAvailable(input.date)),

  // 로그인 필수
  myBookings: protectedProcedure
    .query(({ ctx }) => service.findByUser(ctx.user!.id)),

  // 관리자 전용
  admin: createTRPCRouter({
    listAll: adminProcedure
      .query(() => service.listAll()),
  }),
});
```

### REST Controller

```typescript
import { BetterAuthGuard, BetterAuthAdminGuard, CurrentUser, type User } from "@superbuilder/core-auth";

@Controller("booking")
export class BookingController {
  // 공개
  @Get("available")
  async getAvailable(@Query("date") date: string) { ... }

  // 로그인 필수
  @Get("my")
  @UseGuards(BetterAuthGuard)
  async myBookings(@CurrentUser() user: User) { ... }

  // 관리자 전용 — Guard 순서 주의!
  @Get("admin/list")
  @UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
  async adminList() { ... }
}
```

---

## 4. 금지 사항

| 하지 말 것 | 이유 | 올바른 방법 |
|-----------|------|-----------|
| `@repo/core/auth` 직접 import | feature repo에서 동작 안 함 | `@superbuilder/core-auth` 사용 |
| `BetterAuthAdminGuard` 단독 사용 | session 검증 누락 | `BetterAuthGuard` 먼저, 그 다음 `BetterAuthAdminGuard` |
| `publicProcedure`에서 `ctx.user.id` 접근 | 비로그인 시 crash | `protectedProcedure` 사용 또는 null 체크 |
| JWT 토큰 직접 파싱 | 레거시 방식 | `auth.api.getSession()` 사용 |
| auth 관련 테이블 직접 생성 | better-auth가 관리 | drizzle schema의 `core/auth-tables.ts`만 수정 |
| feature에서 auth 설정 재정의 | 중앙 관리 파괴 | boilerplate `core/auth/server/auth.ts`에서만 설정 |

---

## 5. Client (React) Auth

### Atoms (Jotai)

```typescript
import { authenticatedAtom, profileAtom } from "@superbuilder/core-auth";
import { useAtomValue } from "jotai";

function MyComponent() {
  const authenticated = useAtomValue(authenticatedAtom);
  const profile = useAtomValue(profileAtom);
  // ...
}
```

### tRPC Hook

```typescript
import { useTRPC } from "@superbuilder/core-trpc/client";

function MyPage() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.booking.myBookings.queryOptions());
}
```

> `useTRPC`는 `@superbuilder/core-trpc/client` 경로 사용 (scaffold 후 `@/lib/trpc`로 변환).

---

## 6. Admin Role 체계

| Role | 권한 | 할당 |
|------|------|------|
| `owner` | 전체 관리자 | organization 생성자 / seed |
| `admin` | 관리 기능 | owner가 할당 |
| `member` | 일반 사용자 | 기본값 |

`adminProcedure` / `BetterAuthAdminGuard`는 `["owner", "admin"]` role만 허용.

Role은 **organization의 member role**에서 가져옴 (better-auth organization plugin):
```
user → member(organization_id, user_id, role) → role
```

---

## 7. 환경변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `BETTER_AUTH_URL` | better-auth base URL (서버 자체 URL) | ✅ |
| `BETTER_AUTH_SECRET` | 세션 암호화 키 | ✅ |
| `CORS_ORIGINS` | 허용 origin (앱, 서버, admin URL) | ✅ |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth | 선택 |
| `NAVER_CLIENT_ID/SECRET` | Naver OAuth | 선택 |
| `KAKAO_CLIENT_ID/SECRET` | Kakao OAuth | 선택 |

---

## 8. 배포 시 CORS + Cookie 설정

### Cross-Origin (Vercel 배포)

```
앱: https://my-app.vercel.app
서버: https://my-app-api.vercel.app
```

- `CORS_ORIGINS`: 앱 + 서버 + admin URL 모두 포함
- `BETTER_AUTH_URL`: 서버 자체 URL
- Cookie: `sameSite: "none"`, `secure: true`
- Client fetch: `credentials: "include"`

### 같은 Origin (로컬)

- Cookie: `sameSite: "lax"`, secure 없음
- CORS 불필요

---

## 9. 파일 위치 요약

### Boilerplate (Source of Truth)

| 역할 | 파일 |
|------|------|
| Auth factory | `packages/core/auth/server/auth.ts` |
| Auth client | `packages/core/auth/client/auth-client.ts` |
| NestJS guards | `packages/core/nestjs/auth/better-auth.guard.ts`, `better-auth-admin.guard.ts` |
| CurrentUser | `packages/core/nestjs/auth/current-user.decorator.ts` |
| tRPC procedures | `packages/core/trpc/trpc.ts`, `admin-procedure.ts` |
| DB 스키마 | `packages/drizzle/src/schema/core/auth-tables.ts` |
| 서버 마운트 | `apps/server/src/main.ts` |

### Features (Stubs)

| 역할 | 파일 |
|------|------|
| Auth atoms/guards | `core/auth/src/index.ts` |
| tRPC procedures | `core/trpc/src/index.ts` |
