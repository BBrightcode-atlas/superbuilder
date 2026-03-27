import type { FeatureManifest } from "../manifest/types";

export interface ClaudeMdContext {
	projectName: string;
	features: FeatureManifest[];
	urls?: {
		api?: string;
		app?: string;
		admin?: string;
		landing?: string;
	};
}

export function generateClaudeMd(ctx: ClaudeMdContext): string {
	const featureRows = ctx.features
		.map((f) => {
			const type = f.type;
			const api = f.provides.server?.router ?? "-";
			const tables =
				f.provides.schema?.tables.join(", ") || "-";
			return `| ${f.id} | ${type} | ${api} | ${tables} |`;
		})
		.join("\n");

	const featureTable =
		ctx.features.length > 0
			? `| Feature | 타입 | 주요 API | 스키마 테이블 |
|---------|------|---------|-------------|
${featureRows}`
			: "_설치된 feature 없음_";

	const urls = ctx.urls;
	const envSection = urls
		? `## 환경
- API: ${urls.api ?? "N/A"}
- App: ${urls.app ?? "N/A"}
- Admin: ${urls.admin ?? "N/A"}
- Landing: ${urls.landing ?? "N/A"}`
		: "";

	return `# ${ctx.projectName}

## 기술 스택
- Runtime: Bun
- Framework: NestJS (server) + React + Vite (client)
- DB: Drizzle ORM + Neon PostgreSQL
- Auth: Better Auth
- UI: shadcn/ui + TailwindCSS v4
- Code Quality: Biome (formatting + linting)

## 설치된 Feature
${featureTable}

## 프로젝트 구조
\`\`\`
apps/app/         ← Vite 클라이언트 (SPA)
apps/admin/       ← 관리자 (Vite)
apps/server/      ← NestJS API
apps/landing/     ← Next.js 랜딩
packages/core/    ← 인프라 (auth, trpc, i18n)
packages/drizzle/ ← DB 스키마
packages/features/ ← Feature 서버 코드
packages/widgets/ ← 임베디드 위젯
\`\`\`

## 비즈니스 Feature 추가 시
1. \`docs/specs/\` 에 스펙 문서 배치
2. \`.claude/rules/\` 의 규칙을 따라 구현
3. 상세 규칙은 AGENTS.md 참조

${envSection}

@AGENTS.md
`;
}
