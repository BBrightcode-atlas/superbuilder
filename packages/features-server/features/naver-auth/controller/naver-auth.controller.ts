/**
 * Naver Auth Feature - Controller
 *
 * Naver OAuth 2.0 인증 플로우를 위한 REST Controller.
 * - GET /api/auth/naver/authorize : 네이버 로그인 페이지로 리다이렉트
 * - GET /api/auth/naver/callback  : OAuth 콜백 처리 후 세션 쿠키 설정 + 프론트엔드 리다이렉트
 */

import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import type { FastifyRequest, FastifyReply } from "fastify";
import { NaverAuthService } from "../service/naver-auth.service";

@ApiTags("Naver Auth")
@Controller("auth/naver")
export class NaverAuthController {
  constructor(private readonly naverAuthService: NaverAuthService) {}

  @Get("authorize")
  @ApiOperation({ summary: "네이버 OAuth 인증 시작" })
  @ApiQuery({
    name: "redirect_to",
    required: true,
    description: "로그인 완료 후 리다이렉트할 프론트엔드 URL",
    example: "http://localhost:3000",
  })
  @ApiResponse({ status: 302, description: "네이버 로그인 페이지로 리다이렉트" })
  authorize(
    @Query("redirect_to") redirectTo: string,
    @Res() reply: FastifyReply,
  ) {
    const url = this.naverAuthService.getAuthorizationUrl(redirectTo);
    void reply.status(302).redirect(url);
  }

  @Get("callback")
  @ApiOperation({ summary: "네이버 OAuth 콜백 처리" })
  @ApiQuery({
    name: "code",
    required: true,
    description: "네이버에서 전달받은 authorization code",
  })
  @ApiQuery({
    name: "state",
    required: true,
    description: "CSRF 방지 및 redirect_to 정보를 담은 state 파라미터",
  })
  @ApiResponse({ status: 302, description: "세션 쿠키 설정 후 프론트엔드로 리다이렉트" })
  @ApiResponse({ status: 401, description: "인증 실패" })
  @ApiResponse({ status: 500, description: "서버 오류" })
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const { redirectUrl, sessionToken, sessionExpiresAt } =
      await this.naverAuthService.handleCallback(code, state, ipAddress, userAgent);

    // Better Auth 세션 쿠키 설정 (raw Set-Cookie 헤더)
    // Better Auth는 "better-auth.session_token" 쿠키명을 사용
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookieValue = [
      `better-auth.session_token=${sessionToken}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Expires=${sessionExpiresAt.toUTCString()}`,
      secure,
    ].filter(Boolean).join("; ");

    void reply
      .header("Set-Cookie", cookieValue)
      .status(302)
      .redirect(redirectUrl);
  }
}
