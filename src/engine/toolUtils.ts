export type ToolMode = 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint' | 'orbit'

export function getColumnsInRadius(
  centerX: number,
  centerZ: number,
  radius: number,
): [number, number][] {
  const cols: [number, number][] = []
  const r2 = radius * radius
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= r2) {
        cols.push([centerX + dx, centerZ + dz])
      }
    }
  }
  return cols
}
