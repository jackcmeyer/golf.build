import { VoxelType, VOXEL_COLORS } from '../voxelTypes'
import { ToolMode } from '../engine/toolUtils'

const TOOLS: { id: ToolMode; label: string }[] = [
  { id: 'raise',   label: '^ Raise'   },
  { id: 'lower',   label: 'v Lower'   },
  { id: 'flatten', label: '- Flatten' },
  { id: 'smooth',  label: '~ Smooth'  },
  { id: 'paint',   label: '# Paint'   },
]

const PAINTABLE: VoxelType[] = [
  VoxelType.FAIRWAY_GRASS,
  VoxelType.GREEN_GRASS,
  VoxelType.TEE_GRASS,
  VoxelType.INTERMEDIATE_ROUGH,
  VoxelType.PRIMARY_ROUGH,
  VoxelType.DEEP_ROUGH,
  VoxelType.FESCUE,
  VoxelType.HEATHER,
  VoxelType.BUNKER_SAND_WHITE,
  VoxelType.BUNKER_SAND_BROWN,
  VoxelType.WASTE_AREA,
  VoxelType.STILL_WATER,
  VoxelType.CART_PATH_CONCRETE,
  VoxelType.ROCK_OUTCROP,
  VoxelType.BARE_SOIL,
]

const SURFACE_LABELS: Partial<Record<VoxelType, string>> = {
  [VoxelType.FAIRWAY_GRASS]:      'Fairway',
  [VoxelType.GREEN_GRASS]:        'Green',
  [VoxelType.TEE_GRASS]:          'Tee',
  [VoxelType.INTERMEDIATE_ROUGH]: 'I. Rough',
  [VoxelType.PRIMARY_ROUGH]:      'P. Rough',
  [VoxelType.DEEP_ROUGH]:         'D. Rough',
  [VoxelType.FESCUE]:             'Fescue',
  [VoxelType.HEATHER]:            'Heather',
  [VoxelType.BUNKER_SAND_WHITE]:  'Bunker',
  [VoxelType.BUNKER_SAND_BROWN]:  'Waste Bkr',
  [VoxelType.WASTE_AREA]:         'Waste',
  [VoxelType.STILL_WATER]:        'Water',
  [VoxelType.CART_PATH_CONCRETE]: 'Cart Path',
  [VoxelType.ROCK_OUTCROP]:       'Rock',
  [VoxelType.BARE_SOIL]:          'Soil',
}

interface ToolbarProps {
  toolMode: ToolMode
  onToolChange: (t: ToolMode) => void
  brushSize: number
  onBrushChange: (s: number) => void
  selectedSurface: VoxelType
  onSurfaceChange: (s: VoxelType) => void
}

export function Toolbar({
  toolMode, onToolChange,
  brushSize, onBrushChange,
  selectedSurface, onSurfaceChange,
}: ToolbarProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      background: 'rgba(14, 12, 10, 0.88)',
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      userSelect: 'none',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.09)',
      minWidth: 150,
      fontFamily: 'ui-monospace, monospace',
      fontSize: 13,
      pointerEvents: 'all',
    }}>

      {/* Tool buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            style={{
              padding: '5px 10px',
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              background: toolMode === t.id ? '#4a7a2e' : 'rgba(255,255,255,0.06)',
              color: toolMode === t.id ? '#d8f0c0' : '#9a9a8a',
              fontSize: 13,
              fontFamily: 'inherit',
              letterSpacing: '0.02em',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Brush size */}
      <div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>
          Brush — {brushSize}vx
        </div>
        <input
          type="range" min={1} max={12} value={brushSize}
          onChange={e => onBrushChange(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#4a7a2e' }}
        />
      </div>

      {/* Surface palette — paint mode only */}
      {toolMode === 'paint' && (
        <div>
          <div style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>Surface</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PAINTABLE.map(s => {
              const hex = VOXEL_COLORS[s] ?? 0x888888
              const r = (hex >> 16) & 0xff
              const g = (hex >> 8) & 0xff
              const b = hex & 0xff
              const active = selectedSurface === s
              return (
                <div
                  key={s}
                  title={SURFACE_LABELS[s] ?? String(s)}
                  onClick={() => onSurfaceChange(s)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: `rgb(${r},${g},${b})`,
                    cursor: 'pointer',
                    border: active ? '2px solid #fff' : '2px solid rgba(0,0,0,0.3)',
                    boxSizing: 'border-box',
                    boxShadow: active ? '0 0 0 1px #4a7a2e' : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div style={{ color: '#444', fontSize: 10, lineHeight: 1.6 }}>
        L-drag: sculpt<br />
        R-drag: orbit<br />
        Scroll: zoom
      </div>
    </div>
  )
}
