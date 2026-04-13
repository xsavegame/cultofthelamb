import fs from "node:fs";

const packageJsonPath = process.argv[2] ?? "package.json";
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
process.stdout.write(String(packageJson.version ?? ""));
