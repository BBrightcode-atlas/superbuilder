import { atlasIntegrations, atlasProjects } from "@superset/local-db";
import { eq } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { decrypt, encrypt } from "../auth/utils/crypto-storage";

// NOTE: 공통 로직은 @superbuilder/atlas-engine/pipeline의 deployToVercel()로 추출됨.
// Desktop UI 전용 tRPC procedure들은 localDb 연동이 필요하므로 여기 유지.

const VERCEL_API = "https://api.vercel.com";

async function getVercelToken(): Promise<string> {
	// env 우선, DB fallback
	const envToken = process.env.VERCEL_TOKEN;
	if (envToken) return envToken;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, "vercel"));
	if (!integration) throw new Error("Vercel token not configured");
	return decrypt(integration.encryptedToken);
}

async function vercelFetch(path: string, options: RequestInit = {}) {
	const token = await getVercelToken();
	const res = await fetch(`${VERCEL_API}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Vercel API error (${res.status}): ${body}`);
	}
	return res.json();
}

export const createAtlasVercelRouter = () =>
	router({
		saveToken: publicProcedure
			.input(z.object({ token: z.string().min(1) }))
			.mutation(async ({ input }) => {
				// Verify token works
				try {
					const res = await fetch(`${VERCEL_API}/v2/user`, {
						headers: { Authorization: `Bearer ${input.token}` },
					});
					if (!res.ok) throw new Error("Invalid token");
				} catch {
					throw new Error("토큰 검증 실패: Vercel에 연결할 수 없습니다");
				}

				const encrypted = encrypt(input.token);

				// Upsert: delete existing then insert
				await localDb
					.delete(atlasIntegrations)
					.where(eq(atlasIntegrations.service, "vercel"));

				await localDb.insert(atlasIntegrations).values({
					service: "vercel",
					encryptedToken: encrypted,
				});

				return { success: true };
			}),

		removeToken: publicProcedure.mutation(async () => {
			await localDb
				.delete(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "vercel"));
			return { success: true };
		}),

		getConnectionStatus: publicProcedure.query(async () => {
			if (process.env.VERCEL_TOKEN) return { connected: true };
			const [integration] = await localDb
				.select()
				.from(atlasIntegrations)
				.where(eq(atlasIntegrations.service, "vercel"));
			return { connected: !!integration };
		}),

		listTeams: publicProcedure.query(async () => {
			const data = await vercelFetch("/v2/teams");
			return (data.teams ?? []) as Array<{
				id: string;
				name: string;
				slug: string;
			}>;
		}),

		createProject: publicProcedure
			.input(
				z.object({
					name: z.string().min(1),
					teamId: z.string().optional(),
					framework: z.string().nullable().default("vite"),
					atlasProjectId: z.string().min(1),
					gitOwner: z.string().optional(),
					gitRepo: z.string().optional(),
					rootDirectory: z.string().optional(),
					skipLocalDbUpdate: z.boolean().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";

				const body: Record<string, unknown> = {
					name: input.name,
					framework: input.framework,
				};

				if (input.rootDirectory) {
					body.rootDirectory = input.rootDirectory;
				}

				// Git 연동: 생성 시 gitRepository 포함하면 자동 연결
				if (input.gitOwner && input.gitRepo) {
					body.gitRepository = {
						type: "github",
						repo: `${input.gitOwner}/${input.gitRepo}`,
					};
				}

				let project: Record<string, unknown>;
				let gitLinked = false;

				try {
					project = await vercelFetch(`/v10/projects${queryParams}`, {
						method: "POST",
						body: JSON.stringify(body),
					});
					gitLinked = !!(input.gitOwner && input.gitRepo);
				} catch (err) {
					// Fallback: GitHub integration이 없으면 git 연동 없이 프로젝트만 생성
					const errMsg = err instanceof Error ? err.message : "";
					if (
						input.gitOwner &&
						input.gitRepo &&
						errMsg.includes("install the GitHub integration")
					) {
						const fallbackBody: Record<string, unknown> = {
							name: input.name,
							framework: input.framework,
						};
						if (input.rootDirectory) {
							fallbackBody.rootDirectory = input.rootDirectory;
						}
						project = await vercelFetch(`/v10/projects${queryParams}`, {
							method: "POST",
							body: JSON.stringify(fallbackBody),
						});
						gitLinked = false;
					} else {
						throw err;
					}
				}

				// 실제 alias 기반 URL 사용 (Vercel이 이름 충돌 시 suffix 추가)
				const aliases = (project.alias ?? []) as string[];
				const actualUrl =
					aliases.length > 0
						? `https://${aliases[0]}`
						: `https://${(project as { name: string }).name}.vercel.app`;

				// Update atlas_projects with Vercel info (skip for secondary projects like API)
				if (!input.skipLocalDbUpdate) {
					await localDb
						.update(atlasProjects)
						.set({
							vercelProjectId: project.id as string,
							vercelUrl: actualUrl,
							updatedAt: Date.now(),
						})
						.where(eq(atlasProjects.id, input.atlasProjectId));
				}

				return {
					id: project.id as string,
					name: (project as { name: string }).name,
					url: actualUrl,
					gitLinked,
				};
			}),

		setEnvVars: publicProcedure
			.input(
				z.object({
					projectId: z.string().min(1),
					teamId: z.string().optional(),
					envVars: z.array(
						z.object({
							key: z.string(),
							value: z.string(),
							target: z
								.array(z.enum(["production", "preview", "development"]))
								.default(["production", "preview", "development"]),
							type: z
								.enum(["encrypted", "plain", "sensitive"])
								.default("encrypted"),
						}),
					),
				}),
			)
			.mutation(async ({ input }) => {
				const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";

				// Vercel API: POST /v10/projects/{projectId}/env
				const results = [];
				for (const envVar of input.envVars) {
					try {
						await vercelFetch(
							`/v10/projects/${input.projectId}/env${queryParams}`,
							{
								method: "POST",
								body: JSON.stringify({
									key: envVar.key,
									value: envVar.value,
									target: envVar.target,
									type: envVar.type,
								}),
							},
						);
						results.push({ key: envVar.key, success: true });
					} catch (err) {
						const errMsg = err instanceof Error ? err.message : String(err);
						// If already exists, try to update
						if (errMsg.includes("already exists")) {
							try {
								await vercelFetch(
									`/v9/projects/${input.projectId}/env${queryParams}`,
									{
										method: "PATCH",
										body: JSON.stringify({
											key: envVar.key,
											value: envVar.value,
											target: envVar.target,
											type: envVar.type,
										}),
									},
								);
								results.push({ key: envVar.key, success: true });
							} catch {
								results.push({
									key: envVar.key,
									success: false,
									error: errMsg,
								});
							}
						} else {
							results.push({ key: envVar.key, success: false, error: errMsg });
						}
					}
				}

				return { results };
			}),

		connectGitRepo: publicProcedure
			.input(
				z.object({
					projectId: z.string().min(1),
					owner: z.string().min(1),
					repo: z.string().min(1),
					teamId: z.string().optional(),
					atlasProjectId: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";

				// PATCH project to link GitHub repo
				await vercelFetch(`/v9/projects/${input.projectId}${queryParams}`, {
					method: "PATCH",
					body: JSON.stringify({
						link: {
							type: "github",
							repo: `${input.owner}/${input.repo}`,
							productionBranch: "main",
						},
					}),
				});

				// Git 연결 후 프로젝트 정보 다시 조회해서 실제 도메인 확인
				const project = await vercelFetch(
					`/v9/projects/${input.projectId}${queryParams}`,
				);

				// 실제 production alias 또는 프로젝트 도메인 추출
				const aliases: string[] = project.alias ?? [];
				const actualUrl =
					aliases.length > 0
						? `https://${aliases[0]}`
						: `https://${project.name}.vercel.app`;

				// DB 업데이트 (실제 URL로)
				if (input.atlasProjectId) {
					await localDb
						.update(atlasProjects)
						.set({
							vercelUrl: actualUrl,
							updatedAt: Date.now(),
						})
						.where(eq(atlasProjects.id, input.atlasProjectId));
				}

				return {
					linked: true,
					repo: `${input.owner}/${input.repo}`,
					url: actualUrl,
				};
			}),

		generateDomain: publicProcedure
			.input(
				z.object({
					projectId: z.string().min(1),
					domain: z.string().min(1),
					teamId: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";
				await vercelFetch(
					`/v10/projects/${input.projectId}/domains${queryParams}`,
					{
						method: "POST",
						body: JSON.stringify({ name: input.domain }),
					},
				);
				return { domain: input.domain };
			}),

		getDeployment: publicProcedure
			.input(
				z.object({
					deploymentId: z.string().min(1),
				}),
			)
			.query(async ({ input }) => {
				const deployment = await vercelFetch(
					`/v13/deployments/${input.deploymentId}`,
				);
				return {
					id: deployment.uid,
					url: deployment.url,
					readyState: deployment.readyState as string,
					state: deployment.state as string,
				};
			}),

		deploy: publicProcedure
			.input(
				z.object({
					projectId: z.string().min(1),
					projectName: z.string().min(1),
					teamId: z.string().optional(),
					atlasProjectId: z.string().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";

				// Create deployment with project link
				const deployment = await vercelFetch(`/v13/deployments${queryParams}`, {
					method: "POST",
					body: JSON.stringify({
						name: input.projectName,
						project: input.projectId,
						target: "production",
						projectSettings: {
							framework: "vite",
						},
					}),
				});

				// Update atlas_projects with deployment info (keep status as-is until waitForReady confirms)
				await localDb
					.update(atlasProjects)
					.set({
						vercelDeploymentId: deployment.id,
						vercelUrl: `https://${deployment.url}`,
						updatedAt: Date.now(),
					})
					.where(eq(atlasProjects.id, input.atlasProjectId));

				return {
					id: deployment.id,
					url: `https://${deployment.url}`,
					readyState: deployment.readyState as string,
				};
			}),

		waitForReady: publicProcedure
			.input(
				z.object({
					deploymentId: z.string().min(1),
					atlasProjectId: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const maxAttempts = 60;
				const interval = 3000;

				for (let i = 0; i < maxAttempts; i++) {
					try {
						const deployment = await vercelFetch(
							`/v13/deployments/${input.deploymentId}`,
						);
						if (deployment.readyState === "READY") {
							if (input.atlasProjectId) {
								await localDb
									.update(atlasProjects)
									.set({ status: "deployed", updatedAt: Date.now() })
									.where(eq(atlasProjects.id, input.atlasProjectId));
							}
							return {
								ready: true,
								url: `https://${deployment.url}`,
								attempts: i + 1,
							};
						}
						if (
							deployment.readyState === "ERROR" ||
							deployment.readyState === "CANCELED"
						) {
							if (input.atlasProjectId) {
								await localDb
									.update(atlasProjects)
									.set({ status: "error", updatedAt: Date.now() })
									.where(eq(atlasProjects.id, input.atlasProjectId));
							}
							return {
								ready: false,
								url: null,
								attempts: i + 1,
								error: `Deployment ${deployment.readyState}`,
							};
						}
					} catch {
						// Might not be ready yet
					}
					await new Promise((r) => setTimeout(r, interval));
				}
				return {
					ready: false,
					url: null,
					attempts: maxAttempts,
					error: "Deployment timeout",
				};
			}),
	});
