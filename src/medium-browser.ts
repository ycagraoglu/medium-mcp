import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
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

export class MediumBrowserClient {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async open(): Promise<void> {
    if (this.context && this.page && !this.page.isClosed()) {
      return;
    }

    await mkdir(PROFILE_DIR, { recursive: true });

    const channel = process.env.MEDIUM_BROWSER_CHANNEL?.trim() || "msedge";
    const headless = process.env.MEDIUM_HEADLESS === "true";

    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel,
      headless,
      viewport: { width: 1440, height: 1000 },
      locale: "tr-TR",
      args: ["--no-first-run", "--no-default-browser-check"],
    });

    const existingPages = this.context.pages();
    this.page = existingPages[0] ?? (await this.context.newPage());
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }

  async login(): Promise<string> {
    if (process.env.MEDIUM_HEADLESS === "true") {
      throw new Error("Google ile ilk giriş için MEDIUM_HEADLESS kapalı olmalıdır.");
    }

    const page = await this.getPage();
    await page.goto(MEDIUM_SIGN_IN, { waitUntil: "domcontentloaded" });

    return [
      "Medium giriş sayfası gerçek Microsoft Edge penceresinde açıldı.",
      "Continue with Google seçeneğini kullanarak giriş işlemini kendiniz tamamlayın.",
      "Bu proje Google kullanıcı adınızı, parolanızı veya doğrulama kodunuzu okumaz.",
      "Başarılı oturum bu projeye özel .data/medium-profile klasöründe kalıcı olarak saklanacaktır.",
      "Sonraki MCP çağrıları aynı Edge profilini yeniden kullanacaktır.",
    ].join("\n");
  }

  async checkSession(): Promise<{ loggedIn: boolean; url: string }> {
    const page = await this.getPage();
    await page.goto(MEDIUM_HOME, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

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
