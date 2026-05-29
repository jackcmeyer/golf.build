export enum ObjectType {
  FLAGSTICK_CUP = 'flagstick_cup',
  TEE_MARKER_RED = 'tee_marker_red',
  TEE_MARKER_WHITE = 'tee_marker_white',
  TEE_MARKER_BLUE = 'tee_marker_blue',
  BENCH_WOOD = 'bench_wood',
  PINE_CONIFER = 'pine_conifer',
  OAK_FULL = 'oak_full',
  STONE_WALL = 'stone_wall',
}

export const OBJECT_NAMES: Record<ObjectType, string> = {
  [ObjectType.FLAGSTICK_CUP]: 'Flagstick',
  [ObjectType.TEE_MARKER_RED]: 'Tee (Red)',
  [ObjectType.TEE_MARKER_WHITE]: 'Tee (White)',
  [ObjectType.TEE_MARKER_BLUE]: 'Tee (Blue)',
  [ObjectType.BENCH_WOOD]: 'Bench',
  [ObjectType.PINE_CONIFER]: 'Pine',
  [ObjectType.OAK_FULL]: 'Oak',
  [ObjectType.STONE_WALL]: 'Stone Wall',
}

// Footprint in meters [width, depth]
export const OBJECT_FOOTPRINT: Record<ObjectType, [number, number]> = {
  [ObjectType.FLAGSTICK_CUP]: [1, 1],
  [ObjectType.TEE_MARKER_RED]: [1, 1],
  [ObjectType.TEE_MARKER_WHITE]: [1, 1],
  [ObjectType.TEE_MARKER_BLUE]: [1, 1],
  [ObjectType.BENCH_WOOD]: [2, 1],
  [ObjectType.PINE_CONIFER]: [4, 4],
  [ObjectType.OAK_FULL]: [6, 6],
  [ObjectType.STONE_WALL]: [4, 1],
}
