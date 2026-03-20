import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import { Spinner } from "@superset/ui/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LuExternalLink, LuGitBranch, LuPlus, LuTrash2 } from "react-icons/lu";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/builder/deployments/",
)({
	component: DeploymentsPage,
});

const STATUS_BADGE: Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	scaffolding: { label: "스캐폴딩", variant: "outline" },
	provisioning: { label: "프로비저닝", variant: "outline" },
	deploying: { label: "배포 중", variant: "outline" },
	seeding: { label: "시딩", variant: "outline" },
	deployed: { label: "배포됨", variant: "default" },
	error: { label: "오류", variant: "destructive" },
};

function DeploymentsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: projects, isLoading } = useQuery({
		queryKey: ["composer", "projects"],
		queryFn: () => apiTrpcClient.composer.list.query(),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => apiTrpcClient.composer.delete.mutate({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["composer", "projects"] });
		},
	});

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">배포 목록</h1>
					<p className="text-sm text-muted-foreground">
						Composer로 생성한 프로젝트를 관리합니다
					</p>
				</div>
				<Button
					onClick={() => navigate({ to: "/builder/composer" as string })}
					size="sm"
				>
					<LuPlus className="size-4 mr-1" />새 프로젝트
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner className="size-5" />
				</div>
			) : !projects || projects.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<p className="text-sm text-muted-foreground mb-4">
						아직 생성된 프로젝트가 없습니다
					</p>
					<Button
						variant="outline"
						onClick={() => navigate({ to: "/builder/composer" as string })}
					>
						첫 프로젝트 만들기
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{projects.map((project) => {
						const statusInfo =
							STATUS_BADGE[project.status] ?? STATUS_BADGE.deployed;
						const features = (project.features as string[]) ?? [];

						return (
							<div
								key={project.id}
								className="rounded-lg border border-border p-4 space-y-3"
							>
								<div className="flex items-start justify-between">
									<div>
										<h3 className="text-sm font-semibold">{project.name}</h3>
										<p className="text-xs text-muted-foreground mt-0.5">
											{new Date(project.createdAt).toLocaleDateString("ko-KR")}
										</p>
									</div>
									<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
								</div>

								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span>{features.length} Features</span>
								</div>

								{features.length > 0 ? (
									<div className="flex flex-wrap gap-1">
										{features.map((f) => (
											<Badge
												key={f}
												variant="secondary"
												className="text-[10px] px-1.5 py-0"
											>
												{f}
											</Badge>
										))}
									</div>
								) : null}

								{project.githubRepoUrl ? (
									<a
										href={project.githubRepoUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-xs text-primary hover:underline"
									>
										<LuGitBranch className="size-3" />
										{project.githubRepoUrl}
									</a>
								) : null}

								{project.neonProjectId ? (
									<a
										href={`https://console.neon.tech/app/projects/${project.neonProjectId}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-xs text-primary hover:underline"
									>
										<LuExternalLink className="size-3" />
										Neon: {project.neonProjectId}
									</a>
								) : null}

								{project.vercelUrl ? (
									<a
										href={project.vercelUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-xs text-primary hover:underline"
									>
										<LuExternalLink className="size-3" />
										App: {project.vercelUrl}
									</a>
								) : null}

								{project.vercelServerUrl ? (
									<a
										href={project.vercelServerUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
									>
										<LuExternalLink className="size-3" />
										API: {project.vercelServerUrl}
									</a>
								) : null}

								{project.errorMessage ? (
									<p className="text-xs text-destructive bg-destructive/10 rounded p-2">
										{project.errorMessage}
									</p>
								) : null}

								<div className="flex justify-end gap-1 pt-1">
									<Button
										variant="ghost"
										size="sm"
										className="text-destructive hover:text-destructive"
										onClick={() => deleteMutation.mutate(project.id)}
										disabled={deleteMutation.isPending}
									>
										<LuTrash2 className="size-3.5" />
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
