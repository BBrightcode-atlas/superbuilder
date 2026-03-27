import { createFileRoute } from "@tanstack/react-router";
import { UIComposer } from "renderer/screens/atlas/components/UIComposer";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/ui/composer/",
)({
	component: UiComposerPage,
});

function UiComposerPage() {
	return <UIComposer />;
}
