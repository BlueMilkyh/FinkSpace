#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const TAURI_CONF = "src-tauri/tauri.conf.json";
const PKG_JSON = "package.json";

// Get bump type from args
const bump = process.argv[2] || "patch";

// Read current version
const tauriConf = JSON.parse(readFileSync(TAURI_CONF, "utf-8"));
const current = tauriConf.version;
console.log(`Current version: ${current}`);

// Calculate new version
let [major, minor, patch] = current.split(".").map(Number);
if (bump === "patch") patch++;
else if (bump === "minor") { minor++; patch = 0; }
else if (bump === "major") { major++; minor = 0; patch = 0; }
else if (/^\d+\.\d+\.\d+$/.test(bump)) {
  [major, minor, patch] = bump.split(".").map(Number);
} else {
  console.error(`Invalid bump: "${bump}". Use patch, minor, major, or x.y.z`);
  process.exit(1);
}
const newVersion = `${major}.${minor}.${patch}`;
console.log(`New version:     ${newVersion}\n`);

// Check for uncommitted changes
try {
  const status = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
  if (status) {
    console.error("Error: Uncommitted changes. Commit or stash first.\n");
    console.error(status);
    process.exit(1);
  }
} catch {
  console.error("Error: git not available");
  process.exit(1);
}

// Update tauri.conf.json
tauriConf.version = newVersion;
writeFileSync(TAURI_CONF, JSON.stringify(tauriConf, null, 2) + "\n");

// Update package.json
const pkg = JSON.parse(readFileSync(PKG_JSON, "utf-8"));
pkg.version = newVersion;
writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Updated ${TAURI_CONF} and ${PKG_JSON}`);

// Commit, tag, push
execSync(`git add "${TAURI_CONF}" "${PKG_JSON}"`, { stdio: "inherit" });
execSync(`git commit -m "release: v${newVersion}"`, { stdio: "inherit" });
execSync(`git tag "v${newVersion}"`, { stdio: "inherit" });
execSync("git push origin main", { stdio: "inherit" });
execSync(`git push origin "v${newVersion}"`, { stdio: "inherit" });

console.log(`\nDone! v${newVersion} pushed.`);
console.log("GitHub Actions will build and create the release.");
console.log("Check: https://github.com/BlueMilkyh/FinkSpace/actions");
