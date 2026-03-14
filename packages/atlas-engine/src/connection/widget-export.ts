import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Register a widget's subpath export in packages/widgets/package.json.
 * Creates the `exports` field if it doesn't exist.
 */
export function registerWidgetExport(
	templateDir: string,
	_featureId: string,
	widgetExport: { subpath: string; entry: string },
): void {
	const pkgPath = join(templateDir, "packages", "widgets", "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

	if (!pkg.exports) {
		pkg.exports = {};
	}

	pkg.exports[widgetExport.subpath] = widgetExport.entry;
	writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}
