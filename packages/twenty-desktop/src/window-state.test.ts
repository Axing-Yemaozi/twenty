import { describe, expect, it } from 'vitest';

import { parseWindowState } from './window-state';

describe('parseWindowState', () => {
  it('uses safe defaults for malformed state', () => {
    expect(parseWindowState(null)).toEqual({
      height: 800,
      isMaximized: false,
      width: 1280,
    });
    expect(parseWindowState({ height: 10, width: 10 })).toEqual({
      height: 800,
      isMaximized: false,
      width: 1280,
    });
  });

  it('keeps a valid saved window state', () => {
    expect(
      parseWindowState({
        height: 900,
        isMaximized: true,
        width: 1400,
        x: 100,
        y: 80,
      }),
    ).toEqual({
      height: 900,
      isMaximized: true,
      width: 1400,
      x: 100,
      y: 80,
    });
  });
});
