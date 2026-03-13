interface DependencyGraphProps {
  featureId: string;
  registry: {
    features: Record<
      string,
      { dependencies: string[]; optionalDependencies: string[] }
    >;
  };
}

export function DependencyGraph({ featureId, registry }: DependencyGraphProps) {
  const feature = registry.features[featureId];
  if (!feature) return null;

  const deps = feature.dependencies;
  const optDeps = feature.optionalDependencies;

  const dependedBy = Object.entries(registry.features)
    .filter(([, f]) => f.dependencies.includes(featureId))
    .map(([id]) => id);

  return (
    <div className="space-y-4">
      {deps.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Dependencies ({deps.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {deps.map((dep) => (
              <span
                key={dep}
                className="px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs"
              >
                {dep}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {optDeps.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Optional ({optDeps.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {optDeps.map((dep) => (
              <span
                key={dep}
                className="px-2 py-1 rounded bg-purple-500/10 text-purple-500 text-xs"
              >
                {dep}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {dependedBy.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Used by ({dependedBy.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {dependedBy.map((dep) => (
              <span
                key={dep}
                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-xs"
              >
                {dep}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
