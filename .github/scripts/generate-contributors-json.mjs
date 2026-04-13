import fs from "node:fs";
import path from "node:path";

function normalizeLogin(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "pages-build-sync",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API responded with ${response.status} for ${url}`);
  }

  return await response.json();
}

async function collectExcludedOwners(repository, token) {
  const excluded = new Set();
  const repositoryOwner = normalizeLogin(process.env.GITHUB_REPOSITORY_OWNER);
  const ownerFromRepoEnv = normalizeLogin(repository.split("/")[0]);
  const ownerFromCustomEnv = normalizeLogin(process.env.VITE_APP_OWNER);

  if (repositoryOwner) {
    excluded.add(repositoryOwner);
  }
  if (ownerFromRepoEnv) {
    excluded.add(ownerFromRepoEnv);
  }
  if (ownerFromCustomEnv) {
    excluded.add(ownerFromCustomEnv);
  }

  try {
    const repoPayload = await fetchJson(`https://api.github.com/repos/${repository}`, token);
    const repoOwnerLogin = normalizeLogin(repoPayload?.owner?.login);
    const repoOwnerType = String(repoPayload?.owner?.type ?? "").trim().toLowerCase();

    if (repoOwnerLogin) {
      excluded.add(repoOwnerLogin);
    }

    // For organization-owned repos, exclude org owners too (best effort).
    if (repoOwnerType === "organization" && repoOwnerLogin) {
      const orgOwnersPayload = await fetchJson(
        `https://api.github.com/orgs/${repoOwnerLogin}/members?role=admin&per_page=100`,
        token,
      );

      if (Array.isArray(orgOwnersPayload)) {
        for (const ownerEntry of orgOwnersPayload) {
          const ownerLogin = normalizeLogin(ownerEntry?.login);
          if (ownerLogin) {
            excluded.add(ownerLogin);
          }
        }
      }
    }
  } catch (error) {
    // Keep generating contributors even if owner lookup is unavailable.
    console.warn(
      `Owner exclusion enrichment failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return excluded;
}

async function main() {
  const token = process.env.GITHUB_TOKEN ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const destination = path.join("public", "contributors.json");

  fs.mkdirSync(path.dirname(destination), { recursive: true });

  try {
    const excludedOwners = await collectExcludedOwners(repository, token);
    const payload = await fetchJson(
      `https://api.github.com/repos/${repository}/contributors?per_page=100`,
      token,
    );
    const contributors = Array.isArray(payload) ? payload : [];

    const filtered = contributors
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        login: String(entry.login ?? "").trim(),
        normalizedLogin: normalizeLogin(entry.login),
        type: String(entry.type ?? "").trim(),
      }))
      .filter((entry) => entry.login.length > 0)
      .filter((entry) => entry.type.toLowerCase() !== "bot")
      .filter((entry) => !entry.login.toLowerCase().endsWith("[bot]"))
      .filter((entry) => !excludedOwners.has(entry.normalizedLogin))
      .slice(0, 5)
      .map((entry) => entry.login);

    fs.writeFileSync(
      destination,
      `${JSON.stringify({ contributors: filtered }, null, 2)}\n`,
    );
  } catch (error) {
    console.warn(
      `Failed to fetch contributors: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    fs.writeFileSync(
      destination,
      `${JSON.stringify({ contributors: [] }, null, 2)}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
