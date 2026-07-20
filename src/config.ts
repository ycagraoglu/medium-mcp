import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dataDirectory = resolve(process.cwd(), ".data");
mkdirSync(dataDirectory, { recursive: true });

export const config = {
  dataDirectory,
  sessionPath: resolve(dataDirectory, "medium-session.json"),
  browserProfilePath: resolve(dataDirectory, "browser-profile"),
  headless: process.env.MEDIUM_HEADLESS !== "false",
  browserChannel: process.env.MEDIUM_BROWSER_CHANNEL || "auto",
  navigationTimeoutMs: Number(process.env.MEDIUM_NAVIGATION_TIMEOUT_MS || 30_000),
  maxSearchResults: 20,
  maxArticleCharacters: 120_000
} as const;
