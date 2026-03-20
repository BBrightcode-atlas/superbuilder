import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AtlasSidebar } from "renderer/screens/atlas/components/AtlasSidebar";

export const Route = createFileRoute("/_authenticated/_dashboard/atlas")({
	component: AtlasLayout,
});

function AtlasLayout() {
	return (
		<div className="flex h-full w-full">
			<AtlasSidebar />
			<div className="flex-1 overflow-auto">
				<Outlet />
			</div>
		</div>
	);
}
