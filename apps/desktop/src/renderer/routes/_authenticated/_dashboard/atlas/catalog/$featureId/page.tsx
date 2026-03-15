import { createFileRoute, Link } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { FeatureDetail } from "renderer/screens/atlas/components/FeatureDetail";
import { Spinner } from "@superset/ui/spinner";
import { HiArrowLeft } from "react-icons/hi2";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/atlas/catalog/$featureId/",
)({
  component: FeatureDetailPage,
});

function FeatureDetailPage() {
  const { featureId } = Route.useParams();
  const { data, isLoading } =
    electronTrpc.atlas.registry.getRegistry.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="size-5" />
      </div>
    );
  }

  const { registry } = data;
  const feature = registry.features[featureId];

  if (!feature) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Feature not found: {featureId}
        </p>
        <Link
          to="/features/catalog"
          className="text-sm text-primary mt-2 inline-block"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <Link
        to="/features/catalog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <HiArrowLeft className="size-3.5" />
        Back to catalog
      </Link>
      <FeatureDetail
        id={featureId}
        feature={feature}
        registry={registry}
        isCore={registry.core.includes(featureId)}
      />
    </div>
  );
}
