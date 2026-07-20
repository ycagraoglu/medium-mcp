import { chromium } from "playwright";
import { config } from "../src/config.js";

async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless: false,
    channel: config.browserChannel
  });

  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();

  console.log("Opening Medium sign-in page...");
  console.log("Complete Google sign-in and any 2FA steps manually in the opened browser.");
  console.log("No Google password is read or stored by this script.");

  await page.goto("https://medium.com/m/signin", {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs
  });

  const deadline = Date.now() + 10 * 60_000;
  let loggedIn = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2_000);

    const currentUrl = page.url();
    const hasUserMenu = await page
      .locator("[data-testid='headerUserButton'], [data-testid='user-menu'], a[href='/me/stories']")
      .first()
      .isVisible()
      .catch(() => false);

    if (!currentUrl.includes("/m/signin") && hasUserMenu) {
      loggedIn = true;
      break;
    }
  }

  if (!loggedIn) {
    await browser.close();
    throw new Error("Medium login was not detected within 10 minutes.");
  }

  await context.storageState({ path: config.sessionPath });
  console.log(`Medium session saved locally: ${config.sessionPath}`);
  console.log("Keep this file private. It is excluded from Git by .gitignore.");

  await browser.close();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
