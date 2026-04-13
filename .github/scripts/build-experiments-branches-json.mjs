import fs from "node:fs";

const repositoryName = process.env.REPO_NAME ?? "";
const branchListFile = process.env.BRANCH_LIST_FILE ?? "";
const outputFile = process.env.BRANCHES_JSON_FILE ?? "";

if (branchListFile.trim() === "") {
  throw new Error("BRANCH_LIST_FILE is required.");
}

if (outputFile.trim() === "") {
  throw new Error("BRANCHES_JSON_FILE is required.");
}

const branchLines = fs
  .readFileSync(branchListFile, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const isValidSegment = (value) =>
  value.length > 0 && !value.includes("/") && /^[A-Za-z0-9._-]+$/.test(value);

const branches = branchLines.map((branch) => {
  const suffix = branch.startsWith("experiments/")
    ? branch.slice("experiments/".length)
    : branch;
  const deployable = isValidSegment(suffix);
  const branchData = {
    name: branch,
    deployable,
  };

  if (deployable) {
    branchData.path = `/${repositoryName}/experiments/${suffix}/`;
  }

  return branchData;
});

const payload = {
  generatedAt: new Date().toISOString(),
  branches,
};

fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
