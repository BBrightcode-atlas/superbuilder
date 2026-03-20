import type { AgentLaunchRequest } from "@superset/shared/agent-launch";
import { Button } from "@superset/ui/button";
import { Spinner } from "@superset/ui/spinner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { launchAgentSession } from "renderer/lib/agent-session-orchestrator";
import { authClient } from "renderer/lib/auth-client";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useCreateWorkspace } from "renderer/react-query/workspaces";
import { ComposerStepper } from "renderer/screens/atlas/components/ComposerStepper";
import { FeatureSelector } from "renderer/screens/atlas/components/FeatureSelector";
import { NeonSetup } from "renderer/screens/atlas/components/NeonSetup";
import {
	PipelineProgress,
	type PipelineStepStatus,
} from "renderer/screens/atlas/components/PipelineProgress";
import { ProjectConfig } from "renderer/screens/atlas/components/ProjectConfig";
import { ResolutionPreview } from "renderer/screens/atlas/components/ResolutionPreview";
import { VercelSetup } from "renderer/screens/atlas/components/VercelSetup";
import { useAtlasComposerStore } from "renderer/stores/atlas-state";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/atlas/composer/",
)({
	component: ComposerPage,
});

interface PipelineState {
	active: boolean;
	steps: Array<{
		label: string;
		status: PipelineStepStatus;
		message?: string;
	}>;
	result: {
		projectId: string;
		projectDir: string;
		features: string[];
		gitInitialized: boolean;
		gitHubOwner?: string;
		gitHubRepo?: string;
		neonConnectionUri?: string;
	} | null;
}

const INITIAL_PIPELINE: PipelineState = {
	active: false,
	steps: [
		{ label: "프로젝트 스캐폴드", status: "pending" },
		{ label: "GitHub Push", status: "pending" },
		{ label: "Feature 설치", status: "pending" },
		{ label: "Neon 프로젝트", status: "pending" },
		{ label: "Vercel 배포", status: "pending" },
	],
	result: null,
};

function ComposerPage() {
	const {
		step,
		setStep,
		selectedFeatures,
		toggleFeature,
		projectName,
		setProjectName,
		targetPath,
		setTargetPath,
		reset,
	} = useAtlasComposerStore();

	const navigate = useNavigate();
	const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
	const [agentPhase, setAgentPhase] = useState<"idle" | "ready" | "launched">(
		"idle",
	);
	const [neonPhase, setNeonPhase] = useState<
		"idle" | "setup" | "creating" | "done" | "skipped"
	>("idle");
	const [vercelPhase, setVercelPhase] = useState<
		"idle" | "setup" | "creating" | "done" | "skipped"
	>("idle");
	const [agentLaunching, setAgentLaunching] = useState(false);

	// BETTER_AUTH_SECRET — generated once per compose session
	const [betterAuthSecret] = useState(
		() => crypto.randomUUID() + crypto.randomUUID(),
	);

	// Owner password — random per compose session
	const [ownerPassword] = useState(() => crypto.randomUUID().slice(0, 12));

	const { data: registryData, isLoading: registryLoading } =
		electronTrpc.atlas.registry.getRegistry.useQuery();

	const { data: resolution } = electronTrpc.atlas.resolver.resolve.useQuery(
		{ selected: selectedFeatures },
		{ enabled: selectedFeatures.length > 0 },
	);

	const composeMutation = electronTrpc.atlas.composer.compose.useMutation();
	const pushToGitHubMutation =
		electronTrpc.atlas.composer.pushToGitHub.useMutation();
	const openFromPathMutation = electronTrpc.projects.openFromPath.useMutation();
	const createWorkspace = useCreateWorkspace({ skipNavigation: true });
	const terminalCreateOrAttach =
		electronTrpc.terminal.createOrAttach.useMutation();
	const terminalWrite = electronTrpc.terminal.write.useMutation();
	const neonCreateMutation =
		electronTrpc.atlas.neon.createProject.useMutation();
	const neonWriteEnvMutation =
		electronTrpc.atlas.neon.writeEnvFile.useMutation();
	const neonRunMigrationMutation =
		electronTrpc.atlas.neon.runMigration.useMutation();
	const vercelCreateMutation =
		electronTrpc.atlas.vercel.createProject.useMutation();
	const vercelSetEnvVarsMutation =
		electronTrpc.atlas.vercel.setEnvVars.useMutation();
	const vercelConnectGitMutation =
		electronTrpc.atlas.vercel.connectGitRepo.useMutation();
	const neonSeedOwnerMutation = electronTrpc.atlas.neon.seedOwner.useMutation();

	const { data: session } = authClient.useSession();

	if (registryLoading || !registryData) {
		return (
			<div className="flex items-center justify-center h-full">
				<Spinner className="size-5" />
			</div>
		);
	}

	const { registry } = registryData;
	const canProceedToStep1 = selectedFeatures.length > 0;
	const canCompose =
		projectName.trim() &&
		targetPath.trim() &&
		!!resolution &&
		!composeMutation.isPending;

	// 외부 서비스(GitHub, Neon, Vercel)에 사용할 고유 이름
	const slug = projectName.trim().toLowerCase();
	const shortHash = Date.now().toString(36).slice(-4);
	const serviceName = slug
		? `sb-gen-${slug}-${shortHash}`
		: `sb-gen-${shortHash}`;

	const updateStep = (
		index: number,
		status: PipelineStepStatus,
		message?: string,
	) => {
		setPipeline((prev) => ({
			...prev,
			steps: prev.steps.map((s, i) =>
				i === index ? { ...s, status, message } : s,
			),
		}));
	};

	const handleCompose = async () => {
		if (!canCompose) return;

		setPipeline({ ...INITIAL_PIPELINE, active: true });
		setAgentPhase("idle");
		setNeonPhase("idle");
		setVercelPhase("idle");
		setStep(3);

		// Step 0: Scaffold (template clone + spec + workflow + git init)
		updateStep(0, "running", "프로젝트 뼈대를 생성하는 중...");

		try {
			const result = await composeMutation.mutateAsync({
				selected: selectedFeatures,
				projectName: projectName.trim(),
				targetPath: targetPath.trim(),
				config: {
					database: { provider: "neon" },
					auth: { provider: "better-auth", features: ["email"] },
					deploy: { provider: "vercel" },
				},
			});

			updateStep(
				0,
				"done",
				`프로젝트 스캐폴드 완료 — ${result.features.length}개 Feature 선택됨`,
			);

			let gitHubOwner: string | undefined;
			let gitHubRepo: string | undefined;

			// Step 1: GitHub Push
			if (result.gitInitialized) {
				updateStep(1, "running", "GitHub 저장소 생성 및 Push 중...");
				try {
					const ghResult = await pushToGitHubMutation.mutateAsync({
						projectPath: result.projectDir,
						repoName: serviceName,
						isPrivate: true,
						atlasProjectId: result.projectId,
					});
					gitHubOwner = ghResult.owner;
					gitHubRepo = ghResult.repo;
					updateStep(1, "done", `${ghResult.repoUrl} Push 완료`);
				} catch (error) {
					updateStep(
						1,
						"failed",
						error instanceof Error ? error.message : "GitHub Push 실패",
					);
				}
			} else {
				updateStep(1, "skipped", "Git 초기화 실패로 건너뜀");
			}

			setPipeline((prev) => ({
				...prev,
				result: {
					projectId: result.projectId,
					projectDir: result.projectDir,
					features: result.features,
					gitInitialized: result.gitInitialized,
					gitHubOwner,
					gitHubRepo,
				},
			}));

			// Step 2: Feature Install — show agent launch prompt
			setAgentPhase("ready");
			updateStep(2, "pending", "CLI Agent를 실행하여 features를 설치하세요");

			// Steps 3-4 wait for agent + Neon/Vercel
			updateStep(3, "pending", "Feature 설치 후 진행");
			updateStep(4, "pending", "Neon 완료 후 진행");
		} catch (error) {
			updateStep(
				0,
				"failed",
				error instanceof Error ? error.message : "알 수 없는 오류",
			);
		}
	};

	const handleLaunchAgent = async () => {
		if (!pipeline.result) return;

		setAgentLaunching(true);
		updateStep(2, "running", "프로젝트를 열고 Agent를 실행하는 중...");
		try {
			// 1. Register project in Desktop
			const openResult = await openFromPathMutation.mutateAsync({
				path: pipeline.result.projectDir,
			});

			if (openResult.canceled || openResult.error || !openResult.project) {
				// If project needs git init, it should already be initialized by scaffold
				throw new Error(openResult.error ?? "프로젝트를 열 수 없습니다");
			}

			const project = openResult.project;

			// 2. Create workspace for the project
			const launchRequest: AgentLaunchRequest = {
				kind: "terminal",
				workspaceId: "pending-workspace",
				agentType: "claude",
				source: "open-in-workspace",
				terminal: {
					command: `claude -p --dangerously-skip-permissions --model sonnet "Read .claude/commands/install-features.md and execute every step. IMPORTANT: Do NOT use subagents or the Agent tool. Do all work directly with Bash, Read, Write, Edit, Grep, Glob tools. For each feature: 1) cp -r source dirs, 2) fix imports with sed, 3) inject into marker files, 4) git add -A && git commit. After ALL features: bun install, fix errors, git push origin main. Be concise and fast."`,
					name: "install-features",
					autoExecute: true,
				},
			};

			const wsResult = await createWorkspace.mutateAsyncWithPendingSetup(
				{
					projectId: project.id,
					name: "install-features",
				},
				{ agentLaunchRequest: launchRequest },
			);

			// 3. Launch agent session
			const finalRequest: AgentLaunchRequest = {
				...launchRequest,
				workspaceId: wsResult.workspace.id,
			};

			await launchAgentSession(finalRequest, {
				source: "open-in-workspace",
				createOrAttach: (input) => terminalCreateOrAttach.mutateAsync(input),
				write: (input) => terminalWrite.mutateAsync(input),
			});

			updateStep(
				2,
				"running",
				"Agent가 features를 설치 중입니다. 완료되면 아래 버튼을 클릭하세요.",
			);
			setAgentPhase("launched");
			// Neon 단계로 자동 전환하지 않음 — 사용자가 Agent 완료를 확인한 후 수동 진행
		} catch (error) {
			updateStep(
				2,
				"failed",
				error instanceof Error ? error.message : "Agent 실행 실패",
			);
		} finally {
			setAgentLaunching(false);
		}
	};

	const handleSkipAgent = () => {
		setAgentPhase("launched");
		updateStep(2, "skipped", "나중에 /install-features 명령어로 설치");

		// Proceed to Neon setup
		setNeonPhase("setup");
		updateStep(3, "pending", "Neon 연결을 설정하세요");
	};

	const handleAgentComplete = () => {
		updateStep(2, "done", "Feature 설치 완료 확인됨");
		setNeonPhase("setup");
		updateStep(3, "pending", "Neon 연결을 설정하세요");
	};

	const handleComposeFailed = () => {
		setPipeline(INITIAL_PIPELINE);
		setStep(2); // Go back to project config
	};

	const handleNeonComplete = async (orgId: string, _orgName: string) => {
		if (!pipeline.result) return;

		setNeonPhase("creating");
		updateStep(3, "running", "Neon 프로젝트 생성 중...");

		try {
			const neonProject = await neonCreateMutation.mutateAsync({
				name: serviceName,
				orgId,
				atlasProjectId: pipeline.result.projectId,
			});

			updateStep(3, "running", ".env 파일 작성 중...");
			await neonWriteEnvMutation.mutateAsync({
				projectPath: pipeline.result.projectDir,
				connectionUri: neonProject.connectionUri,
				neonProjectId: neonProject.id,
				betterAuthSecret,
			});

			// Store connectionUri for Vercel env vars
			setPipeline((prev) => ({
				...prev,
				result: prev.result
					? { ...prev.result, neonConnectionUri: neonProject.connectionUri }
					: prev.result,
			}));

			updateStep(3, "running", "DB 마이그레이션 실행 중 (drizzle-kit push)...");
			const migrationResult = await neonRunMigrationMutation.mutateAsync({
				projectPath: pipeline.result.projectDir,
			});

			if (migrationResult.success) {
				// Seed owner user after successful migration
				if (session?.user?.email) {
					updateStep(3, "running", "Owner 사용자 시딩 중...");
					try {
						await neonSeedOwnerMutation.mutateAsync({
							projectPath: pipeline.result.projectDir,
							email: session.user.email,
							name: session.user.name || session.user.email.split("@")[0],
							password: ownerPassword,
							projectSlug: serviceName,
							atlasProjectId: pipeline.result.projectId,
						});
						updateStep(
							3,
							"done",
							`Neon ${neonProject.name} — DB 마이그레이션 + Owner 시딩 완료`,
						);
					} catch {
						updateStep(
							3,
							"done",
							`Neon ${neonProject.name} — DB 마이그레이션 완료 (Owner 시딩 실패, 수동 가입 필요)`,
						);
					}
				} else {
					updateStep(
						3,
						"done",
						`Neon ${neonProject.name} 생성 + DB 마이그레이션 완료`,
					);
				}
			} else {
				updateStep(
					3,
					"done",
					`Neon ${neonProject.name} 생성 완료 (마이그레이션 경고: ${migrationResult.stderr.slice(0, 100)})`,
				);
			}

			setNeonPhase("done");
			setVercelPhase("setup");
			updateStep(4, "pending", "Vercel 연결을 설정하세요");
		} catch (error) {
			updateStep(
				3,
				"failed",
				error instanceof Error ? error.message : "Neon 프로젝트 생성 실패",
			);
			setNeonPhase("done");
			setVercelPhase("setup");
			updateStep(4, "pending", "Vercel 연결을 설정하세요");
		}
	};

	const handleNeonSkip = () => {
		setNeonPhase("skipped");
		updateStep(3, "skipped", "나중에 연결");
		setVercelPhase("setup");
		updateStep(4, "pending", "Vercel 연결을 설정하세요");
	};

	const handleVercelComplete = async (
		teamId: string | undefined,
		_teamName: string,
	) => {
		if (!pipeline.result) return;

		setVercelPhase("creating");
		updateStep(4, "running", "Vercel API 프로젝트 생성 중...");

		type EnvVar = {
			key: string;
			value: string;
			target: Array<"production" | "preview" | "development">;
			type: "encrypted" | "plain" | "sensitive";
		};

		try {
			// ── Step 1: Create API project (atlas-server) ──
			const apiProject = await vercelCreateMutation.mutateAsync({
				name: `${serviceName}-api`,
				teamId,
				framework: null,
				atlasProjectId: pipeline.result.projectId,
				rootDirectory: "apps/atlas-server",
				skipLocalDbUpdate: true,
			});

			// ── Step 2: Set API env vars ──
			updateStep(4, "running", "API 환경변수 설정 중...");
			const apiEnvVars: EnvVar[] = [];

			if (pipeline.result.neonConnectionUri) {
				apiEnvVars.push({
					key: "DATABASE_URL",
					value: pipeline.result.neonConnectionUri,
					target: ["production", "preview", "development"],
					type: "encrypted",
				});
			}

			apiEnvVars.push({
				key: "BETTER_AUTH_SECRET",
				value: betterAuthSecret,
				target: ["production", "preview", "development"],
				type: "encrypted",
			});

			apiEnvVars.push({
				key: "BETTER_AUTH_URL",
				value: apiProject.url,
				target: ["production"],
				type: "plain",
			});

			apiEnvVars.push({
				key: "API_URL",
				value: apiProject.url,
				target: ["production", "preview"],
				type: "plain",
			});

			await vercelSetEnvVarsMutation.mutateAsync({
				projectId: apiProject.id,
				teamId,
				envVars: apiEnvVars,
			});

			// ── Step 3: Create Frontend project (app) ──
			updateStep(4, "running", "Vercel 프론트엔드 프로젝트 생성 중...");
			const appProject = await vercelCreateMutation.mutateAsync({
				name: serviceName,
				teamId,
				framework: "vite",
				atlasProjectId: pipeline.result.projectId,
				rootDirectory: "apps/app",
			});

			// ── Step 4: Set Frontend env vars ──
			updateStep(4, "running", "프론트엔드 환경변수 설정 중...");
			const appEnvVars: EnvVar[] = [
				{
					key: "VITE_API_URL",
					value: apiProject.url,
					target: ["production", "preview", "development"],
					type: "plain",
				},
			];

			await vercelSetEnvVarsMutation.mutateAsync({
				projectId: appProject.id,
				teamId,
				envVars: appEnvVars,
			});

			// ── Step 5: Update API CORS to allow frontend URL ──
			await vercelSetEnvVarsMutation.mutateAsync({
				projectId: apiProject.id,
				teamId,
				envVars: [
					{
						key: "CORS_ORIGINS",
						value: `${appProject.url},${apiProject.url}`,
						target: ["production", "preview"],
						type: "plain",
					},
				],
			});

			// ── Step 6: Connect git to BOTH projects ──
			let gitLinked = false;
			let finalUrl = appProject.url;

			if (pipeline.result.gitHubOwner && pipeline.result.gitHubRepo) {
				updateStep(4, "running", "GitHub 저장소 연결 중 (배포 시작)...");
				try {
					// Connect git to API project
					await vercelConnectGitMutation.mutateAsync({
						projectId: apiProject.id,
						owner: pipeline.result.gitHubOwner,
						repo: pipeline.result.gitHubRepo,
						teamId,
					});

					// Connect git to Frontend project
					const connectResult = await vercelConnectGitMutation.mutateAsync({
						projectId: appProject.id,
						owner: pipeline.result.gitHubOwner,
						repo: pipeline.result.gitHubRepo,
						teamId,
						atlasProjectId: pipeline.result.projectId,
					});

					gitLinked = true;
					finalUrl = connectResult.url || finalUrl;
				} catch {
					// connectGitRepo 실패 — GitHub Integration 미설치 가능성
				}
			}

			updateStep(
				4,
				"done",
				gitLinked
					? `App: ${finalUrl} | API: ${apiProject.url} — 배포 시작`
					: `App: ${appProject.url} | API: ${apiProject.url} (GitHub 연동 필요)`,
			);
			setVercelPhase("done");
		} catch (error) {
			updateStep(
				4,
				"failed",
				error instanceof Error ? error.message : "Vercel 배포 실패",
			);
			setVercelPhase("done");
		}
	};

	const handleVercelSkip = () => {
		setVercelPhase("skipped");
		updateStep(4, "skipped", "나중에 배포");
	};

	// Pipeline step index → Stepper step index mapping
	// Pipeline: [스캐폴드(0), GitHub Push(1), Feature설치(2), Neon(3), Vercel(4)]
	// Stepper:  [Feature선택(0), 의존성(1), 설정(2), 프로젝트생성(3), Neon(4), Vercel(5)]
	const PIPELINE_TO_STEPPER = [3, 3, 3, 4, 5] as const;

	// Pipeline active: show progress
	if (pipeline.active) {
		return (
			<div className="p-6 space-y-6">
				<div>
					<h1 className="text-lg font-semibold">프로젝트 생성 중</h1>
					<p className="text-sm text-muted-foreground">
						{projectName} 프로젝트를 구성하고 있습니다
					</p>
				</div>

				<ComposerStepper
					currentStep={3}
					completedSteps={(() => {
						const failed = new Set(
							pipeline.steps
								.map((s, i) =>
									s.status === "failed" ? PIPELINE_TO_STEPPER[i] : -1,
								)
								.filter((i) => i >= 0),
						);
						return pipeline.steps
							.map((s, i) =>
								s.status === "done" ? PIPELINE_TO_STEPPER[i] : -1,
							)
							.filter((i) => i >= 0 && !failed.has(i));
					})()}
					failedSteps={pipeline.steps
						.map((s, i) =>
							s.status === "failed" ? PIPELINE_TO_STEPPER[i] : -1,
						)
						.filter((i) => i >= 0)}
					activeStep={
						pipeline.steps.findIndex((s) => s.status === "running") >= 0
							? PIPELINE_TO_STEPPER[
									pipeline.steps.findIndex((s) => s.status === "running")
								]
							: null
					}
				/>

				<PipelineProgress steps={pipeline.steps} />

				{!pipeline.result && pipeline.steps[0].status === "failed" ? (
					<div className="flex gap-2 pt-2">
						<Button variant="outline" onClick={handleComposeFailed}>
							설정으로 돌아가기
						</Button>
						<Button onClick={handleCompose}>재시도</Button>
					</div>
				) : null}

				{agentPhase === "ready" ? (
					<div className="space-y-3 rounded-lg border p-4">
						<p className="text-sm font-medium">
							프로젝트 뼈대가 생성되었습니다. CLI Agent를 실행하여 features를
							설치하세요.
						</p>
						<p className="text-xs text-muted-foreground">
							Agent가 프로젝트를 열고 <code>/install-features</code> 명령을
							실행합니다.
						</p>
						<div className="flex gap-2">
							<Button onClick={handleLaunchAgent} disabled={agentLaunching}>
								{agentLaunching ? "실행 중..." : "에이전트 실행"}
							</Button>
							<Button variant="outline" onClick={handleSkipAgent}>
								나중에 설치
							</Button>
						</div>
					</div>
				) : null}

				{agentPhase === "launched" && neonPhase === "idle" ? (
					<div className="space-y-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
						<p className="text-sm font-medium">
							CLI Agent가 features를 설치 중입니다.
						</p>
						<p className="text-xs text-muted-foreground">
							터미널에서 설치가 완료되고 <code>git push</code>까지 성공한 것을
							확인한 후 아래 버튼을 클릭하세요.
						</p>
						<Button onClick={handleAgentComplete}>
							설치 완료 확인 → Neon 설정으로 진행
						</Button>
					</div>
				) : null}

				{neonPhase === "setup" ? (
					<NeonSetup onComplete={handleNeonComplete} onSkip={handleNeonSkip} />
				) : null}

				{neonPhase === "done" && pipeline.steps[3].status === "failed" ? (
					<div className="flex gap-2 pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setNeonPhase("setup");
								updateStep(3, "pending", "Neon 연결을 다시 설정하세요");
							}}
						>
							Neon 재시도
						</Button>
					</div>
				) : null}

				{vercelPhase === "setup" ? (
					<VercelSetup
						onComplete={handleVercelComplete}
						onSkip={handleVercelSkip}
					/>
				) : null}

				{vercelPhase === "done" && pipeline.steps[4].status === "failed" ? (
					<div className="flex gap-2 pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setVercelPhase("setup");
								updateStep(4, "pending", "Vercel 연결을 다시 설정하세요");
							}}
						>
							Vercel 재시도
						</Button>
					</div>
				) : null}

				{pipeline.result &&
				agentPhase === "launched" &&
				(neonPhase === "done" || neonPhase === "skipped") &&
				(vercelPhase === "done" || vercelPhase === "skipped") ? (
					<div className="space-y-4 pt-4 border-t">
						<div className="flex items-center gap-2">
							<h2 className="text-base font-semibold text-green-500">
								{pipeline.steps.some((s) => s.status === "failed")
									? "프로젝트 생성 완료 (일부 단계 실패)"
									: "프로젝트 생성 완료!"}
							</h2>
						</div>
						<code className="block p-3 rounded bg-muted text-sm font-mono">
							{pipeline.result.projectDir}
						</code>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setPipeline(INITIAL_PIPELINE);
									reset();
								}}
							>
								새 프로젝트 만들기
							</Button>
							<Button
								onClick={() => navigate({ to: "/atlas/deployments" as string })}
							>
								배포 목록으로
							</Button>
						</div>
					</div>
				) : null}
			</div>
		);
	}

	// Normal stepper flow (steps 0-2)
	return (
		<div className="p-6 space-y-6">
			<div>
				<h1 className="text-lg font-semibold">Project Composer</h1>
				<p className="text-sm text-muted-foreground">
					Feature를 선택하고 새 프로젝트를 생성합니다
				</p>
			</div>

			<ComposerStepper currentStep={step} />

			{step === 0 ? (
				<div className="space-y-4">
					<FeatureSelector
						registry={registry}
						selected={selectedFeatures}
						onToggle={toggleFeature}
					/>
					<div className="flex justify-end">
						<Button onClick={() => setStep(1)} disabled={!canProceedToStep1}>
							다음: 의존성 확인
						</Button>
					</div>
				</div>
			) : null}

			{step === 1 && resolution ? (
				<div className="space-y-4">
					<ResolutionPreview resolution={resolution} />
					<div className="flex justify-between">
						<Button variant="outline" onClick={() => setStep(0)}>
							이전
						</Button>
						<Button onClick={() => setStep(2)}>다음: 프로젝트 설정</Button>
					</div>
				</div>
			) : null}

			{step === 2 ? (
				<div className="space-y-4">
					<ProjectConfig
						projectName={projectName}
						onProjectNameChange={setProjectName}
						targetPath={targetPath}
						onTargetPathChange={setTargetPath}
					/>
					<div className="flex justify-between">
						<Button variant="outline" onClick={() => setStep(1)}>
							이전
						</Button>
						<Button onClick={handleCompose} disabled={!canCompose}>
							프로젝트 생성
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
