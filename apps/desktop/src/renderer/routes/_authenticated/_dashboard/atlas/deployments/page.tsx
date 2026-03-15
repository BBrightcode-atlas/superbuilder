import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/atlas/deployments/",
)({
	component: () => <Navigate to="/builder/deployments" replace />,
});
