import { transform } from "@babel/standalone";

/**
 * Babel plugin that transforms imports to __require calls and
 * exports to __exports assignments.
 */
function importTransformPlugin() {
	return {
		visitor: {
			ImportDeclaration(path: any) {
				const source = path.node.source.value;
				const specifiers = path.node.specifiers;

				if (specifiers.length === 0) {
					path.replaceWith({
						type: "ExpressionStatement",
						expression: {
							type: "CallExpression",
							callee: { type: "Identifier", name: "__require" },
							arguments: [{ type: "StringLiteral", value: source }],
						},
					});
					return;
				}

				const properties: any[] = [];
				let defaultImport: string | null = null;
				let namespaceImport: string | null = null;

				for (const spec of specifiers) {
					if (spec.type === "ImportDefaultSpecifier") {
						defaultImport = spec.local.name;
					} else if (spec.type === "ImportNamespaceSpecifier") {
						namespaceImport = spec.local.name;
					} else {
						properties.push({
							type: "ObjectProperty",
							key: { type: "Identifier", name: spec.imported.name },
							value: { type: "Identifier", name: spec.local.name },
							shorthand: spec.imported.name === spec.local.name,
							computed: false,
						});
					}
				}

				const requireCall = {
					type: "CallExpression",
					callee: { type: "Identifier", name: "__require" },
					arguments: [{ type: "StringLiteral", value: source }],
				};

				if (namespaceImport) {
					path.replaceWith({
						type: "VariableDeclaration",
						kind: "const",
						declarations: [
							{
								type: "VariableDeclarator",
								id: { type: "Identifier", name: namespaceImport },
								init: requireCall,
							},
						],
					});
					return;
				}

				if (defaultImport && properties.length === 0) {
					path.replaceWith({
						type: "VariableDeclaration",
						kind: "const",
						declarations: [
							{
								type: "VariableDeclarator",
								id: { type: "Identifier", name: defaultImport },
								init: {
									type: "MemberExpression",
									object: requireCall,
									property: { type: "Identifier", name: "default" },
								},
							},
						],
					});
					return;
				}

				if (defaultImport) {
					const tempVar = `__mod_${source.replace(/[^a-zA-Z0-9]/g, "_")}`;
					const declarations: any[] = [
						{
							type: "VariableDeclarator",
							id: { type: "Identifier", name: tempVar },
							init: requireCall,
						},
						{
							type: "VariableDeclarator",
							id: { type: "Identifier", name: defaultImport },
							init: {
								type: "MemberExpression",
								object: { type: "Identifier", name: tempVar },
								property: { type: "Identifier", name: "default" },
							},
						},
					];
					if (properties.length > 0) {
						declarations.push({
							type: "VariableDeclarator",
							id: { type: "ObjectPattern", properties },
							init: { type: "Identifier", name: tempVar },
						});
					}
					path.replaceWith({
						type: "VariableDeclaration",
						kind: "const",
						declarations,
					});
				} else {
					path.replaceWith({
						type: "VariableDeclaration",
						kind: "const",
						declarations: [
							{
								type: "VariableDeclarator",
								id: { type: "ObjectPattern", properties },
								init: requireCall,
							},
						],
					});
				}
			},
			ExportDefaultDeclaration(path: any) {
				const decl = path.node.declaration;
				if (decl.type === "FunctionDeclaration") {
					const name = decl.id?.name ?? "App";
					path.replaceWithMultiple([
						decl,
						{
							type: "ExpressionStatement",
							expression: {
								type: "AssignmentExpression",
								operator: "=",
								left: {
									type: "MemberExpression",
									object: { type: "Identifier", name: "__exports" },
									property: { type: "Identifier", name: "default" },
								},
								right: { type: "Identifier", name: name },
							},
						},
					]);
				} else {
					path.replaceWith({
						type: "ExpressionStatement",
						expression: {
							type: "AssignmentExpression",
							operator: "=",
							left: {
								type: "MemberExpression",
								object: { type: "Identifier", name: "__exports" },
								property: { type: "Identifier", name: "default" },
							},
							right: decl,
						},
					});
				}
			},
			ExportNamedDeclaration(path: any) {
				if (path.node.declaration) {
					path.replaceWith(path.node.declaration);
				} else {
					path.remove();
				}
			},
		},
	};
}

export function extractImportPaths(code: string): string[] {
	const paths: string[] = [];
	const regex = /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(code)) !== null) {
		paths.push(match[1]);
	}
	return paths;
}

export interface TransformResult {
	code: string;
	error: string | null;
}

export function transformJSX(jsxCode: string): TransformResult {
	try {
		const result = transform(jsxCode, {
			presets: ["react", "typescript"],
			plugins: [importTransformPlugin],
			filename: "preview.tsx",
		});
		return { code: result.code ?? "", error: null };
	} catch (err) {
		return {
			code: "",
			error: err instanceof Error ? err.message : "Transform failed",
		};
	}
}
