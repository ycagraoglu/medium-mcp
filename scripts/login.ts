import { chromium } from "playwright";
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

function printLoginInstructions(method: AuthMethod): void {
  console.log("Opening Medium sign-in page in a real Chrome window...");
  console.log("Choose and complete the sign-in method yourself in the opened browser.");
  console.log("");
  console.log("Medium sign-in options shown on the login screen:");
  console.log("- Google");
  console.log("- Facebook");
  console.log("- Apple");
  console.log("- X");
  console.log("- Email");
  console.log("");

  switch (method) {
    case "email":
      console.log("Selected guidance: choose 'Sign in with email' and complete the email verification flow shown by Medium.");
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
  console.log("No password, email verification value, magic link, or 2FA value is read or stored by this script.");
  console.log("Only the resulting Medium browser session is saved locally after login succeeds.");
}

async function main(): Promise<void> {
  const authMethod = getAuthMethod();
  const browser = await chromium.launch({
    headless: false,
    channel: config.browserChannel
  });

  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();

  printLoginInstructions(authMethod);

  await page.goto("https://medium.com/m/signin", {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs
  });

  const deadline = Date.now() + 15 * 60_000;
  let loggedIn = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2_000);

    const pages = context.pages();

    for (const candidatePage of pages) {
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
    await browser.close();
    throw new Error("Medium login was not detected within 15 minutes.");
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
