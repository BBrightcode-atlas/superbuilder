import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/builder")({
	component: BuilderLayout,
});

function BuilderLayout() {
	return (
		<div className="flex-1 overflow-auto">
			<Outlet />
		</div>
	);
}
