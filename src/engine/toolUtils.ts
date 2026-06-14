export type ToolMode =
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'smooth'
  | 'paint'
  | 'orbit'
  | 'object'
  | 'hole'

// roundness: 0 = square footprint, 1 = circular footprint. Values between round
// the corners of the square with a corner radius of roundness * radius.
export function getColumnsInRadius(
  centerX: number,
  centerZ: number,
  radius: number,
  roundness = 1,
): [number, number][] {
  const cols: [number, number][] = []
  const cornerRadius = roundness * radius
  const inner = radius - cornerRadius
  const cr2 = cornerRadius * cornerRadius
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const ox = Math.abs(dx) - inner
      const oz = Math.abs(dz) - inner
      if (ox > 0 && oz > 0) {
        if (ox * ox + oz * oz <= cr2) cols.push([centerX + dx, centerZ + dz])
      } else {
        cols.push([centerX + dx, centerZ + dz])
      }
    }
  }
  return cols
}
