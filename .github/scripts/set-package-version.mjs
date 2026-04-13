import fs from "node:fs";

const version = process.argv[2];
const packageJsonPath = process.argv[3] ?? "package.json";

if (!version || version.trim() === "") {
  throw new Error("version argument is required.");
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
