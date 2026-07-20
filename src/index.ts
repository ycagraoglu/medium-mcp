import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MediumBrowserClient } from "./medium-browser.js";

const browser = new MediumBrowserClient();
const server = new McpServer({ name: "medium-mcp", version: "1.0.0" });

server.tool(
  "login_to_medium",
  "Open Medium's sign-in page in a dedicated persistent Microsoft Edge profile. The user can complete Google sign-in manually in the visible browser window.",
  {},
  async () => {
    try {
      const message = await browser.login();
      return { content: [{ type: "text", text: message }] };
    } catch (error) {
      return toolError("Medium login could not be opened", error);
    }
  },
);

server.tool(
  "check_medium_session",
  "Check whether the dedicated Medium browser profile appears to be signed in.",
  {},
  async () => {
    try {
      const result = await browser.checkSession();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return toolError("Medium session could not be checked", error);
    }
  },
);

server.tool(
  "get_medium_article",
  "Read a Medium article using the locally persisted Medium browser session and return Markdown.",
  {
    url: z.string().url().describe("HTTPS Medium article URL"),
  },
  async ({ url }) => {
    try {
      const article = await browser.readArticle(url);
      const header = [
        `# ${article.title}`,
        "",
        `URL: ${article.url}`,
        article.author ? `Author: ${article.author}` : undefined,
        article.publishedAt ? `Published: ${article.publishedAt}` : undefined,
        "",
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n");

      return {
        content: [{ type: "text", text: `${header}${article.markdown}` }],
      };
    } catch (error) {
      return toolError("Medium article could not be read", error);
    }
  },
);

server.tool(
  "search_medium",
  "Search Medium and return article titles, URLs, authors and excerpts.",
  {
    query: z.string().min(1).describe("Search text"),
    limit: z.number().int().min(1).max(20).optional().default(10),
  },
  async ({ query, limit }) => {
    try {
      const results = await browser.search(query, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return toolError("Medium search failed", error);
    }
  },
);

function toolError(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
  };
}

async function shutdown(): Promise<void> {
  await browser.close().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Medium MCP server is ready over stdio.");
