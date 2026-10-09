const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let experiments = [],
      runs = [];
    await page.addInitScript(() =>
      localStorage.setItem("authToken", "ui-fixture"),
    );
    await page.route("**/*", async (route) => {
      const req = route.request(),
        u = new URL(req.url()),
        p = u.pathname;
      let data;
      if (p === "/auth/me")
        data = {
          user: {
            id: "test-user",
            name: "Researcher",
            email: "test@example.test",
            role: "admin",
          },
        };
      else if (p === "/wallet/balance") data = { balance: "10000" };
      else if (p === "/research/catalogue") data = [];
      else if (p === "/research/strategies")
        data = [
          { id: "idle", fixture: true },
          { id: "scripted", fixture: true },
        ];
      else if (p === "/research/experiments") {
        if (req.method() === "POST") {
          data = { id: "experiment-1", ...req.postDataJSON() };
          experiments = [data];
        } else data = experiments;
      } else if (p === "/research/experiments/experiment-1") {
        data = { id: "experiment-1", ...req.postDataJSON() };
        experiments = [data];
      } else if (p === "/research/experiments/experiment-1/runs") {
        const id = "run-" + runs.length;
        const m = { ...experiments[0].manifest, seed: req.postDataJSON().seed };
        runs.push({
          id,
          experiment_id: "experiment-1",
          manifest: m,
          status: "COMPLETED",
          created_at: new Date().toISOString(),
          progress: { tick: 10000 },
          result: {
            economicHash: "fixture-only",
            samples: [
              {
                tick: 0,
                assets: { a: { reference: 100, mid: null, spread: null } },
              },
              {
                tick: 10000,
                assets: { a: { reference: 101, mid: 100.5, spread: 1 } },
              },
            ],
            metrics: {
              a: { meanSpread: 1, emptyBookFraction: 0.5, referenceRmse: 0.5 },
            },
            cohorts: {
              agents: { pnl: 1, initialWealth: 4000, finalWealth: 4001 },
            },
            report: {
              books: {
                a: {
                  buys: [{ price: "100.00", quantity: "1.0000" }],
                  sells: [{ price: "101.00", quantity: "2.0000" }],
                },
              },
              trades: [],
            },
          },
        });
        data = { id };
      } else if (p === "/research/runs") data = runs;
      else if (p.startsWith("/research/runs/"))
        data = runs.find((r) => p.endsWith(r.id));
      else if (p === "/trade/feed-snapshot") data = { cursor: "0", events: [] };
      else if (p === "/trade/events")
        data = { events: [], nextCursor: "0", hasMore: false };
      else return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto(process.env.UI_BASE_URL || "http://127.0.0.1:5175/");
    await page
      .getByRole("heading", { name: "My experiments", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "New experiment", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("Liquidity test");
    await page
      .getByLabel("Hypothesis", { exact: true })
      .fill("More participation may improve liquidity.");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor();

    await page.getByRole("button", { name: "Queue runs", exact: true }).click();
    await page
      .getByRole("heading", { name: "Run history", exact: true })
      .waitFor();
    assert.equal(runs.length, 3);
    await page
      .getByRole("button", { name: "Inspect", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Measurements", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Runs", exact: true }).click();
    await page
      .getByRole("button", { name: "Compare", exact: true })
      .nth(1)
      .click();
    await page
      .getByRole("button", { name: "Compare", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Compare completed runs", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false);
    assert.deepEqual(errors, []);
    console.log(
      "UI flow passed: save, repeated seeds, results, comparison, mobile width; no runtime errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
