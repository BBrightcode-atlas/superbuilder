import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/atlas")({
	component: AtlasLayout,
});

function AtlasLayout() {
	return (
		<div className="flex-1 overflow-auto">
			<Outlet />
		</div>
	);
}
