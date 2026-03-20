import { Spinner } from "@superset/ui/spinner";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { FeatureGrid } from "renderer/screens/atlas/components/FeatureGrid";
import { GroupFilter } from "renderer/screens/atlas/components/GroupFilter";

export const Route = createFileRoute(
	"/_authenticated/_dashboard/atlas/catalog/",
)({
	component: CatalogPage,
});

function CatalogPage() {
	const [activeGroup, setActiveGroup] = useState<string | null>(null);
	const [search, setSearch] = useState("");

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
	const allFeatures = Object.entries(registry.features).map(([id, entry]) => ({
		id,
		name: entry.name,
		type: entry.type,
		group: entry.group,
		dependencies: entry.dependencies,
	}));

	const groups = registry.groups as Record<
		string,
		{ label: string; order: number }
	>;
	const groupsArray = Object.entries(groups)
		.map(([id, meta]) => ({ id, label: meta.label, order: meta.order }))
		.sort((a, b) => a.order - b.order);

	const filtered = allFeatures.filter((f) => {
		if (activeGroup && f.group !== activeGroup) return false;
		if (
			search &&
			!f.name.toLowerCase().includes(search.toLowerCase()) &&
			!f.id.toLowerCase().includes(search.toLowerCase())
		)
			return false;
		return true;
	});

	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Feature Catalog</h1>
					<p className="text-sm text-muted-foreground">
						{allFeatures.length} features available
					</p>
				</div>
				<input
					type="text"
					placeholder="Search features..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-8 w-56 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
			</div>

			<GroupFilter
				groups={groupsArray}
				activeGroup={activeGroup}
				onGroupChange={setActiveGroup}
			/>

			<FeatureGrid features={filtered} coreFeatures={registry.core} />
		</div>
	);
}
