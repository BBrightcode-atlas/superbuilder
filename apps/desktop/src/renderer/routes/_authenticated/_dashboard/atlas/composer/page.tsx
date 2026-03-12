import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@superset/ui/button";
import { Spinner } from "@superset/ui/spinner";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ComposerStepper } from "renderer/screens/atlas/components/ComposerStepper";
import { FeatureSelector } from "renderer/screens/atlas/components/FeatureSelector";
import { ResolutionPreview } from "renderer/screens/atlas/components/ResolutionPreview";
import { ProjectConfig } from "renderer/screens/atlas/components/ProjectConfig";
import { NeonSetup } from "renderer/screens/atlas/components/NeonSetup";
import { VercelSetup } from "renderer/screens/atlas/components/VercelSetup";
import {
  PipelineProgress,
  type PipelineStepStatus,
} from "renderer/screens/atlas/components/PipelineProgress";
import { useAtlasComposerStore } from "renderer/stores/atlas-state";
import { useState } from "react";

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
    targetPath: string;
    features: string[];
    gitInitialized: boolean;
    gitHubOwner?: string;
    gitHubRepo?: string;
  } | null;
}

const INITIAL_PIPELINE: PipelineState = {
  active: false,
  steps: [
    { label: "파일 추출", status: "pending" },
    { label: "Git 초기화", status: "pending" },
    { label: "GitHub Push", status: "pending" },
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
  const [neonPhase, setNeonPhase] = useState<
    "idle" | "setup" | "creating" | "done" | "skipped"
  >("idle");
  const [vercelPhase, setVercelPhase] = useState<
    "idle" | "setup" | "creating" | "done" | "skipped"
  >("idle");

  const { data: registryData, isLoading: registryLoading } =
    electronTrpc.atlas.registry.getRegistry.useQuery();

  const { data: resolution } = electronTrpc.atlas.resolver.resolve.useQuery(
    { selected: selectedFeatures },
    { enabled: selectedFeatures.length > 0 },
  );

  const composeMutation = electronTrpc.atlas.composer.compose.useMutation();
  const pushToGitHubMutation =
    electronTrpc.atlas.composer.pushToGitHub.useMutation();
  const neonCreateMutation =
    electronTrpc.atlas.neon.createProject.useMutation();
  const neonWriteEnvMutation =
    electronTrpc.atlas.neon.writeEnvFile.useMutation();
  const vercelCreateMutation =
    electronTrpc.atlas.vercel.createProject.useMutation();
  // connectGitRepo는 더이상 사용하지 않음 — createProject에서 gitRepository로 한번에 처리

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
    projectName.trim() && targetPath.trim() && !!resolution && !composeMutation.isPending;

  // 외부 서비스(GitHub, Neon, Vercel)에 사용할 고유 이름
  const slug = projectName.trim().toLowerCase();
  const shortHash = Date.now().toString(36).slice(-4);
  const serviceName = slug
    ? `sb-gen-${slug}-${shortHash}`
    : `sb-gen-${shortHash}`;

  const updateStep = (index: number, status: PipelineStepStatus, message?: string) => {
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
    setNeonPhase("idle");
    setVercelPhase("idle");
    setStep(3);

    // Step 0: Extract + Git (both handled by compose mutation)
    updateStep(0, "running", "프로젝트 파일을 추출하는 중...");

    try {
      const result = await composeMutation.mutateAsync({
        selected: selectedFeatures,
        projectName: projectName.trim(),
        targetPath: targetPath.trim(),
      });

      updateStep(0, "done", `${result.features.length}개 Feature 추출 완료`);
      updateStep(
        1,
        result.gitInitialized ? "done" : "failed",
        result.gitInitialized ? "Git 저장소 초기화 완료" : "Git 초기화 실패",
      );

      let gitHubOwner: string | undefined;
      let gitHubRepo: string | undefined;

      // Step 2: GitHub Push (only if git initialized)
      if (result.gitInitialized) {
        updateStep(2, "running", "GitHub 저장소 생성 및 Push 중...");
        try {
          const ghResult = await pushToGitHubMutation.mutateAsync({
            projectPath: result.targetPath,
            repoName: serviceName,
            isPrivate: true,
            atlasProjectId: result.projectId,
          });
          gitHubOwner = ghResult.owner;
          gitHubRepo = ghResult.repo;
          updateStep(2, "done", `${ghResult.repoUrl} Push 완료`);
        } catch (error) {
          updateStep(
            2,
            "failed",
            error instanceof Error ? error.message : "GitHub Push 실패",
          );
        }
      } else {
        updateStep(2, "skipped", "Git 초기화 실패로 건너뜀");
      }

      setPipeline((prev) => ({
        ...prev,
        result: {
          projectId: result.projectId,
          targetPath: result.targetPath,
          features: result.features,
          gitInitialized: result.gitInitialized,
          gitHubOwner,
          gitHubRepo,
        },
      }));

      // Pause for Neon setup
      setNeonPhase("setup");
      updateStep(3, "pending", "Neon 연결을 설정하세요");
      updateStep(4, "pending", "Neon 완료 후 진행");
    } catch (error) {
      updateStep(
        0,
        "failed",
        error instanceof Error ? error.message : "알 수 없는 오류",
      );
    }
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

      // Neon projects are available immediately — no health check needed
      updateStep(3, "running", ".env 파일 작성 중...");
      await neonWriteEnvMutation.mutateAsync({
        projectPath: pipeline.result.targetPath,
        connectionUri: neonProject.connectionUri,
        neonProjectId: neonProject.id,
      });
      updateStep(3, "done", `Neon 프로젝트 ${neonProject.name} 생성 완료`);

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
    updateStep(4, "running", "Vercel 프로젝트 생성 중...");

    try {
      // createProject에 Git 정보를 포함하면 생성과 동시에 연동
      const vcProject = await vercelCreateMutation.mutateAsync({
        name: serviceName,
        teamId,
        framework: "vite",
        atlasProjectId: pipeline.result.projectId,
        gitOwner: pipeline.result.gitHubOwner,
        gitRepo: pipeline.result.gitHubRepo,
      });

      const hasGit = pipeline.result.gitHubOwner && pipeline.result.gitHubRepo;
      updateStep(
        4,
        "done",
        hasGit
          ? `${vcProject.url} — GitHub 연동 완료, 자동 배포 시작`
          : `${vcProject.url} 프로젝트 생성 완료 (Git 연동 후 자동 배포)`,
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
  // Pipeline: [파일추출(0), Git초기화(1), GitHub Push(2), Neon(3), Vercel(4)]
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
                .map((s, i) => (s.status === "failed" ? PIPELINE_TO_STEPPER[i] : -1))
                .filter((i) => i >= 0),
            );
            return pipeline.steps
              .map((s, i) => (s.status === "done" ? PIPELINE_TO_STEPPER[i] : -1))
              .filter((i) => i >= 0 && !failed.has(i));
          })()}
          failedSteps={pipeline.steps
            .map((s, i) => (s.status === "failed" ? PIPELINE_TO_STEPPER[i] : -1))
            .filter((i) => i >= 0)}
          activeStep={
            pipeline.steps.findIndex((s) => s.status === "running") >= 0
              ? PIPELINE_TO_STEPPER[pipeline.steps.findIndex((s) => s.status === "running")]
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

        {neonPhase === "setup" ? (
          <NeonSetup
            onComplete={handleNeonComplete}
            onSkip={handleNeonSkip}
          />
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
              {pipeline.result.targetPath}
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
                onClick={() =>
                  navigate({ to: "/atlas/deployments" as string })
                }
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
            <Button
              onClick={() => setStep(1)}
              disabled={!canProceedToStep1}
            >
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
