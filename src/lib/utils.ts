import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toRgbChannels(color: string): string | null {
  // Handle hex #RRGGBB
  const hexFull = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hexFull) {
    return `${parseInt(hexFull[1], 16)} ${parseInt(hexFull[2], 16)} ${parseInt(hexFull[3], 16)}`;
  }

  // Handle hex #RGB
  const hexShort = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color);
  if (hexShort) {
    return `${parseInt(hexShort[1] + hexShort[1], 16)} ${parseInt(hexShort[2] + hexShort[2], 16)} ${parseInt(hexShort[3] + hexShort[3], 16)}`;
  }

  // Handle rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/i.exec(color);
  if (rgbMatch) {
    return `${rgbMatch[1]} ${rgbMatch[2]} ${rgbMatch[3]}`;
  }

  return null;
}
