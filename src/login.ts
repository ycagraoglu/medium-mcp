import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { MediumBrowserClient } from "./medium-browser.js";

const browser = new MediumBrowserClient();
const readline = createInterface({ input, output });

try {
  console.log(await browser.login());
  console.log();
  await readline.question(
    "Google girişini tamamlayın, Medium profilinizi gördükten sonra açılan Edge penceresini tamamen kapatın ve ENTER'a basın...",
  );

  const session = await browser.checkSession();

  if (!session.loggedIn) {
    console.error(
      "Medium oturumu doğrulanamadı. Giriş tamamlanmamış, Edge tamamen kapanmamış veya Medium arayüzü değişmiş olabilir.",
    );
    process.exitCode = 1;
  } else {
    console.log("Medium oturumu hazır. MCP istemcisini kullanabilirsiniz.");
  }
} finally {
  readline.close();
  await browser.close();
}
