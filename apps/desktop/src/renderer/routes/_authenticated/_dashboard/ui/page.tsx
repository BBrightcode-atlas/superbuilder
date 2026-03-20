import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/ui/")({
	component: () => <Navigate to="/ui/gallery" replace />,
});
