import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import {
	type PathSlot,
	resolveFeatureJsonSourcePath,
	resolveFeatureJsonTargetPath,
} from "./path-mapping";

const SLOTS: PathSlot[] = ["server", "client", "admin", "schema", "widgets"];

export async function copyFeaturesToTemplate(opts: {
	templateDir: string;
	featuresSourceDir: string;
	featureIds: string[];
	manifests: FeatureManifest[];
}): Promise<void> {
	for (const featureId of opts.featureIds) {
		for (const slot of SLOTS) {
			const srcDir = resolveFeatureJsonSourcePath(
				opts.featuresSourceDir,
				featureId,
				slot,
			);
			if (!existsSync(srcDir)) continue;

			const tgtDir = resolveFeatureJsonTargetPath(
				opts.templateDir,
				featureId,
				slot,
			);
			await mkdir(dirname(tgtDir), { recursive: true });
			await cp(srcDir, tgtDir, { recursive: true });
		}
	}
}
