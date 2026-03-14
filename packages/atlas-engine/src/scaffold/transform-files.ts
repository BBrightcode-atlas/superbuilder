import type { Dirent } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { transformImports } from "../transform/import-transformer";

export async function transformDirectory(dir: string): Promise<number> {
	let count = 0;

	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return 0;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			count += await transformDirectory(fullPath);
		} else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
			const original = await readFile(fullPath, "utf-8");
			const transformed = transformImports(original);
			if (transformed !== original) {
				await writeFile(fullPath, transformed, "utf-8");
				count++;
			}
		}
	}

	return count;
}
