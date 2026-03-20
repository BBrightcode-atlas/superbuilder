import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/ui/requests/")(
	{
		component: UiRequestsPage,
	},
);

function UiRequestsPage() {
	return (
		<div className="flex items-center justify-center h-full text-muted-foreground">
			<p className="text-sm">Requests</p>
		</div>
	);
}
