import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const targetPath = process.argv[2] ?? "client/src/pages/DanceCompetitions.tsx";
const remoteRef = process.argv[3] ?? "main";

function run(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

const repository = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
const encoded = run("gh", [
  "api",
  `repos/${repository}/contents/${targetPath}?ref=${remoteRef}`,
  "--jq",
  ".content",
]);

const remoteSource = Buffer.from(encoded.replace(/\s/g, ""), "base64").toString("utf8");
const localSource = readFileSync(targetPath, "utf8");

if (remoteSource === localSource) {
  console.log(`[github-parity] PASS ${targetPath} matches ${repository}@${remoteRef}`);
  process.exit(0);
}

const tempDirectory = mkdtempSync(join(tmpdir(), "artswrk-github-parity-"));
const remoteFile = join(tempDirectory, "remote.tsx");
const localFile = join(tempDirectory, "local.tsx");
writeFileSync(remoteFile, remoteSource);
writeFileSync(localFile, localSource);

console.error(`[github-parity] FAIL ${targetPath} differs from ${repository}@${remoteRef}`);
try {
  console.error(run("diff", ["-u", remoteFile, localFile]));
} catch (error) {
  if (error?.stdout) console.error(String(error.stdout).trim());
}
rmSync(tempDirectory, { recursive: true, force: true });
process.exit(1);
