import { invoke } from '@tauri-apps/api/core';

interface AdjustProjectionSizeArgs {
  windowLabel: string;
  width: number;
  height: number;
}

export async function requestProjectionResize({ windowLabel, width, height }: AdjustProjectionSizeArgs): Promise<void> {
  await invoke('adjust_projection_size', {
    windowLabel,
    width,
    height,
    reposition: { strategy: 'none' },
  });
}
