import { describe, expect, it } from "vitest";
import { formatteerKenteken, normaliseerKenteken } from "../src/kenteken";

describe("kenteken", () => {
  it("normaliseert naar hoofdletters zonder streepjes, met landcode", () => {
    expect(normaliseerKenteken("nl", "43-bkl-7")).toEqual({ landcode: "NL", kenteken: "43BKL7" });
    expect(normaliseerKenteken("RO", "b 112 xyz")).toEqual({ landcode: "RO", kenteken: "B112XYZ" });
  });

  it("formatteert pas bij weergave", () => {
    expect(formatteerKenteken({ landcode: "NL", kenteken: "43BKL7" })).toBe("43-BKL-7");
    expect(formatteerKenteken({ landcode: "RO", kenteken: "B112XYZ" })).toBe("B-112-XYZ");
  });
});
