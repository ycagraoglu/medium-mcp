import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ResolvedBrowser {
  name: string;
  channel?: "chrome" | "msedge";
  executablePath?: string;
}

function firstExistingPath(paths: string[]): string | undefined {
  return paths.find(path => existsSync(path));
}

function windowsProgramFilesPaths(relativePath: string): string[] {
  return [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA
  ]
    .filter((value): value is string => Boolean(value))
    .map(basePath => join(basePath, relativePath));
}

function resolveWindowsDefaultBrowser(): ResolvedBrowser {
  let output = "";

  try {
    output = execFileSync(
      "reg",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
        "/v",
        "ProgId"
      ],
      { encoding: "utf8", windowsHide: true }
    );
  } catch {
    throw new Error(
      "Windows default browser could not be detected. Set MEDIUM_BROWSER_CHANNEL=msedge or MEDIUM_BROWSER_CHANNEL=chrome."
    );
  }

  const progId = output.match(/ProgId\s+REG_SZ\s+(.+)$/im)?.[1]?.trim() ?? "";
  const normalizedProgId = progId.toLowerCase();

  if (normalizedProgId.includes("msedge")) {
    return { name: "Microsoft Edge", channel: "msedge" };
  }

  if (normalizedProgId.includes("chrome")) {
    return { name: "Google Chrome", channel: "chrome" };
  }

  if (normalizedProgId.includes("brave")) {
    const executablePath = firstExistingPath(
      windowsProgramFilesPaths("BraveSoftware\\Brave-Browser\\Application\\brave.exe")
    );

    if (executablePath) {
      return { name: "Brave", executablePath };
    }
  }

  if (normalizedProgId.includes("vivaldi")) {
    const executablePath = firstExistingPath(
      windowsProgramFilesPaths("Vivaldi\\Application\\vivaldi.exe")
    );

    if (executablePath) {
      return { name: "Vivaldi", executablePath };
    }
  }

  if (normalizedProgId.includes("opera")) {
    const executablePath = firstExistingPath([
      ...windowsProgramFilesPaths("Opera\\launcher.exe"),
      ...windowsProgramFilesPaths("Opera GX\\launcher.exe")
    ]);

    if (executablePath) {
      return { name: "Opera", executablePath };
    }
  }

  if (normalizedProgId.includes("chromium")) {
    const executablePath = firstExistingPath(
      windowsProgramFilesPaths("Chromium\\Application\\chrome.exe")
    );

    if (executablePath) {
      return { name: "Chromium", executablePath };
    }
  }

  throw new Error(
    `Your default browser (${progId || "unknown"}) cannot currently be automated by this MCP. ` +
      "Supported default browsers are Edge, Chrome, Brave, Vivaldi, Opera and Chromium. " +
      "You can explicitly choose one with MEDIUM_BROWSER_CHANNEL=msedge or MEDIUM_BROWSER_CHANNEL=chrome."
  );
}

export function resolveBrowser(browserSetting: string): ResolvedBrowser {
  const normalizedSetting = browserSetting.trim().toLowerCase();

  if (normalizedSetting === "edge" || normalizedSetting === "msedge") {
    return { name: "Microsoft Edge", channel: "msedge" };
  }

  if (normalizedSetting === "chrome") {
    return { name: "Google Chrome", channel: "chrome" };
  }

  if (normalizedSetting && normalizedSetting !== "auto") {
    if (existsSync(browserSetting)) {
      return { name: browserSetting, executablePath: browserSetting };
    }

    throw new Error(
      `Unsupported MEDIUM_BROWSER_CHANNEL value: ${browserSetting}. Use auto, msedge, chrome, or a browser executable path.`
    );
  }

  if (process.platform === "win32") {
    return resolveWindowsDefaultBrowser();
  }

  throw new Error(
    "Automatic default-browser detection is currently supported on Windows. " +
      "Set MEDIUM_BROWSER_CHANNEL=chrome, MEDIUM_BROWSER_CHANNEL=msedge, or provide a browser executable path."
  );
}
