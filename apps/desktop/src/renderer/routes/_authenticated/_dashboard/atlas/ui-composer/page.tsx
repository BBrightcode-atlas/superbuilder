import { createFileRoute } from "@tanstack/react-router";
import { UIComposer } from "renderer/screens/atlas/components/UIComposer";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/atlas/ui-composer/",
)({
	component: UIComposerPage,
});

function UIComposerPage() {
	return <UIComposer />;
}
