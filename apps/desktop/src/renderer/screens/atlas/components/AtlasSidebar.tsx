import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@superset/ui/utils";
import type { IconType } from "react-icons";
import {
  HiOutlineCube,
  HiOutlineWrenchScrewdriver,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
} from "react-icons/hi2";

interface NavSection {
  title: string;
  items: ReadonlyArray<{ to: string; label: string; icon: IconType }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Features",
    items: [
      { to: "/atlas/catalog", label: "Catalog", icon: HiOutlineCube as IconType },
      { to: "/atlas/studio", label: "Studio", icon: HiOutlineSparkles as IconType },
    ],
  },
  {
    title: "Builders",
    items: [
      { to: "/atlas/composer", label: "Composer", icon: HiOutlineWrenchScrewdriver as IconType },
      { to: "/atlas/deployments", label: "Deployments", icon: HiOutlineRocketLaunch as IconType },
    ],
  },
];

export function AtlasSidebar() {
  const location = useLocation();

  return (
    <div className="w-52 border-r border-border bg-muted/30 flex flex-col">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="p-4 pb-1 pt-3 first:pt-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h2>
          </div>
          <nav className="px-2 pb-2 space-y-0.5">
            {section.items.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
