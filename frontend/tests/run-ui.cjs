// Run against a production preview with API fixtures; no backend or real account is used.
const { spawn } = require("node:child_process");
const path = require("node:path");
const server = spawn(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve("vite/package.json")),
      "bin/vite.js",
    ),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5186",
    "--strictPort",
  ],
  { stdio: "inherit" },
);
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error("Preview server exited");
      try {
        if ((await fetch("http://127.0.0.1:5186")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("Preview did not become ready");
    for (const test of ["research-ui.cjs", "market-ui.cjs"])
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, test)], {
          stdio: "inherit",
          env: { ...process.env, UI_BASE_URL: "http://127.0.0.1:5186" },
        });
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0 ? resolve() : reject(Error(`${test} failed (${code})`)),
        );
      });
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
