import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { GitHubResult } from "./types";

const execFileAsync = promisify(execFileCb);

export async function pushToGitHub(opts: {
	projectDir: string;
	repoName: string;
	org?: string;
	private?: boolean;
}): Promise<GitHubResult> {
	const orgName = opts.org ?? "BBrightcode-atlas";
	const isPrivate = opts.private ?? true;
	const fullName = `${orgName}/${opts.repoName}`;

	await execFileAsync(
		"gh",
		[
			"repo",
			"create",
			fullName,
			isPrivate ? "--private" : "--public",
			"--source",
			opts.projectDir,
			"--push",
		],
		{ cwd: opts.projectDir },
	);

	const { stdout } = await execFileAsync(
		"gh",
		["repo", "view", "--json", "url,owner,name"],
		{ cwd: opts.projectDir },
	);
	const info = JSON.parse(stdout) as {
		url: string;
		owner: { login: string };
		name: string;
	};

	return {
		repoUrl: info.url,
		owner: info.owner.login,
		repo: info.name,
	};
}
