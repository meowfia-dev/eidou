import type {
  AlignToken,
  BgToken,
  ColorToken,
  FontWeightToken,
  GapToken,
  JustifyToken,
  OpacityToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  TextSizeToken,
  TrackingToken,
} from "./tokens";

export function getSpacingClass(
  property: "p" | "px" | "py" | "pt" | "pr" | "pb" | "pl" | "m" | "mx" | "my" | "mt" | "mr" | "mb" | "ml",
  token?: SpacingToken
): string {
  if (!token) return "";
  return `${property}-${token}`;
}

export function getGapClass(
  property: "gap" | "gap-x" | "gap-y",
  token?: GapToken
): string {
  if (!token) return "";
  return `${property}-${token}`;
}

export function getBgClass(token?: BgToken, opacity?: OpacityToken): string {
  if (!token) return "";
  if (opacity) return `bg-${token}/${opacity}`;
  return `bg-${token}`;
}

export function getBgFromColorToken(token?: ColorToken, opacity?: OpacityToken): string {
  if (!token) return "";
  if (opacity) return `bg-${token}/${opacity}`;
  return `bg-${token}`;
}

export function getTextColorClass(token?: ColorToken, opacity?: OpacityToken): string {
  if (!token) return "";
  if (opacity) return `text-${token}/${opacity}`;
  return `text-${token}`;
}

export function getBorderColorClass(token?: ColorToken, opacity?: OpacityToken): string {
  if (!token) return "";
  if (opacity) return `border-${token}/${opacity}`;
  return `border-${token}`;
}

export function getOpacityClass(
  property: "opacity" | "bg-opacity" | "text-opacity" | "border-opacity",
  token?: OpacityToken
): string {
  if (!token) return "";
  return `${property}-${token}`;
}

export function getRadiusClass(token?: RadiusToken): string {
  if (!token) return "";
  if (token === "none") return "rounded-none";
  if (token === "base") return "rounded-none";
  if (token === "full") return "rounded-none";
  return `rounded-${token}`;
}

export function getShadowClass(token?: ShadowToken): string {
  if (!token) return "";
  if (token === "none") return "shadow-none";
  // All other shadows follow the shadow-{token} pattern
  return `shadow-${token}`;
}

export function getTextSizeClass(token?: TextSizeToken): string {
  if (!token) return "";
  return `text-${token}`;
}

export function getFontWeightClass(token?: FontWeightToken): string {
  if (!token) return "";
  return `font-${token}`;
}

export function getTrackingClass(token?: TrackingToken): string {
  if (!token) return "";
  return `tracking-${token}`;
}

export function getAlignClass(token?: AlignToken): string {
  if (!token) return "";
  return `items-${token}`;
}

export function getJustifyClass(token?: JustifyToken): string {
  if (!token) return "";
  return `justify-${token}`;
}

export function getUniversalLayoutClasses(props: {
  p?: SpacingToken;
  px?: SpacingToken;
  py?: SpacingToken;
  m?: SpacingToken;
  mx?: SpacingToken;
  my?: SpacingToken;
  bg?: BgToken;
  bgOpacity?: OpacityToken;
  border?: boolean;
  borderColor?: ColorToken;
  borderOpacity?: OpacityToken;
  rounded?: RadiusToken;
  shadow?: ShadowToken;
}): string {
  const borderColorClass = props.border
    ? (props.borderColor
        ? getBorderColorClass(props.borderColor, props.borderOpacity)
        : `border-border/${props.borderOpacity ?? "10"}`)
    : "";

  return [
    getSpacingClass("p", props.p),
    getSpacingClass("px", props.px),
    getSpacingClass("py", props.py),
    getSpacingClass("m", props.m),
    getSpacingClass("mx", props.mx),
    getSpacingClass("my", props.my),
    getBgClass(props.bg, props.bgOpacity),
    props.border && "border",
    borderColorClass,
    getRadiusClass(props.rounded),
    getShadowClass(props.shadow),
  ].filter(Boolean).join(" ");
}
