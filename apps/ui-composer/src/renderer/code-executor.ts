import { resolveModule } from "./module-registry";
import { extractImportPaths, transformJSX } from "./babel-transform";

export interface ExecutionResult {
	Component: React.ComponentType | null;
	error: string | null;
	unresolvedImports: string[];
}

export function executeCode(jsxCode: string): ExecutionResult {
	const importPaths = extractImportPaths(jsxCode);
	const unresolved = importPaths.filter((p) => resolveModule(p) === null);

	if (unresolved.length > 0) {
		return { Component: null, error: null, unresolvedImports: unresolved };
	}

	const { code, error: transformError } = transformJSX(jsxCode);
	if (transformError) {
		return {
			Component: null,
			error: `Transform Error: ${transformError}`,
			unresolvedImports: [],
		};
	}

	try {
		const __exports: Record<string, unknown> = {};
		const __require = (path: string): Record<string, unknown> => {
			const mod = resolveModule(path);
			if (!mod) throw new Error(`Module not found: ${path}`);
			return mod;
		};

		// NOTE: new Function() is intentional here -- this is a preview sandbox
		// that executes user-provided JSX code transformed by Babel. The code
		// runs in an iframe with controlled module resolution.
		const fn = new Function("__require", "__exports", "React", code);
		const ReactMod = resolveModule("react");
		fn(__require, __exports, ReactMod);

		const Component = __exports.default as React.ComponentType | undefined;
		if (!Component) {
			return {
				Component: null,
				error: "No default export found. Code must have `export default function App()`.",
				unresolvedImports: [],
			};
		}

		return { Component, error: null, unresolvedImports: [] };
	} catch (err) {
		return {
			Component: null,
			error: `Runtime Error: ${err instanceof Error ? err.message : String(err)}`,
			unresolvedImports: [],
		};
	}
}
