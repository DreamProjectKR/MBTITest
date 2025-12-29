import { spawn } from "node:child_process";

function run(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: "inherit" });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });
  return child;
}

const useD1 = process.argv.includes("--d1");

const buildChild = run(
  "node",
  ["scripts/build-scripts.mjs", "--watch"],
  "build:scripts",
);

const wranglerArgs = [
  "pages",
  "dev",
  "./public",
  "--compatibility-date=2024-12-08",
];
if (useD1) {
  wranglerArgs.push(
    "--d1",
    "MBTI_DB=mbti-db",
    "--persist-to",
    ".wrangler/state",
  );
}

const wranglerChild = run("wrangler", wranglerArgs, "wrangler");

function shutdown() {
  try {
    buildChild.kill("SIGINT");
  } catch {}
  try {
    wranglerChild.kill("SIGINT");
  } catch {}
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});


