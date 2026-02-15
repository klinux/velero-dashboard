import { describe, it, expect } from "vitest";
import { phaseColor } from "@/lib/utils";

// StatusBadge is a thin wrapper around Mantine Badge + phaseColor.
// Testing the logic (phaseColor) is more valuable than fighting jsdom CSS issues.
// Component rendering tests are covered by E2E tests.

describe("StatusBadge logic (phaseColor)", () => {
  it("maps Completed to green", () => {
    expect(phaseColor("Completed")).toBe("green");
  });

  it("maps Available to green", () => {
    expect(phaseColor("Available")).toBe("green");
  });

  it("maps Enabled to green", () => {
    expect(phaseColor("Enabled")).toBe("green");
  });

  it("maps Failed to red", () => {
    expect(phaseColor("Failed")).toBe("red");
  });

  it("maps PartiallyFailed to orange", () => {
    expect(phaseColor("PartiallyFailed")).toBe("orange");
  });

  it("maps InProgress to blue", () => {
    expect(phaseColor("InProgress")).toBe("blue");
  });

  it("maps New to blue", () => {
    expect(phaseColor("New")).toBe("blue");
  });

  it("maps Deleting to yellow", () => {
    expect(phaseColor("Deleting")).toBe("yellow");
  });

  it("maps WaitingForPluginOperations to yellow", () => {
    expect(phaseColor("WaitingForPluginOperations")).toBe("yellow");
  });

  it("maps Finalizing to yellow", () => {
    expect(phaseColor("Finalizing")).toBe("yellow");
  });

  it("maps unknown phases to gray", () => {
    expect(phaseColor("")).toBe("gray");
    expect(phaseColor("Custom")).toBe("gray");
  });
});
