import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import {
	type B2B2CPathSlot,
	resolveB2B2CSourcePath,
	resolveB2B2CTargetPath,
} from "./path-mapping-b2b2c";

const B2B2C_SLOTS: B2B2CPathSlot[] = [
	"server",
	"admin",
	"schema",
	"widgets",
	"landing",
];

export async function copyFeaturesB2B2C(opts: {
	templateDir: string;
	featuresSourceDir: string;
	featureIds: string[];
	manifests: FeatureManifest[];
}): Promise<void> {
	for (const featureId of opts.featureIds) {
		for (const slot of B2B2C_SLOTS) {
			const srcDir = resolveB2B2CSourcePath(
				opts.featuresSourceDir,
				featureId,
				slot,
			);
			if (!existsSync(srcDir)) continue;

			const tgtDir = resolveB2B2CTargetPath(opts.templateDir, featureId, slot);
			await mkdir(dirname(tgtDir), { recursive: true });
			await cp(srcDir, tgtDir, { recursive: true });
		}
	}
}
