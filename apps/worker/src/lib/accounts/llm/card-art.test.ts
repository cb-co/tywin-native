import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("#/lib/llm/gemini", () => ({ gemini: vi.fn(() => "model"), defaultModelId: () => "gemini-3.5-flash-lite" }));

import { generateObject } from "ai";
import { inferCardArt } from "./card-art";

const mockReturn = (object: unknown) =>
  (generateObject as unknown as Mock).mockResolvedValue({ object });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inferCardArt", () => {
  it("passes through a valid accent and network", async () => {
    mockReturn({ accent: "#1B4B8F", network: "visa" });
    expect(await inferCardArt("BHD León Visa Infinite")).toEqual({
      accent: "#1B4B8F",
      network: "visa",
    });
  });

  // Card art validates the same way and had the same silent failure: a model
  // that answers `1B4B8F` was telling us the colour, and we threw it away.
  it("accepts a bare accent the model returned without its #", async () => {
    mockReturn({ accent: "1B4B8F", network: "visa" });
    expect(await inferCardArt("BHD León Visa Infinite")).toEqual({
      accent: "#1B4B8F",
      network: "visa",
    });
  });

  it("keeps the accent when the network is unknown", async () => {
    mockReturn({ accent: "#2E3B4A", network: null });
    expect(await inferCardArt("Some Bank Card")).toEqual({
      accent: "#2E3B4A",
      network: null,
    });
  });

  // The schema constrains `accent` to a string, not to a colour. A model that
  // answers "navy" or "#FFF" satisfies the schema and would then reach colour
  // maths that silently misparses it — #FFF parses as rgb(0, 15, 255).
  it.each(["navy", "#FFF", "rgb(1,2,3)", "", "  ", "#12345", "#1234567"])(
    "rejects %o rather than storing it",
    async (accent) => {
      mockReturn({ accent, network: "visa" });
      expect(await inferCardArt("Card")).toBeNull();
    },
  );

  it("returns null when the model call fails", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(new Error("boom"));
    expect(await inferCardArt("Card")).toBeNull();
  });

  /* This runs inside a save, and the endpoint is occasionally tens of seconds slow. */
  it("bounds the call with an abort signal", async () => {
    mockReturn({ accent: "#1B4B8F", network: "visa" });
    await inferCardArt("BHD León Visa Infinite");
    const { abortSignal } = (generateObject as unknown as Mock).mock.calls[0][0];
    expect(abortSignal).toBeInstanceOf(AbortSignal);
  });

  // An abort is not special-cased: a save must not fail because a guess was slow.
  it("returns null when the call is aborted", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    expect(await inferCardArt("Card")).toBeNull();
  });

  // No name, no signal — not worth a network round trip.
  it("does not call the model for a blank name", async () => {
    expect(await inferCardArt("   ")).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });
});
