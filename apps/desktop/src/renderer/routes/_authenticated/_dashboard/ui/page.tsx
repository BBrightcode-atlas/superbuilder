import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/ui/")({
	component: UIPage,
});

function UIPage() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="text-center space-y-2">
				<h2 className="text-xl font-semibold text-foreground">UI Gallery</h2>
				<p className="text-muted-foreground text-sm">Coming Soon -- UI 갤러리 및 빌더 기획 중</p>
			</div>
		</div>
	);
}
