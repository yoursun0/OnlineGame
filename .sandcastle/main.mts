/**
 * Sandcastle entrypoint for OnlineGame — Grok CLI + noSandbox by default.
 *
 * Cloud host has no Docker. Default sandbox is noSandbox().
 * Set SANDCASTLE_SANDBOX=docker to use the Docker provider (requires Docker).
 *
 * Run: bun run sandcastle
 *
 * Do NOT point this at a live AFK issue-fixing loop against open issues
 * unless you intend to burn tokens — scaffold + smoke only for now.
 */
import { run } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { grok } from "./grok-provider.ts";

const sandboxMode = (process.env.SANDCASTLE_SANDBOX ?? "none").toLowerCase();

const sandbox =
  sandboxMode === "docker"
    ? docker({
        imageName:
          process.env.SANDCASTLE_IMAGE_NAME ?? "sandcastle:onlinegame",
      })
    : noSandbox();

if (sandboxMode !== "docker" && sandboxMode !== "none") {
  console.warn(
    `[sandcastle] Unknown SANDCASTLE_SANDBOX=${sandboxMode}; using noSandbox(). Expected: none | docker`,
  );
}

await run({
  name: "grok-worker",
  agent: grok({
    model: process.env.GROK_MODEL ?? "grok-4.6",
  }),
  sandbox,
  promptFile: "./.sandcastle/prompt.md",
  // AFK runs: raise via SANDCASTLE_MAX_ITERATIONS (default 1 for smoke).
  maxIterations: Number(process.env.SANDCASTLE_MAX_ITERATIONS ?? "1"),
  // Named branch — Paddy reviews PR; do not auto-merge to main.
  branchStrategy: {
    type: "branch",
    branch:
      process.env.SANDCASTLE_BRANCH ??
      `sandcastle/hud-${new Date().toISOString().slice(0, 10)}`,
    baseBranch: "main",
  },
  copyToWorktree: ["node_modules"],
  hooks: {
    sandbox: {
      // bun install is the repo package manager; safety net after copyToWorktree.
      onSandboxReady: [{ command: "bun install" }],
    },
  },
});
