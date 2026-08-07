import { describe, expect, it } from "vitest";
import { formatteerGeld, geld, telOp } from "../src/geld";

describe("geld", () => {
  it("accepteert alleen integers in centen", () => {
    expect(geld(1250)).toEqual({ bedragCenten: 1250, valuta: "EUR" });
    expect(() => geld(12.5)).toThrow();
  });

  it("telt alleen gelijke valuta op", () => {
    expect(telOp(geld(1000), geld(250)).bedragCenten).toBe(1250);
    expect(() => telOp(geld(100), geld(100, "PLN"))).toThrow();
  });

  it("formatteert bij weergave", () => {
    expect(formatteerGeld(geld(1250))).toContain("12,50");
  });
});
