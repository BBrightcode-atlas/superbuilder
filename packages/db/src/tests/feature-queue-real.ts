/**
 * 실제 feature 3건을 큐에 등록하는 스크립트
 */
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import {
	featureQueueBatches,
	featureQueueItems,
} from "../schema/feature-studio";

async function getTestIds() {
	const org = await db.query.organizations.findFirst();
	const user = await db.query.users.findFirst();
	if (!org || !user) throw new Error("No org/user in DB");
	return { orgId: org.id, userId: user.id };
}

async function main() {
	const { orgId, userId } = await getTestIds();

	const items = [
		{
			rawPrompt: "카카오톡 '나에게 보내기' 기능. 사용자가 텍스트를 카카오톡 나에게 보내기 API로 전송하는 feature. REST API로 카카오 나에게 보내기 API를 래핑하고, tRPC router로 노출. 카카오 액세스 토큰은 환경변수로 관리.",
			title: "kakao-me",
			estimatedComplexity: "light" as const,
		},
		{
			rawPrompt: "Slack Incoming Webhook 연동 feature. 특정 이벤트 발생 시 Slack webhook URL로 메시지를 보내는 서비스. webhook URL은 환경변수로 관리. tRPC router로 수동 전송 + 이벤트 기반 자동 전송 지원.",
			title: "slack-webhook",
			estimatedComplexity: "light" as const,
		},
		{
			rawPrompt: "카카오 OAuth 소셜 로그인. Better Auth의 social provider를 사용하여 카카오 로그인을 구현. 카카오 REST API 키, 시크릿을 환경변수로 관리. 로그인 버튼 UI 컴포넌트 포함.",
			title: "kakao-login",
			estimatedComplexity: "medium" as const,
		},
	];

	const allLight = items.every((i) => i.estimatedComplexity === "light");
	const concurrencyLimit = allLight ? items.length : 1;

	const [batch] = await db
		.insert(featureQueueBatches)
		.values({
			organizationId: orgId,
			createdById: userId,
			title: "카카오/슬랙 연동 3종",
			concurrencyLimit,
			totalItems: items.length,
		})
		.returning();

	const createdItems = await db
		.insert(featureQueueItems)
		.values(
			items.map((item, idx) => ({
				batchId: batch!.id,
				position: idx + 1,
				rawPrompt: item.rawPrompt,
				title: item.title,
				estimatedComplexity: item.estimatedComplexity,
			})),
		)
		.returning();

	console.log(`\n📦 배치 생성 완료`);
	console.log(`   ID: ${batch!.id}`);
	console.log(`   concurrency: ${concurrencyLimit}`);
	console.log(`   아이템:`);
	for (const item of createdItems) {
		console.log(`     [${item.position}] ${item.title} (${item.estimatedComplexity}) - ${item.id}`);
	}
	console.log(`\n배치 ID를 복사하여 큐 처리에 사용하세요.`);

	process.exit(0);
}

main().catch(console.error);
