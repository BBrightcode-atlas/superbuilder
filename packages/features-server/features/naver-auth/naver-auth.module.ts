/**
 * Naver Auth Feature - NestJS Module
 *
 * Naver OAuth 2.0 서버사이드 인증 처리 모듈.
 * Better Auth DB 테이블을 통해 사용자 생성/세션 관리.
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DrizzleModule } from "@superbuilder/features-db";
import { NaverAuthController } from "./controller/naver-auth.controller";
import { NaverAuthService } from "./service/naver-auth.service";

@Module({
  imports: [ConfigModule, DrizzleModule],
  controllers: [NaverAuthController],
  providers: [NaverAuthService],
  exports: [NaverAuthService],
})
export class NaverAuthModule {}
