import fs from 'node:fs';
import path from 'node:path';

export type WindowBounds = {
  height: number;
  width: number;
  x?: number;
  y?: number;
};

export type PersistedWindowState = WindowBounds & {
  isMaximized: boolean;
};

const DEFAULT_WINDOW_STATE: PersistedWindowState = {
  height: 800,
  isMaximized: false,
  width: 1280,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const parseWindowState = (value: unknown): PersistedWindowState => {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_WINDOW_STATE;
  }

  const candidate = value as Partial<PersistedWindowState>;

  if (
    !isFiniteNumber(candidate.width) ||
    !isFiniteNumber(candidate.height) ||
    candidate.width < 900 ||
    candidate.height < 640 ||
    candidate.width > 10000 ||
    candidate.height > 10000
  ) {
    return DEFAULT_WINDOW_STATE;
  }

  return {
    height: candidate.height,
    isMaximized: candidate.isMaximized === true,
    width: candidate.width,
    ...(isFiniteNumber(candidate.x) ? { x: candidate.x } : {}),
    ...(isFiniteNumber(candidate.y) ? { y: candidate.y } : {}),
  };
};

export const readWindowState = (userDataPath: string): PersistedWindowState => {
  try {
    const serializedState = fs.readFileSync(
      path.join(userDataPath, 'window-state.json'),
      'utf8',
    );

    return parseWindowState(JSON.parse(serializedState));
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
};

export const writeWindowState = (
  userDataPath: string,
  state: PersistedWindowState,
) => {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(
    path.join(userDataPath, 'window-state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    { mode: 0o600 },
  );
};
