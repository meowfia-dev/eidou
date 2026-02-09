import { describe, expect, it } from "bun:test";
import {
  getAlignClass,
  getBgClass,
  getBorderColorClass,
  getFontWeightClass,
  getGapClass,
  getJustifyClass,
  getOpacityClass,
  getRadiusClass,
  getShadowClass,
  getSpacingClass,
  getTextColorClass,
  getTextSizeClass,
  getTrackingClass,
} from "../lib/semantic-styles";

describe("semantic-styles", () => {
  it("should map spacing tokens correctly", () => {
    expect(getSpacingClass("p", "4")).toBe("p-4");
    expect(getSpacingClass("mx", "16")).toBe("mx-16");
    expect(getSpacingClass("m", undefined)).toBe("");
  });

  it("should map gap tokens correctly", () => {
    expect(getGapClass("gap", "2")).toBe("gap-2");
    expect(getGapClass("gap-x", "4")).toBe("gap-x-4");
    expect(getGapClass("gap", undefined)).toBe("");
  });

  it("should map color/bg helpers correctly", () => {
    expect(getBgClass("primary")).toBe("bg-primary");
    expect(getBgClass("card", "80")).toBe("bg-card/80");
    expect(getBgClass(undefined)).toBe("");

    expect(getTextColorClass("danger")).toBe("text-danger");
    expect(getTextColorClass("foreground", "60")).toBe("text-foreground/60");
    expect(getTextColorClass(undefined)).toBe("");

    expect(getBorderColorClass("success")).toBe("border-success");
    expect(getBorderColorClass("muted", "20")).toBe("border-muted/20");
    expect(getBorderColorClass(undefined)).toBe("");
  });

  it("should map opacity tokens correctly", () => {
    expect(getOpacityClass("opacity", "60")).toBe("opacity-60");
    expect(getOpacityClass("bg-opacity", "100")).toBe("bg-opacity-100");
    expect(getOpacityClass("opacity", undefined)).toBe("");
  });

  it("should map radius tokens correctly", () => {
    expect(getRadiusClass("sm")).toBe("rounded-sm");
    expect(getRadiusClass("base")).toBe("rounded-none");
    expect(getRadiusClass("full")).toBe("rounded-none");
    expect(getRadiusClass("none")).toBe("rounded-none");
    expect(getRadiusClass("lg")).toBe("rounded-lg");
    expect(getRadiusClass(undefined)).toBe("");
  });

  it("should map shadow tokens correctly", () => {
    expect(getShadowClass("neon-sm")).toBe("shadow-neon-sm");
    expect(getShadowClass("neon")).toBe("shadow-neon");
    expect(getShadowClass("neon-lg")).toBe("shadow-neon-lg");
    expect(getShadowClass("none")).toBe("shadow-none");
    expect(getShadowClass(undefined)).toBe("");
  });

  it("should map text tokens correctly", () => {
    expect(getTextSizeClass("xl")).toBe("text-xl");
    expect(getFontWeightClass("bold")).toBe("font-bold");
    expect(getFontWeightClass("semibold")).toBe("font-semibold");
    expect(getTrackingClass("wide")).toBe("tracking-wide");
    expect(getTextSizeClass(undefined)).toBe("");
  });

  it("should map layout tokens correctly", () => {
    expect(getAlignClass("center")).toBe("items-center");
    expect(getJustifyClass("between")).toBe("justify-between");
    expect(getAlignClass(undefined)).toBe("");
  });
});
