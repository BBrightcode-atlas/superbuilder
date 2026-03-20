import { FeatureCard } from "./FeatureCard";

interface Feature {
	id: string;
	name: string;
	type: string;
	group: string;
	dependencies: string[];
}

interface FeatureGridProps {
	features: Feature[];
	coreFeatures: string[];
}

export function FeatureGrid({ features, coreFeatures }: FeatureGridProps) {
	if (features.length === 0) {
		return (
			<div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
				No features found
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
			{features.map((f) => (
				<FeatureCard key={f.id} {...f} isCore={coreFeatures.includes(f.id)} />
			))}
		</div>
	);
}
