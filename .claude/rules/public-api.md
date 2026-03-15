---
description: "Public API 스펙 — 익명/비인증 API 지원 가이드"
globs: "packages/atlas-engine/**/*.ts"
alwaysApply: false
---

# Public API 스펙

## 개요

Scaffold된 프로젝트는 3가지 접근 수준의 API를 지원한다:

| 접근 수준 | tRPC | REST | 용도 | 사용처 |
|----------|------|------|------|--------|
| **Public (익명)** | `publicProcedure` | Guard 없음 | 예약 조회, 공개 목록 | Landing, 외부 위젯 |
| **Protected (로그인)** | `protectedProcedure` | `@UseGuards(BetterAuthGuard)` | 내 데이터, 프로필 | App (SPA) |
| **Admin (관리자)** | `adminProcedure` | `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)` | 시스템 관리 | Admin |

## Feature 작성 시 Procedure 선택 기준

| 질문 | Public | Protected | Admin |
|------|:------:|:---------:|:-----:|
| 로그인 없이 볼 수 있어야 하는가? | ✓ | | |
| 익명 사용자가 데이터를 생성할 수 있는가? | ✓ | | |
| 사용자 본인의 데이터만 접근하는가? | | ✓ | |
| 시스템 전체 데이터를 관리하는가? | | | ✓ |

## Landing 연동 패턴

Landing (Next.js)에서 서버 API를 호출하는 2가지 방식:

### 1. RSC `fetch` (번들 0KB) — 읽기 전용

```typescript
// Next.js Server Component — 서버에서 직접 fetch
async function BookingStatus() {
  const res = await fetch(`${process.env.API_URL}/api/booking/available?date=2026-03-15`);
  const slots = await res.json();
  return <SlotGrid slots={slots} />;
}
```

### 2. tRPC vanilla client (~8KB) — 클라이언트 인터랙션

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@repo/features/app-router";

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${API_URL}/trpc` })],
});

// 타입 자동 완성 + 인증 불필요
const slots = await trpc.booking.getAvailable.query({ date: "2026-03-15" });
```

## Scaffold 시 CORS 설정

Composer pipeline에서 Vercel 배포 시 `CORS_ORIGINS`에 **landing URL도 포함** 필수:

```
CORS_ORIGINS=https://app.example.com,https://admin.example.com,https://www.example.com
```

## Feature Router 예시 (Public + Protected 혼합)

```typescript
export const bookingRouter = router({
  // Public — 누구나 조회
  getAvailable: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(({ input }) => bookingService.getAvailable(input.date)),

  // Public — 익명 예약 등록 (이름/연락처만)
  createAnonymous: publicProcedure
    .input(z.object({ name: z.string(), phone: z.string(), slot: z.string() }))
    .mutation(({ input }) => bookingService.createAnonymous(input)),

  // Protected — 로그인한 사용자의 예약 목록
  myBookings: protectedProcedure
    .query(({ ctx }) => bookingService.findByUser(ctx.user.id)),

  // Admin — 전체 예약 관리
  adminList: adminProcedure
    .query(() => bookingService.findAll()),
});
```
