import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/builder/")({
	component: () => <Navigate to="/builder/composer" replace />,
});
