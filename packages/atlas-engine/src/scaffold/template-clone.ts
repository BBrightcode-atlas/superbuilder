import { execFile as execFileCb } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const TEMPLATE_REPO = "BBrightcode-atlas/feature-atlas-template";

export interface CloneOptions {
	templateRepo?: string;
	targetDir: string;
	projectName: string;
}

export async function cloneTemplate(opts: CloneOptions): Promise<string> {
	const repo = opts.templateRepo ?? TEMPLATE_REPO;

	// Shallow clone
	await execFile("gh", [
		"repo",
		"clone",
		repo,
		opts.targetDir,
		"--",
		"--depth=1",
	]);

	// Remove .git — this will be a new project
	await rm(join(opts.targetDir, ".git"), { recursive: true, force: true });

	// Update root package.json name
	await updatePackageName(opts.targetDir, opts.projectName);

	return opts.targetDir;
}

async function updatePackageName(
	projectDir: string,
	projectName: string,
): Promise<void> {
	const pkgPath = join(projectDir, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);
	pkg.name = projectName;
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

export async function initGitRepo(projectDir: string): Promise<void> {
	await execFile("git", ["init", "--initial-branch=main"], {
		cwd: projectDir,
	});
	await execFile("git", ["add", "."], { cwd: projectDir });
	await execFile(
		"git",
		["commit", "-m", "Initial commit from Superbuilder Composer"],
		{ cwd: projectDir },
	);
}
