const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
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
    const id = "a1111111-1111-4111-8111-111111111111";
    let orders = [],
      commands = [],
      failMarket = false;
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
      else if (p === "/trade/markets") {
        if (failMarket)
          return route.fulfill({ status: 503, body: "Unavailable" });
        data = [
          {
            id,
            name: "Kylian Mbappé",
            price: 102,
            change: 2,
            changePercent: 2,
            volume: 12500,
            initial_price: 100,
            total_supply: 1000,
          },
          {
            id: "b1111111-1111-4111-8111-111111111111",
            name: "Emerging Music",
            price: 80,
            change: -3,
            changePercent: -3.61,
            volume: 6000,
            initial_price: 83,
            total_supply: 1000,
          },
        ];
      } else if (p.startsWith("/trade/history/"))
        data = [
          { timestamp: "2026-10-01T12:00:00Z", close: 100 },
          { timestamp: "2026-10-01T13:00:00Z", close: 101 },
          { timestamp: "2026-10-01T14:00:00Z", close: 100.5 },
          { timestamp: "2026-10-01T15:00:00Z", close: 102 },
        ];
      else if (p.startsWith("/trade/book/"))
        data = {
          cursor: "1",
          book: {
            buys: [
              { price: "101.00", quantity: "15.0000" },
              { price: "100.00", quantity: "24.0000" },
            ],
            sells: [
              { price: "103.00", quantity: "20.0000" },
              { price: "104.00", quantity: "12.0000" },
            ],
          },
        };
      else if (p.startsWith("/trade/buy/")) {
        commands.push({
          body: req.postDataJSON(),
          key: req.headers()["idempotency-key"],
        });
        orders = [
          {
            id: "order-1",
            asset_id: id,
            side: "BUY",
            type: "LIMIT",
            price: "99.00",
            initial_quantity: "2",
            remaining_quantity: "2",
            status: "OPEN",
          },
        ];
        data = { orderId: "order-1", status: "OPEN", filledQuantity: "0" };
      } else if (p === "/trade/orders") data = orders;
      else if (p === "/trade/order/order-1" && req.method() === "DELETE") {
        orders = orders.map((o) => ({ ...o, status: "CANCELLED" }));
        data = { orderId: "order-1", status: "CANCELLED" };
      } else if (p === "/trade/account")
        data = {
          wallet: { balance: "10000", frozen_balance: "198" },
          positions: [
            {
              assetId: id,
              name: "Kylian Mbappé",
              quantity: 10,
              reservedQuantity: 0,
              averageBuyPrice: 100,
              currentValue: 1020,
              profitLoss: 20,
              realizedPnl: 0,
            },
          ],
        };
      else if (p === "/portfolio") data = [];
      else if (p === "/assets/admin/all") data = [];
      else if (p === "/trade/feed-snapshot") data = { cursor: "0", events: [] };
      else if (p === "/trade/events")
        data = { events: [], nextCursor: "0", hasMore: false };
      else if (p.startsWith("/research/")) data = [];
      else if (p.startsWith("/socket.io")) return route.abort();
      else return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const shot = async (name) => {
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: path.join(process.env.SCREENSHOT_DIR, `${name}.png`),
          fullPage: true,
        });
      }
    };
    const noOverflow = async () =>
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
    await page.goto(
      `${process.env.UI_BASE_URL || "http://127.0.0.1:5175"}/?tab=explore`,
    );
    await page
      .getByRole("button", { name: "Trade Kylian Mbappé", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("navigation", { name: "Desktop navigation" })
        .isVisible(),
      true,
    );
    await shot("silver-market-desktop");
    await page.getByLabel("Search assets").fill("music");
    assert.equal(
      await page
        .getByRole("button", { name: "Trade Kylian Mbappé", exact: true })
        .count(),
      0,
    );
    await page.getByLabel("Search assets").fill("");
    await page.getByLabel("Sort assets").selectOption("losers");
    assert.match(
      await page.locator("tbody tr").first().innerText(),
      /Emerging Music/,
    );
    await page
      .getByRole("button", { name: "Trade Kylian Mbappé", exact: true })
      .click();
    await page.getByRole("heading", { name: "Price Chart" }).waitFor();
    await page.locator(".recharts-line-curve").waitFor();
    await page.getByRole("button", { name: "Limit", exact: true }).click();
    await page.getByLabel("Quantity (Shares)").fill("2");
    await page.getByLabel("Limit price ($)").fill("99");
    await shot("silver-trading-desktop");
    await page
      .getByRole("button", { name: "Buy Kylian Mbappé", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
    assert.equal(commands.length, 1);
    assert.deepEqual(commands[0].body, {
      assetAmount: 2,
      price: 99,
      type: "LIMIT",
    });
    assert.ok(commands[0].key);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("cell", { name: "CANCELLED", exact: true }).waitFor();
    await page
      .getByRole("navigation", { name: "Desktop navigation" })
      .getByRole("button", { name: "Portfolio", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Positions", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Price Chart" }).count(),
      0,
    );
    await shot("silver-portfolio-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    assert.equal(
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .isVisible(),
      true,
    );
    assert.equal(
      await page
        .getByRole("navigation", { name: "Desktop navigation" })
        .isVisible(),
      false,
    );
    await shot("silver-portfolio-mobile");
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await nav.getByRole("button", { name: "Market", exact: true }).click();
    await page.getByLabel("Search assets").waitFor();
    await noOverflow();
    await shot("silver-market-mobile");
    await page
      .getByRole("button", { name: "Trade Kylian Mbappé", exact: true })
      .click();
    await page.getByRole("heading", { name: "Price Chart" }).waitFor();
    await noOverflow();
    await shot("silver-trading-mobile");
    await nav.getByRole("button", { name: "Market", exact: true }).click();
    failMarket = true;
    await page
      .getByRole("alert")
      .filter({ hasText: "Market data unavailable" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Trade Kylian Mbappé", exact: true })
        .count(),
      1,
    );
    await nav.getByRole("button", { name: "Research", exact: true }).click();
    await page.getByRole("heading", { name: "My experiments" }).waitFor();
    await page
      .getByRole("button", { name: "New experiment", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("Mobile experiment");
    for (const name of [
      "Assets",
      "Population",
      "Information",
      "Question & timing",
    ]) {
      await page
        .getByRole("navigation", { name: "Experiment setup" })
        .getByRole("button", { name, exact: false })
        .click();
      await noOverflow();
    }
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      "Mobile experiment",
    );
    await shot("silver-research-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot("silver-research-desktop");
    assert.deepEqual(errors, []);
    console.log(
      "Market sorting/search, real chart mapping, limit-order payload/idempotency, cancellation, portfolio navigation, stale-data notice and mobile layouts passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
