import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/features/")({
	component: () => <Navigate to="/features/catalog" replace />,
});
