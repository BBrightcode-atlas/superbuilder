import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/atlas")({
  component: () => <Navigate to="/features/catalog" replace />,
});
