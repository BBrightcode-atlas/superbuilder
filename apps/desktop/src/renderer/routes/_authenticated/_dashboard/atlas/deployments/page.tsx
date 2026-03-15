import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@superset/ui/button";
import { Spinner } from "@superset/ui/spinner";
import { LuPlus } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { DeploymentCard } from "renderer/screens/atlas/components/DeploymentCard";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/atlas/deployments/",
)({
	component: DeploymentsPage,
});

function DeploymentsPage() {
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();

	const { data: projects, isLoading } =
		electronTrpc.atlas.deployments.list.useQuery();

	const deleteMutation = electronTrpc.atlas.deployments.delete.useMutation({
		onSuccess: () => {
			utils.atlas.deployments.list.invalidate();
		},
	});

	const openInFinderMutation =
		electronTrpc.external.openInFinder.useMutation();

	const handleDelete = (id: string) => {
		deleteMutation.mutate({ id });
	};

	const handleOpenFolder = (path: string) => {
		openInFinderMutation.mutate(path);
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">배포 목록</h1>
					<p className="text-sm text-muted-foreground">
						Atlas Composer로 생성한 프로젝트를 관리합니다
					</p>
				</div>
				<Button
					onClick={() => navigate({ to: "/builder/composer" })}
					size="sm"
				>
					<LuPlus className="size-4 mr-1" />
					새 프로젝트
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
						onClick={() => navigate({ to: "/builder/composer" })}
					>
						첫 프로젝트 만들기
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{projects.map((project) => (
						<DeploymentCard
							key={project.id}
							project={project}
							onDelete={handleDelete}
							onOpenFolder={handleOpenFolder}
						/>
					))}
				</div>
			)}
		</div>
	);
}
