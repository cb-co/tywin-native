import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("#/lib/llm/gemini", () => ({ gemini: vi.fn(() => "model"), defaultModelId: () => "gemini-3.5-flash-lite" }));
// The real module loads all 3,450 icons; these tests only need it to agree
// about which slugs exist.
vi.mock("#/lib/brand/simple-icon", () => ({
  brandIcon: vi.fn(async (slug?: string | null) => {
    const icons: Record<string, { slug: string; path: string; hex: string }> = {
      netflix: { slug: "netflix", path: "M0 0h1v1H0z", hex: "#E50914" },
      spotify: { slug: "spotify", path: "M2 2h1v1H2z", hex: "#1ED760" },
      apple: { slug: "apple", path: "M3 3h1v1H3z", hex: "#F5F5F7" },
    };
    return (slug && icons[slug.trim().toLowerCase()]) || null;
  }),
}));

import { generateObject } from "ai";
import { inferBrand } from "./brand";

const mockReturn = (object: unknown) =>
  (generateObject as unknown as Mock).mockResolvedValue({ object });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inferBrand colour", () => {
  it("passes through a valid hex", async () => {
    mockReturn({ color: "#E50914", slug: "" });
    expect(await inferBrand("Netflix")).toMatchObject({ color: "#E50914" });
  });

  /* The bug that made this feature look broken for every subscription. Asked for
     "a 6-digit hex", the model returns `#D97706` for some names and a bare
     `D97706` for others — stably, per name — so a subscription unlucky in its
     name had its colour rejected on every single attempt and stayed neutral
     forever, looking exactly like a name the model could not place. */
  it("accepts a bare hex the model returned without its #", async () => {
    mockReturn({ color: "D97706", slug: "" });
    expect(await inferBrand("Claude")).toMatchObject({ color: "#D97706" });
  });

  it("accepts a bare hex with surrounding whitespace", async () => {
    mockReturn({ color: "  1DB954 ", slug: "" });
    expect(await inferBrand("Spotify")).toMatchObject({ color: "#1DB954" });
  });

  // The schema constrains `color` to a string, not to a colour. A model that
  // answers "red" or "#FFF" satisfies the schema and would then reach the
  // contrast maths that silently misparses it — #FFF parses as rgb(0, 15, 255),
  // which would pick a foreground for a colour nothing renders.
  it.each(["red", "#FFF", "rgb(1,2,3)", "", "  ", "#12345", "#1234567"])(
    "rejects %o rather than storing it",
    async (color) => {
      mockReturn({ color, slug: "" });
      expect(await inferBrand("Netflix")).toMatchObject({ color: null });
    },
  );
});

/**
 * The slug is the one field where a model's answer is checked against ground
 * truth rather than trusted, which is what makes asking for an identifier safe.
 */
describe("inferBrand logo", () => {
  it("returns a URI for a slug the icon set really has", async () => {
    mockReturn({ color: "#E50914", slug: "netflix" });
    expect(await inferBrand("Netflix")).toMatchObject({ logoUri: "simple-icons:netflix" });
  });

  it("drops a slug the icon set does not have", async () => {
    mockReturn({ color: "#4B7BEC", slug: "gimnasiobellavista" });
    expect(await inferBrand("Gimnasio Bella Vista")).toMatchObject({
      logoUri: null,
      color: "#4B7BEC",
    });
  });

  it("treats an empty slug as no logo", async () => {
    mockReturn({ color: "#4B7BEC", slug: "" });
    expect(await inferBrand("Parqueo")).toMatchObject({ logoUri: null });
  });

  // An exact value from the brand's own artwork beats one the model recalled.
  it("prefers the icon set's official hex over the model's colour", async () => {
    mockReturn({ color: "#FF0000", slug: "spotify" });
    expect(await inferBrand("Spotify")).toMatchObject({ color: "#1ED760" });
  });

  /* Apple's official hex is near-white, and the mark becomes a filled disc on a
     card surface — a white one reads as a failed render. The model's answer is
     the fallback, since it was told to avoid exactly that. */
  it("keeps the model's colour when the official one is too pale to fill a disc", async () => {
    mockReturn({ color: "#1D1D1F", slug: "apple" });
    expect(await inferBrand("Apple One")).toMatchObject({
      color: "#1D1D1F",
      logoUri: "simple-icons:apple",
    });
  });
});

/**
 * Every way of coming back empty returns the same shape. The caller stores what
 * it is given and nothing else, so a failure and an unplaceable name are one
 * case here: the row keeps its initial on the theme's neutral accent.
 */
describe("inferBrand comes back empty rather than throwing", () => {
  it("when neither field resolved", async () => {
    mockReturn({ color: "not a colour", slug: "nope" });
    expect(await inferBrand("Parqueo")).toEqual({ color: null, logoUri: null });
  });

  it("when the call failed", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(new Error("boom"));
    expect(await inferBrand("Netflix")).toEqual({ color: null, logoUri: null });
  });

  // An abort is not special-cased: a save must not fail because a guess was slow.
  it("when the call was aborted", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    expect(await inferBrand("Netflix")).toEqual({ color: null, logoUri: null });
  });

  // No name, no signal — not worth a network round trip.
  it("does not call the model for a blank name", async () => {
    expect(await inferBrand("   ")).toEqual({ color: null, logoUri: null });
    expect(generateObject).not.toHaveBeenCalled();
  });
});

/* The call runs off the save path now, but still inside a request someone may
   navigate away from, and the real endpoint can take 50-70s. Without a bound
   that is a request nothing ever closes. */
describe("inferBrand bounds the call", () => {
  it("passes an abort signal", async () => {
    mockReturn({ color: "#E50914", slug: "netflix" });
    await inferBrand("Netflix");
    const { abortSignal } = (generateObject as unknown as Mock).mock.calls[0][0];
    expect(abortSignal).toBeInstanceOf(AbortSignal);
  });
});
