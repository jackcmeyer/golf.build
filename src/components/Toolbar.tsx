import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowUp,
  Globe,
  Minus,
  Paintbrush,
  Redo2,
  RotateCcw,
  Settings,
  Shapes,
  Trash2,
  Undo2,
  Waves,
} from 'lucide-react'
import { VoxelType, VOXEL_COLORS } from '../voxelTypes'
import { ToolMode } from '../engine/toolUtils'
import { ObjectType, OBJECT_NAMES } from '../engine/objectTypes'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SCULPT_TOOLS: { id: ToolMode; label: string; key: string; Icon: LucideIcon }[] = [
  { id: 'paint', label: 'Paint', key: 'P', Icon: Paintbrush },
  { id: 'raise', label: 'Raise', key: 'R', Icon: ArrowUp },
  { id: 'lower', label: 'Lower', key: 'L', Icon: ArrowDown },
  { id: 'flatten', label: 'Flatten', key: 'F', Icon: Minus },
  { id: 'smooth', label: 'Smooth', key: 'S', Icon: Waves },
  { id: 'object', label: 'Objects', key: 'E', Icon: Shapes },
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
  [VoxelType.FAIRWAY_GRASS]: 'Fairway',
  [VoxelType.GREEN_GRASS]: 'Green',
  [VoxelType.TEE_GRASS]: 'Tee',
  [VoxelType.INTERMEDIATE_ROUGH]: 'I. Rough',
  [VoxelType.PRIMARY_ROUGH]: 'P. Rough',
  [VoxelType.DEEP_ROUGH]: 'D. Rough',
  [VoxelType.FESCUE]: 'Fescue',
  [VoxelType.HEATHER]: 'Heather',
  [VoxelType.BUNKER_SAND_WHITE]: 'Bunker',
  [VoxelType.BUNKER_SAND_BROWN]: 'Waste Bkr',
  [VoxelType.WASTE_AREA]: 'Waste',
  [VoxelType.STILL_WATER]: 'Water',
  [VoxelType.CART_PATH_CONCRETE]: 'Cart Path',
  [VoxelType.ROCK_OUTCROP]: 'Rock',
  [VoxelType.BARE_SOIL]: 'Soil',
}

const ALL_OBJECT_TYPES = Object.values(ObjectType)

// Swatch colors for object types (purely visual — not functional)
const OBJECT_SWATCH: Record<ObjectType, string> = {
  [ObjectType.FLAGSTICK_CUP]: '#e83232',
  [ObjectType.TEE_MARKER_RED]: '#cc2222',
  [ObjectType.TEE_MARKER_WHITE]: '#eeeeee',
  [ObjectType.TEE_MARKER_BLUE]: '#2244cc',
  [ObjectType.BENCH_WOOD]: '#9a6830',
  [ObjectType.PINE_CONIFER]: '#2d6a1e',
  [ObjectType.OAK_FULL]: '#3a8030',
  [ObjectType.STONE_WALL]: '#888078',
  [ObjectType.GOLF_CART]: '#f2f2f2',
}

const ITEM_BASE = [
  'w-full justify-start text-xs tracking-wide',
  'h-auto py-1.5 px-1.5',
  'border-white/10 bg-white/[0.04] text-white/50',
  'hover:bg-white/[0.08] hover:text-white/80',
].join(' ')

const ORBIT_ACTIVE =
  'data-[state=on]:bg-blue-900/50  data-[state=on]:text-blue-200  data-[state=on]:border-blue-700/40'
const SCULPT_ACTIVE =
  'data-[state=on]:bg-green-900/50 data-[state=on]:text-green-200 data-[state=on]:border-green-800/40'

interface ToolbarProps {
  toolMode: ToolMode
  onToolChange: (t: ToolMode) => void
  brushSize: number
  onBrushChange: (s: number) => void
  brushRoundness: number
  onRoundnessChange: (r: number) => void
  selectedSurface: VoxelType
  onSurfaceChange: (s: VoxelType) => void
  timeOfDay: number
  onTimeOfDayChange: (t: number) => void
  selectedObjType: ObjectType
  onObjTypeChange: (t: ObjectType) => void
  showGolfer: boolean
  onGolferToggle: () => void
  onEnterWalk: () => void
  onRestart?: () => void
  onDelete?: () => void
  canUndo: boolean
  onUndo: () => void
  canRedo: boolean
  onRedo: () => void
}

function formatHour(t: number): string {
  const h = Math.floor(t)
  const m = Math.round((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Toolbar({
  toolMode,
  onToolChange,
  brushSize,
  onBrushChange,
  brushRoundness,
  onRoundnessChange,
  selectedSurface,
  onSurfaceChange,
  timeOfDay,
  onTimeOfDayChange,
  selectedObjType,
  onObjTypeChange,
  showGolfer,
  onGolferToggle,
  onEnterWalk,
  onRestart,
  onDelete,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
}: ToolbarProps) {
  const isSculpt = toolMode !== 'orbit' && toolMode !== 'object'
  const isObject = toolMode === 'object'
  const isMac = /mac/i.test(navigator.platform) || /mac os/i.test(navigator.userAgent)

  return (
    <div className="pointer-events-auto absolute top-4 left-4 flex min-w-[152px] flex-col gap-2.5 rounded-xl border border-white/[0.09] bg-black/[0.88] p-3 font-mono text-sm backdrop-blur-sm select-none">
      {/* Undo / Redo / Settings */}
      <div className="flex gap-1.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
          className="flex flex-1 cursor-pointer items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] py-1 transition-all hover:bg-white/[0.08] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <Undo2 size={13} strokeWidth={1.75} className="text-white/50" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={isMac ? 'Redo (⌘⇧Z)' : 'Redo (Ctrl+Shift+Z)'}
          className="flex flex-1 cursor-pointer items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] py-1 transition-all hover:bg-white/[0.08] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <Redo2 size={13} strokeWidth={1.75} className="text-white/50" />
        </button>
        {(onRestart || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Course settings"
                className="flex flex-1 cursor-pointer items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] py-1 transition-all hover:bg-white/[0.08] hover:text-white/80"
              >
                <Settings size={13} strokeWidth={1.75} className="text-white/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-44 rounded-lg border border-white/[0.12] bg-black/[0.92] p-1 font-mono text-white/70 backdrop-blur-sm"
            >
              {onRestart && (
                <DropdownMenuItem
                  onClick={onRestart}
                  className="cursor-pointer rounded px-2 py-1.5 text-xs tracking-wide focus:bg-white/[0.08] focus:text-white/90"
                >
                  <RotateCcw size={13} strokeWidth={1.75} />
                  Restart course
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onDelete}
                  className="cursor-pointer rounded px-2 py-1.5 text-xs tracking-wide text-red-400/80 focus:bg-red-500/15 focus:text-red-300"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Delete course
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Separator className="bg-white/[0.08]" />

      {/* Orbit */}
      <ToggleGroup
        type="single"
        value={toolMode === 'orbit' ? 'orbit' : ''}
        onValueChange={(v) => {
          if (v) onToolChange('orbit')
        }}
        orientation="vertical"
        spacing={0}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <ToggleGroupItem value="orbit" className={`${ITEM_BASE} ${ORBIT_ACTIVE}`}>
          <span className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe size={12} strokeWidth={1.75} />
              Orbit
            </span>
            <kbd className="rounded border border-white/10 px-1 font-mono text-[9px] text-white/25">
              O
            </kbd>
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator className="bg-white/[0.08]" />

      {/* Sculpt + object tools */}
      <ToggleGroup
        type="single"
        value={isSculpt ? toolMode : isObject ? 'object' : ''}
        onValueChange={(v) => {
          if (v) onToolChange(v as ToolMode)
        }}
        orientation="vertical"
        spacing={0}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {SCULPT_TOOLS.map(({ id, label, key, Icon }) => (
          <ToggleGroupItem key={id} value={id} className={`${ITEM_BASE} ${SCULPT_ACTIVE}`}>
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <Icon size={12} strokeWidth={1.75} />
                {label}
              </span>
              <kbd className="rounded border border-white/10 px-1 font-mono text-[9px] text-white/25">
                {key}
              </kbd>
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Brush size + shape — sculpt tools only */}
      {isSculpt && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white/35">Brush — {brushSize}vx</span>
            <Slider
              min={1}
              max={12}
              value={[brushSize]}
              onValueChange={(vals) => onBrushChange(vals[0])}
              className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-white/15"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white/35">
              Shape —{' '}
              {brushRoundness === 0
                ? 'Square'
                : brushRoundness === 1
                  ? 'Round'
                  : `${Math.round(brushRoundness * 100)}% round`}
            </span>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={[brushRoundness]}
              onValueChange={(vals) => onRoundnessChange(vals[0])}
              className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-white/15"
            />
          </div>
        </div>
      )}

      {/* Surface palette — paint mode only */}
      {toolMode === 'paint' && (
        <div>
          <div className="mb-1.5 text-[10px] text-white/35">Surface</div>
          <div className="flex flex-wrap gap-1">
            {PAINTABLE.map((s) => {
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
                    'box-border size-6 cursor-pointer rounded border-2 transition-all',
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

      {/* Object picker + golfer — object mode only */}
      {isObject && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-white/35">Place object</div>
          <div className="flex flex-col gap-0.5">
            {ALL_OBJECT_TYPES.map((t) => {
              const active = selectedObjType === t
              return (
                <div
                  key={t}
                  onClick={() => onObjTypeChange(t)}
                  className={[
                    'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-all',
                    active
                      ? 'bg-green-900/50 text-green-200'
                      : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80',
                  ].join(' ')}
                >
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-sm border border-white/20"
                    style={{ background: OBJECT_SWATCH[t] }}
                  />
                  {OBJECT_NAMES[t]}
                </div>
              )
            })}
          </div>
          <Separator className="bg-white/[0.08]" />
          <div
            onClick={onGolferToggle}
            className={[
              'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-all',
              showGolfer
                ? 'bg-white/10 text-white/90'
                : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70',
            ].join(' ')}
          >
            <span className="inline-block size-2.5 shrink-0 rounded-full border border-white/30 bg-white/60" />
            Golfer silhouette
          </div>
          <p className="text-[10px] leading-relaxed text-white/22">
            Click terrain: place
            <br />
            Click object: select
            <br />
            Drag arrows: move
            <br />
            Drag ring: rotate
            <br />
            Del: remove selected
          </p>
        </div>
      )}

      <Separator className="bg-white/[0.08]" />

      {/* Time of day */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-white/35">Time — {formatHour(timeOfDay)}</span>
        <Slider
          min={0}
          max={24}
          step={0.1}
          value={[timeOfDay]}
          onValueChange={(vals) => onTimeOfDayChange(vals[0])}
          className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-white/15"
        />
      </div>

      {/* Keyboard / touch hints — sculpt/orbit only */}
      {!isObject && (
        <p className="text-[10px] leading-relaxed text-white/22">
          L-drag: sculpt
          <br />
          R-drag: orbit
          <br />
          Scroll: zoom
          <br />
          Mobile: orbit mode
          <br />+ 2-finger zoom
        </p>
      )}

      <Separator className="bg-white/[0.08]" />

      {/* Walk mode entry */}
      <button
        onClick={onEnterWalk}
        className="w-full cursor-pointer rounded border border-green-800/40 bg-green-900/20 py-1.5 text-center text-xs tracking-wide text-green-300/70 transition-all hover:bg-green-900/40 hover:text-green-200"
      >
        Walk mode
      </button>
    </div>
  )
}
