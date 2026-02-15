import { describe, it, expect } from "vitest";
import { formatDate, timeAgo, formatDuration, phaseColor } from "@/lib/utils";

describe("formatDate", () => {
  it("returns dash for undefined", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate(null)).toBe("-");
  });

  it("formats valid date", () => {
    const result = formatDate("2025-06-15T14:30:00Z");
    expect(result).toContain("2025-06-15");
    // Time depends on local timezone, just check it has HH:mm:ss format
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe("timeAgo", () => {
  it("returns dash for undefined", () => {
    expect(timeAgo(undefined)).toBe("-");
    expect(timeAgo(null)).toBe("-");
  });

  it("returns relative time for valid date", () => {
    const recent = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    const result = timeAgo(recent);
    expect(result).toContain("minute");
  });
});

describe("formatDuration", () => {
  it("returns dash when missing start or end", () => {
    expect(formatDuration(null, null)).toBe("-");
    expect(formatDuration("2025-01-01T00:00:00Z", null)).toBe("-");
    expect(formatDuration(null, "2025-01-01T00:00:00Z")).toBe("-");
  });

  it("formats seconds", () => {
    const start = "2025-01-01T00:00:00Z";
    const end = "2025-01-01T00:00:45Z";
    expect(formatDuration(start, end)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    const start = "2025-01-01T00:00:00Z";
    const end = "2025-01-01T00:05:30Z";
    expect(formatDuration(start, end)).toBe("5m 30s");
  });

  it("formats hours and minutes", () => {
    const start = "2025-01-01T00:00:00Z";
    const end = "2025-01-01T02:15:00Z";
    expect(formatDuration(start, end)).toBe("2h 15m");
  });
});

describe("phaseColor", () => {
  it("returns green for Completed", () => {
    expect(phaseColor("Completed")).toBe("green");
  });

  it("returns green for Available", () => {
    expect(phaseColor("Available")).toBe("green");
  });

  it("returns red for Failed", () => {
    expect(phaseColor("Failed")).toBe("red");
  });

  it("returns orange for PartiallyFailed", () => {
    expect(phaseColor("PartiallyFailed")).toBe("orange");
  });

  it("returns blue for InProgress", () => {
    expect(phaseColor("InProgress")).toBe("blue");
  });

  it("returns blue for New", () => {
    expect(phaseColor("New")).toBe("blue");
  });

  it("returns yellow for Deleting", () => {
    expect(phaseColor("Deleting")).toBe("yellow");
  });

  it("returns gray for unknown", () => {
    expect(phaseColor("SomethingElse")).toBe("gray");
    expect(phaseColor("")).toBe("gray");
  });
});
