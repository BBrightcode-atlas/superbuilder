import { Badge } from "@superset/ui/badge";
import { Separator } from "@superset/ui/separator";
import { DependencyGraph } from "./DependencyGraph";

interface FeatureDetailProps {
  id: string;
  feature: {
    name: string;
    type: string;
    group: string;
    dependencies: string[];
    optionalDependencies: string[];
    server: { module: string; router: string; controller: string };
    client: { app?: string; admin?: string };
    schema: { path: string; tables?: string[] };
    widget?: { path: string };
    env?: { infrastructure?: string[]; feature?: string[] };
  };
  registry: {
    features: Record<
      string,
      { dependencies: string[]; optionalDependencies: string[] }
    >;
  };
  isCore: boolean;
}

export function FeatureDetail({
  id,
  feature,
  registry,
  isCore,
}: FeatureDetailProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{feature.name}</h1>
          <Badge variant="outline">{feature.type}</Badge>
          {isCore ? <Badge variant="secondary">Core</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {feature.group} · {id}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Code Paths</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {feature.server.module ? (
            <PathItem label="Server Module" path={feature.server.module} />
          ) : null}
          {feature.server.router ? (
            <PathItem label="tRPC Router" path={feature.server.router} />
          ) : null}
          {feature.client.app ? (
            <PathItem label="Client App" path={feature.client.app} />
          ) : null}
          {feature.client.admin ? (
            <PathItem label="Client Admin" path={feature.client.admin} />
          ) : null}
          {feature.schema.path ? (
            <PathItem label="Schema" path={feature.schema.path} />
          ) : null}
          {feature.widget?.path ? (
            <PathItem label="Widget" path={feature.widget.path} />
          ) : null}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-3">Dependencies</h3>
        <DependencyGraph featureId={id} registry={registry} />
      </div>

      {feature.schema.tables && feature.schema.tables.length > 0 ? (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">Schema Tables</h3>
            <div className="flex flex-wrap gap-1.5">
              {feature.schema.tables.map((table: string) => (
                <code
                  key={table}
                  className="px-2 py-0.5 rounded bg-muted text-xs font-mono"
                >
                  {table}
                </code>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {feature.env ? (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">Environment Variables</h3>
            {feature.env.infrastructure &&
            feature.env.infrastructure.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-1">
                  Infrastructure
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.env.infrastructure.map((v: string) => (
                    <code
                      key={v}
                      className="px-2 py-0.5 rounded bg-muted text-xs font-mono"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
            {feature.env.feature && feature.env.feature.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Feature-specific
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.env.feature.map((v: string) => (
                    <code
                      key={v}
                      className="px-2 py-0.5 rounded bg-muted text-xs font-mono"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PathItem({ label, path }: { label: string; path: string }) {
  return (
    <div className="p-2 rounded bg-muted/50">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <code className="font-mono text-[11px]">{path}</code>
    </div>
  );
}
