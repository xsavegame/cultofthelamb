import fs from "node:fs";
import path from "node:path";

async function main() {
  const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const destination = path.join("public", "contributors.json");

  fs.mkdirSync(path.dirname(destination), { recursive: true });

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/contributors?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "pages-build-sync",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const payload = await response.json();
    const contributors = Array.isArray(payload) ? payload : [];

    const filtered = contributors
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        login: String(entry.login ?? "").trim(),
        type: String(entry.type ?? "").trim(),
      }))
      .filter((entry) => entry.login.length > 0)
      .filter((entry) => entry.type.toLowerCase() !== "bot")
      .filter((entry) => !entry.login.toLowerCase().endsWith("[bot]"))
      .filter((entry) => entry.login.toLowerCase() !== owner.toLowerCase())
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
