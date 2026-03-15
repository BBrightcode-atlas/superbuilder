import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard/ui/gallery/")({
  component: UiGalleryPage,
});

function UiGalleryPage() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p className="text-sm">Gallery</p>
    </div>
  );
}
