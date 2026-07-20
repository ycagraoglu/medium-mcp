import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import TurndownService from "turndown";

export interface MediumArticle {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  markdown: string;
}

export interface MediumSearchResult {
  title: string;
  url: string;
  author?: string;
  excerpt?: string;
}

const PROFILE_DIR = path.resolve(process.cwd(), ".data", "medium-profile");
const MEDIUM_HOME = "https://medium.com/";
const MEDIUM_SIGN_IN = "https://medium.com/m/signin";
const CDP_PORT = Number(process.env.MEDIUM_CDP_PORT ?? "9222");
const CDP_ENDPOINT = `http://127.0.0.1:${CDP_PORT}`;

export class MediumBrowserClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async login(): Promise<string> {
    await mkdir(PROFILE_DIR, { recursive: true });
    await ensureDebugEdgeRunning(MEDIUM_SIGN_IN);

    return [
      "Medium giriş sayfası normal Microsoft Edge penceresinde açıldı.",
      "Continue with Google seçeneğini kullanarak giriş işlemini tamamlayın.",
      "Cloudflare doğrulaması çıkarsa normal şekilde tamamlayın.",
      "Medium ana sayfasında profilinizi gördükten sonra Edge penceresini KAPATMAYIN.",
      "Terminale dönüp ENTER tuşuna basın.",
      "Oturum .data/medium-profile klasöründe saklanacaktır.",
    ].join("\n");
  }

  async open(): Promise<void> {
    if (this.browser?.isConnected() && this.context && this.page && !this.page.isClosed()) {
      return;
    }

    await mkdir(PROFILE_DIR, { recursive: true });
    await ensureDebugEdgeRunning(MEDIUM_HOME);

    this.browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    this.context = this.browser.contexts()[0] ?? null;

    if (!this.context) {
      throw new Error("Edge browser context could not be obtained.");
    }

    const existingPages = this.context.pages();
    this.page =
      existingPages.find((candidate) => candidate.url().includes("medium.com")) ??
      existingPages[0] ??
      (await this.context.newPage());
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async checkSession(): Promise<{ loggedIn: boolean; url: string }> {
    const page = await this.getPage();
    await page.goto(MEDIUM_HOME, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const loggedIn = await page.evaluate(() => {
      const selectors = [
        '[data-testid="headerUserButton"]',
        'a[href="/me/stories"]',
        'a[href^="/@"][aria-label]',
        'img[alt*="profile" i]',
      ];

      return selectors.some((selector) => document.querySelector(selector) !== null);
    });

    return { loggedIn, url: page.url() };
  }

  async readArticle(url: string): Promise<MediumArticle> {
    this.assertMediumUrl(url);

    const page = await this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);

    const extracted = await page.evaluate(() => {
      const article = document.querySelector("article");
      if (!article) {
        throw new Error("Medium article element could not be found.");
      }

      const clone = article.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          'button, nav, footer, [role="button"], [aria-label*="clap" i], [aria-label*="response" i], [data-testid*="postActions"]',
        )
        .forEach((element) => element.remove());

      const title =
        article.querySelector("h1")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        document.title.replace(/\s*[|–-]\s*Medium.*$/i, "").trim();

      const author =
        article.querySelector('a[rel="author"]')?.textContent?.trim() ||
        article.querySelector('a[href^="/@"]')?.textContent?.trim() ||
        undefined;

      const publishedAt =
        article.querySelector("time")?.getAttribute("datetime") ||
        document.querySelector("time")?.getAttribute("datetime") ||
        undefined;

      return {
        title,
        author,
        publishedAt,
        html: clone.innerHTML,
        textLength: clone.innerText.trim().length,
      };
    });

    if (!extracted.title) {
      throw new Error("Article title could not be found.");
    }

    if (extracted.textLength < 300) {
      throw new Error(
        "Article content is too short. The Medium session may not have access to the full article.",
      );
    }

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    turndown.addRule("mediumCodeBlock", {
      filter: (node) => node.nodeName === "PRE",
      replacement: (_content, node) => {
        const text = node.textContent?.trimEnd() ?? "";
        return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
      },
    });

    const markdown = turndown.turndown(extracted.html).trim();

    return {
      title: extracted.title,
      url: page.url().split("?")[0] ?? url,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      markdown,
    };
  }

  async search(query: string, limit: number): Promise<MediumSearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new Error("Search query is required.");
    }

    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const page = await this.getPage();
    const searchUrl = `https://medium.com/search?q=${encodeURIComponent(normalizedQuery)}`;

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1200);

    return page.evaluate((requestedLimit) => {
      const results: MediumSearchResult[] = [];
      const seen = new Set<string>();
      const candidates = Array.from(document.querySelectorAll("article"));

      for (const candidate of candidates) {
        const heading = candidate.querySelector("h2, h3");
        const anchor = heading?.closest("a") ?? candidate.querySelector('a[href*="medium.com"], a[href^="/"]');
        const href = anchor instanceof HTMLAnchorElement ? anchor.href : "";
        const title = heading?.textContent?.trim() ?? "";

        if (!href || !title || seen.has(href)) {
          continue;
        }

        seen.add(href);
        results.push({
          title,
          url: href.split("?")[0] ?? href,
          author: candidate.querySelector('a[href^="/@"]')?.textContent?.trim() || undefined,
          excerpt: candidate.querySelector("p")?.textContent?.trim() || undefined,
        });

        if (results.length >= requestedLimit) {
          break;
        }
      }

      return results;
    }, safeLimit);
  }

  private async getPage(): Promise<Page> {
    await this.open();

    if (!this.page || this.page.isClosed()) {
      if (!this.context) {
        throw new Error("Browser context is not available.");
      }

      this.page = await this.context.newPage();
    }

    return this.page;
  }

  private assertMediumUrl(value: string): void {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error("A valid Medium URL is required.");
    }

    const hostname = url.hostname.toLowerCase();
    const isMediumHost = hostname === "medium.com" || hostname.endsWith(".medium.com");

    if (url.protocol !== "https:" || !isMediumHost) {
      throw new Error("Only HTTPS Medium URLs are allowed.");
    }
  }
}

async function ensureDebugEdgeRunning(initialUrl: string): Promise<void> {
  if (await isCdpReady()) {
    return;
  }

  const edgeExecutable = await findEdgeExecutable();
  const child = spawn(
    edgeExecutable,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=*",
      `--user-data-dir=${PROFILE_DIR}`,
      "--new-window",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-mode",
      initialUrl,
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    },
  );

  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isCdpReady()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Edge debugging endpoint could not be opened at ${CDP_ENDPOINT}. Close every Edge window that uses .data/medium-profile, then run npm run login again.`,
  );
}

async function isCdpReady(): Promise<boolean> {
  try {
    const response = await fetch(`${CDP_ENDPOINT}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function findEdgeExecutable(): Promise<string> {
  const configured = process.env.MEDIUM_EDGE_PATH?.trim();
  const candidates = [
    configured,
    process.env["PROGRAMFILES(X86)"]
      ? path.join(process.env["PROGRAMFILES(X86)"]!, "Microsoft", "Edge", "Application", "msedge.exe")
      : undefined,
    process.env.PROGRAMFILES
      ? path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe")
      : undefined,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next installation path.
    }
  }

  throw new Error(
    "Microsoft Edge executable could not be found. Set MEDIUM_EDGE_PATH to the full msedge.exe path.",
  );
}
