---
description: Boilerplate 서버 Vercel 배포 안정화 — NestJS serverless 호환성 수정 + 배포 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# boilerplate-stabilize: Boilerplate 서버 배포 안정화

## 목표

superbuilder-app-template의 서버(`apps/server`)를 Vercel serverless에 안정적으로 배포하고, 로그인이 성공하는 상태를 만든다.

## 배경

- Boilerplate는 NestJS + Fastify 기반 서버
- Vercel serverless에서 `api/index.ts`가 entry point
- **현재 문제**: NestJS full bootstrap이 Vercel cold start에서 504 timeout
- 이전에 잘 동작했으므로 최근 변경에서 regression이 있을 수 있음

## 사전 조건

```bash
# 환경변수 확인
echo "NEON: ${NEON_API_KEY:+SET}"
echo "VERCEL: ${VERCEL_TOKEN:+SET}"
gh auth status
```

## 작업 순서

### Phase 1: 현재 상태 진단

1. **boilerplate repo로 이동**
   ```bash
   cd /Users/bbright/Projects/superbuilder-app-template
   git log --oneline -20  # 최근 변경 확인
   ```

2. **서버 로컬 빌드 확인**
   ```bash
   cd apps/server
   pnpm run build  # nest build — webpack 번들 생성
   ls -la dist/main.js  # 번들 크기 확인
   ```

3. **서버 로컬 실행 확인**
   ```bash
   DATABASE_URL="..." BETTER_AUTH_SECRET="test" node dist/main.js
   # 또는
   pnpm run start:dev
   ```

4. **api/index.ts entry point 확인**
   - `import("../dist/main")` → `getApp()` 함수가 정상 export되는지
   - webpack `libraryTarget: "commonjs2"` 설정 확인
   - `reflect-metadata` import 확인

5. **vercel.json 확인**
   - `buildCommand`: nest build 실행되는지
   - `installCommand`: pnpm install 경로 맞는지
   - `outputDirectory`: serverless function에 dist/ 포함되는지
   - `functions.maxDuration`: 60초로 충분한지

### Phase 2: regression 분석

최근 변경사항 중 서버에 영향을 주는 것:
- `apps/server/api/index.ts` — Fastify inject() 방식으로 변경됨
- `apps/server/vercel.json` — buildCommand, outputDirectory 추가됨
- `apps/server/webpack.config.js` — libraryTarget 추가됨
- `packages/core/trpc/index.ts` — useTRPC 관련 변경
- `packages/drizzle/drizzle.config.ts` — schema 경로 변경
- feature 코드 전체 삭제 (빈 템플릿화)

**regression 체크리스트:**
- [ ] feature 삭제로 인해 서버 코드에서 참조 깨진 곳 없는지
- [ ] webpack config 변경으로 번들 사이즈가 비정상적으로 커지지 않았는지
- [ ] api/index.ts의 Fastify inject 방식이 better-auth 경로와 호환되는지
- [ ] app.module.ts에서 빈 마커 블록이 NestJS 초기화에 영향 주지 않는지

### Phase 3: 수정 + 로컬 검증

문제를 찾으면:
1. 수정
2. 로컬에서 `nest build` 확인
3. 로컬에서 서버 실행 + 로그인 API 테스트:
   ```bash
   curl -X POST http://localhost:3002/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@superbuilder.app","password":"changeme!!"}'
   ```

### Phase 4: Vercel 배포 + 로그인 검증

1. **GitHub repo 생성 + push**
   ```bash
   # boilerplate를 새 repo에 push
   gh repo create BBrightcode-atlas/boilerplate-stable-test --private --source . --push
   ```

2. **Neon DB 생성**
   - composePipeline의 createNeonProject 사용하거나 수동
   ```bash
   curl -X POST "https://console.neon.tech/api/v2/projects" \
     -H "Authorization: Bearer $NEON_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"project":{"name":"boilerplate-stable-test"}}'
   ```

3. **Vercel 프로젝트 생성**
   - 서버: `apps/server`, framework: null
   - 환경변수: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, CORS_ORIGINS

4. **배포 대기 + 로그인 테스트**
   ```bash
   curl -X POST "https://boilerplate-stable-test-api.vercel.app/api/auth/sign-in/email" \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@superbuilder.app","password":"changeme!!"}'
   ```

5. **실패 시**: Vercel 런타임 로그 확인 → 수정 → 재배포

### Phase 5: Ralph-Loop (5회 반복 검증)

통과할 때까지:
1. `pnpm run build` — 빌드 성공
2. `pnpm run typecheck` — 타입 에러 없음
3. Vercel 배포 READY
4. 서버 health check (`GET /api`) — 200 응답
5. 로그인 API — 200 + session token
6. 실패 항목 수정 → 재실행

### Phase 6: 안정화 완료

모든 검증 통과 후:
1. 테스트 리소스 정리 (Neon, Vercel, GitHub)
2. boilerplate에 커밋/push
3. 안정화 결과 문서화

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `apps/server/api/index.ts` | Vercel serverless entry point |
| `apps/server/src/main.ts` | NestJS bootstrap (getApp export) |
| `apps/server/webpack.config.js` | 번들 설정 (workspace 패키지 인라인) |
| `apps/server/vercel.json` | Vercel 빌드/배포 설정 |
| `packages/core/auth/server/auth.ts` | better-auth 인스턴스 |
| `packages/drizzle/src/database.module.ts` | NestJS DB 모듈 |

## 디버깅 팁

- **504 Timeout**: cold start가 60초 초과 → maxDuration 늘리거나 bootstrap 최적화
- **500 getApp not found**: webpack libraryTarget 확인, CJS/ESM interop
- **500 Cannot find module**: workspace 패키지 해석 문제 → webpack alias 확인
- **500 reflect-metadata**: api/index.ts 상단에 `import "reflect-metadata"` 필수
- **CORS 에러**: CORS_ORIGINS 환경변수에 앱 URL 추가 필요

## 참고 문서

- Composer 파이프라인: `docs/architecture/subsystems/composer-scaffold-pipeline.md`
- 서버 아키텍처: `docs/architecture/apps/server.md` (있으면)
- Vercel serverless: `apps/server/vercel.json`
