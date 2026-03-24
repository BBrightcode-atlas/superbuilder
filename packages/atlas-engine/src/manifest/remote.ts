import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { BoilerplateManifest } from "./types";

const execFile = promisify(execFileCb);

const DEFAULT_REPO = "BBrightcode-atlas/feature-atlas-template";
const MANIFEST_PATH = "superbuilder.json";

export interface FetchOptions {
	/** GitHub repo (owner/name) */
	repo?: string;
	/** Branch to read from (default: develop) */
	branch?: string;
}

/**
 * Boilerplate 레포의 superbuilder.json을 GitHub API로 읽기.
 * `gh api`를 사용 — gh auth로 인증된 상태여야 함.
 */
export async function fetchRemoteManifest(
	opts?: FetchOptions,
): Promise<BoilerplateManifest> {
	const repo = opts?.repo ?? DEFAULT_REPO;
	const branch = opts?.branch ?? "develop";

	const { stdout } = await execFile("gh", [
		"api",
		`repos/${repo}/contents/${MANIFEST_PATH}`,
		"--jq",
		".content",
		"-H",
		"Accept: application/vnd.github.v3+json",
		"--field",
		`ref=${branch}`,
	]);

	const decoded = Buffer.from(stdout.trim(), "base64").toString("utf-8");
	return JSON.parse(decoded) as BoilerplateManifest;
}

/**
 * Boilerplate 레포의 최신 commit hash 조회
 */
export async function fetchRemoteCommit(opts?: FetchOptions): Promise<string> {
	const repo = opts?.repo ?? DEFAULT_REPO;
	const branch = opts?.branch ?? "develop";

	const { stdout } = await execFile("gh", [
		"api",
		`repos/${repo}/commits/${branch}`,
		"--jq",
		".sha",
	]);

	return stdout.trim();
}

/**
 * Boilerplate 레포의 피처 이름 목록만 빠르게 조회
 */
export async function fetchFeatureList(opts?: FetchOptions): Promise<string[]> {
	const manifest = await fetchRemoteManifest(opts);
	return Object.keys(manifest.features);
}
