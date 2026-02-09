import { describe, expect, it } from 'bun:test';
import { parseSizeSpec, resolveFinalSize } from '../lib/size-constraints';

const SCREEN = {
  availWidth: 1728,
  availHeight: 1117,
};

describe('size-constraints presets', () => {
  it('parses xl preset to fixed dimensions', () => {
    expect(parseSizeSpec('xl', SCREEN)).toEqual({ width: 1024, height: 900 });
  });

  it('resolves full preset to monitor logical size', () => {
    expect(resolveFinalSize('full', null, SCREEN)).toEqual({ width: 1728, height: 1117 });
  });

  it('parses ratio object using explicit width and maxWidth', () => {
    expect(parseSizeSpec({ ratio: '16:9', width: 1200, maxWidth: 1000, base: 'lg' }, SCREEN)).toEqual({
      width: 1000,
      height: 562.5,
    });
  });

  it('resolves ratio object with base width fallback', () => {
    expect(resolveFinalSize({ ratio: '4:3', base: 'md' }, null, SCREEN)).toEqual({ width: 480, height: 360 });
  });
});
