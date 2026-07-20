import { chromium } from "playwright";
import { resolveBrowser } from "../src/browser-resolver.js";
import { config } from "../src/config.js";

type AuthMethod =
  | "auto"
  | "email"
  | "google"
  | "apple"
  | "facebook"
  | "twitter";

const supportedMethods = new Set<AuthMethod>([
  "auto",
  "email",
  "google",
  "apple",
  "facebook",
  "twitter"
]);

function getAuthMethod(): AuthMethod {
  const methodArgument = process.argv.find(argument => argument.startsWith("--method="));
  const method = (methodArgument?.split("=")[1]?.toLowerCase() ?? "auto") as AuthMethod;

  if (!supportedMethods.has(method)) {
    throw new Error(
      `Unsupported login method: ${method}. Supported methods: ${[...supportedMethods].join(", ")}`
    );
  }

  return method;
}

function printLoginInstructions(method: AuthMethod, browserName: string): void {
  console.log(`Opening Medium sign-in in your default browser: ${browserName}`);
  console.log("Complete the sign-in yourself in the opened browser window.");
  console.log("");

  switch (method) {
    case "email":
      console.log("Selected guidance: choose 'Sign in with email' and complete Medium's email verification flow.");
      break;
    case "google":
      console.log("Selected guidance: choose 'Sign in with Google' and complete Google authentication and 2FA manually.");
      break;
    case "apple":
      console.log("Selected guidance: choose 'Sign in with Apple' and complete Apple authentication manually.");
      break;
    case "facebook":
      console.log("Selected guidance: choose 'Sign in with Facebook' and complete Facebook authentication manually.");
      break;
    case "twitter":
      console.log("Selected guidance: choose 'Sign in with X' and complete X authentication manually.");
      break;
    case "auto":
      console.log("Selected guidance: use any sign-in option offered by Medium for your account.");
      break;
  }

  console.log("");
  console.log("No password, verification code, magic link, or 2FA value is read or stored by this script.");
  console.log("Only the resulting Medium browser session is saved locally after login succeeds.");
}

async function main(): Promise<void> {
  const authMethod = getAuthMethod();
  const resolvedBrowser = resolveBrowser(config.browserChannel);

  const context = await chromium.launchPersistentContext(config.browserProfilePath, {
    headless: false,
    channel: resolvedBrowser.channel,
    executablePath: resolvedBrowser.executablePath,
    locale: "en-US"
  });

  const existingPages = context.pages();
  const page = existingPages[0] ?? (await context.newPage());

  printLoginInstructions(authMethod, resolvedBrowser.name);

  await page.goto("https://medium.com/m/signin", {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs
  });

  const deadline = Date.now() + 15 * 60_000;
  let loggedIn = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2_000);

    for (const candidatePage of context.pages()) {
      const currentUrl = candidatePage.url();
      const isMediumPage = currentUrl.startsWith("https://medium.com");

      if (!isMediumPage || currentUrl.includes("/m/signin")) {
        continue;
      }

      const hasUserMenu = await candidatePage
        .locator(
          "[data-testid='headerUserButton'], [data-testid='user-menu'], [data-testid='write-button'], a[href='/me/stories']"
        )
        .first()
        .isVisible()
        .catch(() => false);

      if (hasUserMenu) {
        loggedIn = true;
        break;
      }
    }

    if (loggedIn) {
      break;
    }
  }

  if (!loggedIn) {
    await context.close();
    throw new Error("Medium login was not detected within 15 minutes.");
  }

  await context.storageState({ path: config.sessionPath });
  console.log(`Medium session saved locally: ${config.sessionPath}`);
  console.log(`Persistent browser profile: ${config.browserProfilePath}`);
  console.log("Keep these files private. They are excluded from Git by .gitignore.");

  await context.close();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
