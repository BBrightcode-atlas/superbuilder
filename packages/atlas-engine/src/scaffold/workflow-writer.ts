import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureEntry, FeatureRegistry } from "../registry/types";
import { IMPORT_ALIAS_MAP } from "./path-mapping";

export interface WorkflowWriterInput {
	resolvedFeatureNames: string[];
	featureRegistry: FeatureRegistry;
	sourceRepo: string;
}

export function generateWorkflowMarkdown(opts: WorkflowWriterInput): string {
	const { resolvedFeatureNames, featureRegistry, sourceRepo } = opts;
	const features = resolvedFeatureNames.map((name) => ({
		name,
		entry: featureRegistry.features[name],
	}));

	let md = "";

	// Header
	md += "# Feature 설치 워크플로우\n\n";
	md += "이 프로젝트는 superbuilder에서 생성되었습니다.\n";
	md += "아래 단계를 순서대로 실행하여 features를 설치하세요.\n\n";

	// Prerequisites
	md += "## 사전 조건\n\n";
	md += `- superbuilder 소스 경로: \`${sourceRepo}\`\n`;
	md += "- 이 프로젝트의 `superbuilder.json`을 참조하세요\n\n";

	// Feature list
	md += "## 설치할 Features (토폴로지 순서)\n\n";
	for (const [i, f] of features.entries()) {
		const deps = f.entry?.dependencies ?? [];
		md += `${i + 1}. **${f.name}** (${f.entry?.type ?? "page"}`;
		if (deps.length > 0) md += `, depends: ${deps.join(", ")}`;
		md += ")\n";
	}
	md += "\n";

	// Common steps
	md += generateCommonSteps(sourceRepo);

	// Import alias mapping
	md += generateImportMappingSection();

	// Per-feature details
	md += "## Feature별 상세 정보\n\n";
	for (const f of features) {
		if (f.entry) {
			md += generateFeatureDetail(f.name, f.entry);
		}
	}

	// Completion
	md += generateCompletionSteps();

	return md;
}

function generateCommonSteps(sourceRepo: string): string {
	return `## 각 Feature 설치 절차

### Feature마다 반복:

#### Step 1: Server 코드 복사
소스에서 타겟으로 디렉토리 복사:
\`\`\`
{sourceRepo}/packages/features-server/features/{name}/
→ ./packages/features/{name}/
\`\`\`
(sourceRepo = \`${sourceRepo}\`)

#### Step 2: Client 코드 복사 (Page feature인 경우)
\`\`\`
{sourceRepo}/apps/features-app/src/features/{name}/
→ ./apps/app/src/features/{name}/
\`\`\`

#### Step 3: Admin 코드 복사 (Admin이 있는 경우)
\`\`\`
{sourceRepo}/apps/feature-admin/src/features/{name}/
→ ./apps/feature-admin/src/features/{name}/
\`\`\`

#### Step 4: Schema 복사
\`\`\`
{sourceRepo}/packages/drizzle/src/schema/features/{name}/
→ ./packages/drizzle/src/schema/features/{name}/
\`\`\`

#### Step 5: Widget 복사 (Widget feature인 경우)
\`\`\`
{sourceRepo}/packages/widgets/src/{name}/
→ ./packages/widgets/src/{name}/
\`\`\`

#### Step 6: Connection 파일 수정 (Marker 기반)

각 파일의 \`[ATLAS:*]\` marker 위치에 삽입:

**Schema Index** (\`packages/drizzle/src/schema/index.ts\`):
\`\`\`typescript
// [ATLAS:SCHEMAS]
export * from "./features/{name}";
// [/ATLAS:SCHEMAS]
\`\`\`

**App Module** (\`apps/atlas-server/src/app.module.ts\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { {ModuleName} } from "@repo/features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:MODULES]
{ModuleName},
// [/ATLAS:MODULES]
\`\`\`

**tRPC Router** (\`apps/atlas-server/src/trpc/router.ts\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { {routerName} } from "@repo/features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:ROUTERS]
{name}: {routerName},
// [/ATLAS:ROUTERS]
\`\`\`

**Client Router** (\`apps/app/src/router.tsx\`):
\`\`\`typescript
// [ATLAS:IMPORTS]
import { create{Name}Routes } from "@features/{name}";
// [/ATLAS:IMPORTS]

// [ATLAS:ROUTES]
...create{Name}Routes(rootRoute),
// [/ATLAS:ROUTES]
\`\`\`

**Drizzle Config** (\`drizzle.config.ts\`):
\`\`\`typescript
// [ATLAS:TABLES]
"{table_name}",
// [/ATLAS:TABLES]
\`\`\`

#### Step 7: superbuilder.json 업데이트
installed 섹션에 추가:
\`\`\`json
"{name}": { "version": "1.0.0", "installedAt": "현재시간", "status": "installed" }
\`\`\`

`;
}

function generateImportMappingSection(): string {
	let md = "## Import 경로 변환 규칙\n\n";
	md += "복사한 파일 내부의 import를 아래 규칙에 따라 변환하세요:\n\n";
	md += "| 기존 (superbuilder) | 변환 (이 프로젝트) |\n";
	md += "|---|---|\n";
	for (const [from, to] of Object.entries(IMPORT_ALIAS_MAP)) {
		md += `| \`${from}\` | \`${to}\` |\n`;
	}
	md += "\n";
	return md;
}

function generateFeatureDetail(name: string, entry: FeatureEntry): string {
	let md = `### ${name}\n`;
	md += `- type: ${entry.type}\n`;
	md += `- router key: ${entry.router.key}\n`;
	md += `- router import: ${entry.router.import}\n`;
	md += `- router from: ${entry.router.from}\n`;
	if (entry.schema.tables.length > 0) {
		md += `- tables: [${entry.schema.tables.join(", ")}]\n`;
	}
	if (entry.dependencies.length > 0) {
		md += `- dependencies: [${entry.dependencies.join(", ")}]\n`;
	}
	if (entry.admin?.showInSidebar) {
		md += `- admin: sidebar=${entry.admin.showInSidebar}, path=${entry.admin.path ?? "N/A"}\n`;
	}
	md += "\n";
	return md;
}

function generateCompletionSteps(): string {
	return `## 완료 후

1. \`bun install\` 실행
2. \`bun run typecheck\` 로 빌드 검증
3. 에러 있으면 수정
4. \`git add -A && git commit -m "feat: install features"\`
`;
}

export async function writeInstallWorkflow(
	projectDir: string,
	opts: WorkflowWriterInput,
): Promise<void> {
	const md = generateWorkflowMarkdown(opts);

	// .claude/commands/
	const claudeDir = join(projectDir, ".claude", "commands");
	await mkdir(claudeDir, { recursive: true });
	await writeFile(join(claudeDir, "install-features.md"), md, "utf-8");

	// .agents/commands/
	const agentsDir = join(projectDir, ".agents", "commands");
	await mkdir(agentsDir, { recursive: true });
	await writeFile(join(agentsDir, "install-features.md"), md, "utf-8");
}
