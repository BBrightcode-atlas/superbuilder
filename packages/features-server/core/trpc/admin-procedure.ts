/**
 * Admin Procedure for tRPC
 *
 * 인증 + admin/owner 역할 확인 미들웨어
 * Better Auth members 테이블의 role 필드를 사용
 */
import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { baMembers } from "@superbuilder/features-db";
import { middleware, authProcedure } from "./trpc";

const ADMIN_ROLES = ["owner", "admin"];

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "인증이 필요합니다." });
  }

  let hasAdminRole = false;

  try {
    const result = await ctx.db
      .select({ role: baMembers.role })
      .from(baMembers)
      .where(
        and(
          eq(baMembers.userId, ctx.user.id),
          sql`${baMembers.role} = ANY(${ADMIN_ROLES})`,
        ),
      )
      .limit(1);

    hasAdminRole = result.length > 0;
  } catch {
    // members 테이블 미생성 시 안전하게 거부
    hasAdminRole = false;
  }

  if (!hasAdminRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = authProcedure.use(isAdmin);
