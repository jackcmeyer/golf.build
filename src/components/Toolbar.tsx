import { VoxelType, VOXEL_COLORS } from '../voxelTypes'
import { ToolMode } from '../engine/toolUtils'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const SCULPT_TOOLS: { id: ToolMode; label: string }[] = [
  { id: 'raise',   label: '^ Raise'   },
  { id: 'lower',   label: 'v Lower'   },
  { id: 'flatten', label: '— Flatten' },
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

const ITEM_BASE = [
  'w-full justify-start text-xs tracking-wide',
  'h-auto py-1.5 px-1.5',
  'border-white/10 bg-white/[0.04] text-white/50',
  'hover:bg-white/[0.08] hover:text-white/80',
].join(' ')

const ORBIT_ACTIVE  = 'data-[state=on]:bg-blue-900/50  data-[state=on]:text-blue-200  data-[state=on]:border-blue-700/40'
const SCULPT_ACTIVE = 'data-[state=on]:bg-green-900/50 data-[state=on]:text-green-200 data-[state=on]:border-green-800/40'

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
    <div className="absolute top-4 left-4 flex flex-col gap-2.5 min-w-[152px] rounded-xl border border-white/[0.09] bg-black/[0.88] p-3 font-mono text-sm select-none pointer-events-auto backdrop-blur-sm">

      {/* Orbit */}
      <ToggleGroup
        type="single"
        value={toolMode === 'orbit' ? 'orbit' : ''}
        onValueChange={(v) => { if (v) onToolChange('orbit') }}
        orientation="vertical"
        spacing={0}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <ToggleGroupItem value="orbit" className={`${ITEM_BASE} ${ORBIT_ACTIVE}`}>
          + Orbit
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator className="bg-white/[0.08]" />

      {/* Sculpt tools */}
      <ToggleGroup
        type="single"
        value={toolMode !== 'orbit' ? toolMode : ''}
        onValueChange={(v) => { if (v) onToolChange(v as ToolMode) }}
        orientation="vertical"
        spacing={0}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {SCULPT_TOOLS.map(t => (
          <ToggleGroupItem key={t.id} value={t.id} className={`${ITEM_BASE} ${SCULPT_ACTIVE}`}>
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Brush size */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-white/35">Brush — {brushSize}vx</span>
        <Slider
          min={1}
          max={12}
          value={[brushSize]}
          onValueChange={(vals) => onBrushChange(vals[0])}
          className="[&_[data-slot=slider-track]]:bg-white/15 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-thumb]]:size-3.5"
        />
      </div>

      {/* Surface palette — paint mode only */}
      {toolMode === 'paint' && (
        <div>
          <div className="text-[10px] text-white/35 mb-1.5">Surface</div>
          <div className="flex flex-wrap gap-1">
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
                  style={{ background: `rgb(${r},${g},${b})` }}
                  className={[
                    'size-6 cursor-pointer rounded box-border border-2 transition-all',
                    active
                      ? 'border-white shadow-[0_0_0_1px_oklch(0.527_0.154_150.069)]'
                      : 'border-black/30 hover:border-white/40',
                  ].join(' ')}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Keyboard / touch hints */}
      <p className="text-[10px] leading-relaxed text-white/22">
        L-drag: sculpt<br />
        R-drag: orbit<br />
        Scroll: zoom<br />
        Mobile: orbit mode<br />
        + 2-finger zoom
      </p>
    </div>
  )
}
