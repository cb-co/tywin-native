import { describe, it, expect } from "vitest";
import { periodSerial } from "./period-serial";

describe("periodSerial", () => {
  it("marks a period that starts in the first half of the month A", () => {
    expect(periodSerial("2026-09-01")).toBe("QNA 09 A");
    expect(periodSerial("2026-09-15")).toBe("QNA 09 A");
  });
  it("marks a period that starts on the 16th or later B", () => {
    expect(periodSerial("2026-09-16")).toBe("QNA 09 B");
    expect(periodSerial("2026-09-20")).toBe("QNA 09 B");
  });
});
