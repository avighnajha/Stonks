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
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let failAccount = false;
    let account = {
      wallet: { balance: "8800.000000", frozen_balance: "200.000000" },
      positions: [
        {
          quantity: "10.0000",
          availableQuantity: "6.0000",
          reservedQuantity: "4.0000",
          averageBuyPrice: "100.00000000",
          currentValue: "1200.000000",
        },
      ],
    };
    await page.addInitScript(() =>
      localStorage.setItem("authToken", "profile-fixture"),
    );
    await page.route("**/*", async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === "/auth/me")
        return route.fulfill({
          json: {
            user: {
              id: "profile-user",
              name: "Researcher",
              email: "profile@example.test",
              role: "user",
            },
          },
        });
      if (p === "/wallet/balance")
        return route.fulfill({ json: account.wallet });
      if (p === "/trade/account")
        return failAccount
          ? route.fulfill({ status: 503, body: "Unavailable" })
          : route.fulfill({ json: account });
      if (p === "/trade/markets") return route.fulfill({ json: [] });
      if (p === "/trade/feed-snapshot")
        return route.fulfill({ json: { cursor: "0", events: [] } });
      if (p === "/trade/events")
        return route.fulfill({
          json: { events: [], nextCursor: "0", hasMore: false },
        });
      if (p.startsWith("/socket.io")) return route.abort();
      return route.continue();
    });
    await page.goto(
      `${process.env.UI_BASE_URL || "http://127.0.0.1:5186"}/?tab=explore`,
    );
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    const dialog = page.getByRole("dialog");
    // Filled holdings count at cost, including reserved units; neither current marks nor pending buys count.
    await dialog
      .getByText("$1,000.00", { exact: true })
      .waitFor({ timeout: 5000 });
    await dialog.getByText("$8,800.00", { exact: true }).waitFor();
    assert.equal(
      await dialog.getByText("$1,200.00", { exact: true }).count(),
      0,
    );

    account.positions[0] = {
      ...account.positions[0],
      quantity: "20.0000",
      availableQuantity: "16.0000",
      averageBuyPrice: "107.50000000",
      currentValue: "2400.000000",
    };
    account.wallet.balance = "7650.000000";
    await page.evaluate(() =>
      window.dispatchEvent(new Event("portfolio:updated")),
    );
    await dialog.getByText("$2,150.00", { exact: true }).waitFor();
    await dialog.getByText("$7,650.00", { exact: true }).waitFor();

    // Cancelling an unfilled buy releases cash without changing invested capital.
    account.wallet = { balance: "7850.000000", frozen_balance: "0.000000" };
    await page.evaluate(() =>
      window.dispatchEvent(new Event("portfolio:updated")),
    );
    await dialog.getByText("$7,850.00", { exact: true }).waitFor();
    assert.equal(
      await dialog.getByText("$2,150.00", { exact: true }).count(),
      1,
    );

    failAccount = true;
    await page.evaluate(() =>
      window.dispatchEvent(new Event("portfolio:updated")),
    );
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Account data unavailable" })
      .waitFor();
    assert.equal(
      await dialog.getByText("$2,150.00", { exact: true }).count(),
      1,
    );
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Account data unavailable" })
      .waitFor();
    assert.equal(await dialog.getByText("$0.00", { exact: true }).count(), 0);

    failAccount = false;
    account = {
      wallet: { balance: "10000.000000", frozen_balance: "0.000000" },
      positions: [],
    };
    await page.evaluate(() =>
      window.dispatchEvent(new Event("portfolio:updated")),
    );
    await dialog.getByText("$0.00", { exact: true }).waitFor();
    await dialog.getByText("$10,000.00", { exact: true }).waitFor();
    assert.equal(await dialog.getByRole("alert").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "Profile account regression passed: cost basis, reserved inventory, trade/cancel refresh, failed reads and empty holdings.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
