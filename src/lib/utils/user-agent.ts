/**
 * Human-readable description of a browser user-agent string,
 * e.g. "Chrome on Windows" or "Safari on iOS".
 *
 * Detection order matters: Chromium-based browsers (Edge, Opera) embed
 * "Chrome/" in their UA, and every WebKit browser embeds "Safari/", so the
 * more specific tokens must be checked first.
 */

interface UaToken {
  token: string;
  label: string;
}

const BROWSER_TOKENS: readonly UaToken[] = [
  { token: "Edg/", label: "Edge" },
  { token: "OPR/", label: "Opera" },
  { token: "SamsungBrowser/", label: "Samsung Internet" },
  { token: "Firefox/", label: "Firefox" },
  { token: "Chrome/", label: "Chrome" },
  { token: "Safari/", label: "Safari" },
];

const OS_TOKENS: readonly UaToken[] = [
  { token: "Windows NT", label: "Windows" },
  { token: "iPhone", label: "iOS" },
  { token: "iPad", label: "iPadOS" },
  { token: "Android", label: "Android" },
  { token: "Mac OS X", label: "macOS" },
  { token: "CrOS", label: "ChromeOS" },
  { token: "Linux", label: "Linux" },
];

function matchToken(ua: string, tokens: readonly UaToken[]): string | null {
  const hit = tokens.find((t) => ua.includes(t.token));
  return hit?.label ?? null;
}

export function describeUserAgent(userAgent: string): string {
  const ua = userAgent.trim();
  if (!ua) return "Unknown device";

  const browser = matchToken(ua, BROWSER_TOKENS);
  const os = matchToken(ua, OS_TOKENS);

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "Unknown device";
}
