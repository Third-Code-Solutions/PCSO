import { describe, it, expect } from "vitest";
import { describeUserAgent } from "./user-agent";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const OPERA_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0";

describe("describeUserAgent", () => {
  it("identifies Chrome on Windows", () => {
    expect(describeUserAgent(CHROME_WIN)).toBe("Chrome on Windows");
  });

  it("identifies Edge on Windows (not Chrome, despite Chrome token)", () => {
    expect(describeUserAgent(EDGE_WIN)).toBe("Edge on Windows");
  });

  it("identifies Opera on Windows (not Chrome, despite Chrome token)", () => {
    expect(describeUserAgent(OPERA_WIN)).toBe("Opera on Windows");
  });

  it("identifies Firefox on Linux", () => {
    expect(describeUserAgent(FIREFOX_LINUX)).toBe("Firefox on Linux");
  });

  it("identifies Safari on macOS (not Chrome)", () => {
    expect(describeUserAgent(SAFARI_MAC)).toBe("Safari on macOS");
  });

  it("identifies Safari on iOS (iPhone beats Mac OS X token)", () => {
    expect(describeUserAgent(SAFARI_IPHONE)).toBe("Safari on iOS");
  });

  it("identifies Chrome on Android (Android beats Linux token)", () => {
    expect(describeUserAgent(CHROME_ANDROID)).toBe("Chrome on Android");
  });

  it("returns browser only when OS is unrecognized", () => {
    expect(describeUserAgent("SomeBot Firefox/1.0")).toBe("Firefox");
  });

  it("returns OS only when browser is unrecognized", () => {
    expect(describeUserAgent("curl-ish Windows NT client")).toBe("Windows");
  });

  it("returns Unknown device for empty input", () => {
    expect(describeUserAgent("")).toBe("Unknown device");
    expect(describeUserAgent("   ")).toBe("Unknown device");
  });

  it("returns Unknown device for unrecognizable input", () => {
    expect(describeUserAgent("curl/8.4.0")).toBe("Unknown device");
  });
});
