import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BoilerplateManifest } from "./types";

const MANIFEST_FILE = "superbuilder.json";

/** 로컬 디렉토리에서 manifest 로드 */
export async function loadManifest(
	dir: string,
): Promise<BoilerplateManifest | null> {
	try {
		const raw = await readFile(join(dir, MANIFEST_FILE), "utf-8");
		return JSON.parse(raw) as BoilerplateManifest;
	} catch {
		return null;
	}
}

/** 로컬 디렉토리에 manifest 저장 */
export async function saveManifest(
	dir: string,
	manifest: BoilerplateManifest,
): Promise<void> {
	await writeFile(
		join(dir, MANIFEST_FILE),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf-8",
	);
}
