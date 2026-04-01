#!/usr/bin/env bun
/**
 * Validates dev-state.json files against the team organization schema.
 * Run: bun scripts/validate-dev-state.ts
 *
 * Exits 0 if all valid, 1 if any invalid.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const DEV_STATE_LOCATIONS: ReadonlyArray<{
  readonly team: string;
  readonly path: string;
  readonly prefix: string;
}> = [
  { team: "desktop", path: "apps/desktop/dev-state.json", prefix: "DT:" },
  {
    team: "engine",
    path: "packages/atlas-engine/dev-state.json",
    prefix: "EG:",
  },
  { team: "ecosystem", path: "dev-state.json", prefix: "EC:" },
] as const;

const REQUIRED_FIELDS = [
  "version",
  "team",
  "techLead",
  "linearProject",
  "linearPrefix",
  "currentMilestone",
  "currentPhase",
  "currentStep",
  "milestones",
] as const;

const VALID_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "blocked",
] as const;

type ValidationError = { readonly file: string; readonly message: string };

function validate(): ReadonlyArray<ValidationError> {
  const errors: ValidationError[] = [];

  for (const loc of DEV_STATE_LOCATIONS) {
    const filePath = resolve(ROOT, loc.path);

    if (!existsSync(filePath)) {
      errors.push({ file: loc.path, message: "File does not exist" });
      continue;
    }

    let data: Record<string, unknown>;
    try {
      const raw = readFileSync(filePath, "utf-8");
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      errors.push({
        file: loc.path,
        message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in data)) {
        errors.push({ file: loc.path, message: `Missing field: "${field}"` });
      }
    }

    // version
    if (data.version !== 1) {
      errors.push({
        file: loc.path,
        message: `Invalid version: expected 1, got ${data.version}`,
      });
    }

    // team
    if (data.team !== loc.team) {
      errors.push({
        file: loc.path,
        message: `Team mismatch: expected "${loc.team}", got "${data.team}"`,
      });
    }

    // linearPrefix
    if (data.linearPrefix !== loc.prefix) {
      errors.push({
        file: loc.path,
        message: `Prefix mismatch: expected "${loc.prefix}", got "${data.linearPrefix}"`,
      });
    }

    // milestones structure
    if (data.milestones && typeof data.milestones === "object") {
      const milestones = data.milestones as Record<
        string,
        Record<string, unknown>
      >;
      for (const [mKey, milestone] of Object.entries(milestones)) {
        if (
          milestone.status &&
          !VALID_STATUSES.includes(milestone.status as (typeof VALID_STATUSES)[number])
        ) {
          errors.push({
            file: loc.path,
            message: `Milestone "${mKey}" has invalid status: "${milestone.status}"`,
          });
        }

        if (milestone.phases && typeof milestone.phases === "object") {
          const phases = milestone.phases as Record<
            string,
            Record<string, unknown>
          >;
          for (const [pKey, phase] of Object.entries(phases)) {
            if (
              phase.status &&
              !VALID_STATUSES.includes(phase.status as (typeof VALID_STATUSES)[number])
            ) {
              errors.push({
                file: loc.path,
                message: `Phase "${pKey}" has invalid status: "${phase.status}"`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
}

// --- Main ---
const errors = validate();

if (errors.length === 0) {
  console.log("✓ All dev-state.json files are valid");
  process.exit(0);
} else {
  console.error(`✗ Found ${errors.length} validation error(s):\n`);
  for (const err of errors) {
    console.error(`  ${err.file}: ${err.message}`);
  }
  process.exit(1);
}
