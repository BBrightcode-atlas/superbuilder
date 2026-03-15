import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UiSidebar } from "renderer/screens/ui/components/UiSidebar";

export const Route = createFileRoute("/_authenticated/_dashboard/ui")({
  component: UiLayout,
});

function UiLayout() {
  return (
    <div className="flex h-full w-full">
      <UiSidebar />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
