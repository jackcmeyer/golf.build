import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowUp,
  Footprints,
  Globe,
  Minus,
  Paintbrush,
  Redo2,
  RotateCcw,
  Route,
  Settings,
  Shapes,
  Sun,
  Trash2,
  Undo2,
  Waves,
} from 'lucide-react'
import { VoxelType, VOXEL_COLORS } from '../voxelTypes'
import { ToolMode } from '../engine/toolUtils'
import { ObjectType, OBJECT_NAMES } from '../engine/objectTypes'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SCULPT_TOOLS: { id: ToolMode; label: string; key: string; Icon: LucideIcon }[] = [
  { id: 'paint', label: 'Paint', key: 'P', Icon: Paintbrush },
  { id: 'raise', label: 'Raise', key: 'R', Icon: ArrowUp },
  { id: 'lower', label: 'Lower', key: 'L', Icon: ArrowDown },
  { id: 'flatten', label: 'Flatten', key: 'F', Icon: Minus },
  { id: 'smooth', label: 'Smooth', key: 'S', Icon: Waves },
  { id: 'object', label: 'Objects', key: 'E', Icon: Shapes },
  { id: 'hole', label: 'Hole', key: 'H', Icon: Route },
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

// Shared base for every square icon button in the rail.
const RAIL_BTN = cn(
  'flex size-9 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-all',
  'hover:bg-white/[0.08] hover:text-white/85',
  'data-[state=open]:bg-white/[0.10] data-[state=open]:text-white/90',
  'disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-white/45',
)

// Frosted-glass styling shared by every hover tooltip.
const TOOLTIP_GLASS = 'glass rounded-lg bg-neutral-950/70 text-white/90'

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

/** A single icon button in the rail, with a hover tooltip showing its label + shortcut. */
function RailButton({
  Icon,
  label,
  shortcut,
  active,
  accent = 'sculpt',
  disabled,
  onClick,
}: {
  Icon: LucideIcon
  label: string
  shortcut?: string
  active?: boolean
  accent?: 'orbit' | 'sculpt'
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            RAIL_BTN,
            active &&
              accent === 'orbit' &&
              'bg-blue-900/50 text-blue-200 hover:bg-blue-900/50 hover:text-blue-200',
            active &&
              accent === 'sculpt' &&
              'bg-green-900/50 text-green-200 hover:bg-green-900/50 hover:text-green-200',
          )}
        >
          <Icon size={17} strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className={TOOLTIP_GLASS}>
        {label}
        {shortcut && <span className="ml-1.5 opacity-50">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
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
  const isMeasure = toolMode === 'hole'
  const isSculpt = toolMode !== 'orbit' && toolMode !== 'object' && !isMeasure
  const isObject = toolMode === 'object'
  const isMac = /mac/i.test(navigator.platform) || /mac os/i.test(navigator.userAgent)
  // The active tool's metadata — drives the contextual options panel. Undefined in orbit mode.
  const activeTool = SCULPT_TOOLS.find((t) => t.id === toolMode)

  return (
    <TooltipProvider delayDuration={0}>
      <div className="pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 items-start gap-2 font-mono select-none">
        {/* Icon rail */}
        <div className="glass pointer-events-auto flex flex-col gap-1 rounded-2xl bg-neutral-950/55 p-1.5">
          {/* Orbit / navigate */}
          <RailButton
            Icon={Globe}
            label="Orbit"
            shortcut="O"
            accent="orbit"
            active={toolMode === 'orbit'}
            onClick={() => onToolChange('orbit')}
          />

          <Separator className="my-0.5 bg-white/[0.08]" />

          {/* Sculpt / paint / object tools */}
          {SCULPT_TOOLS.map(({ id, label, key, Icon }) => (
            <RailButton
              key={id}
              Icon={Icon}
              label={label}
              shortcut={key}
              active={toolMode === id}
              onClick={() => onToolChange(id)}
            />
          ))}

          <Separator className="my-0.5 bg-white/[0.08]" />

          {/* History */}
          <RailButton
            Icon={Undo2}
            label="Undo"
            shortcut={isMac ? '⌘Z' : 'Ctrl+Z'}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <RailButton
            Icon={Redo2}
            label="Redo"
            shortcut={isMac ? '⌘⇧Z' : 'Ctrl+⇧Z'}
            disabled={!canRedo}
            onClick={onRedo}
          />

          {/* Course settings */}
          {(onRestart || onDelete) && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Settings" className={RAIL_BTN}>
                      <Settings size={17} strokeWidth={1.75} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className={TOOLTIP_GLASS}>
                  Settings
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={10}
                className="glass min-w-44 rounded-lg bg-neutral-950/65 p-1 font-mono text-white/70"
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

          <Separator className="my-0.5 bg-white/[0.08]" />

          {/* Time of day */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button aria-label="Time of day" className={RAIL_BTN}>
                    <Sun size={17} strokeWidth={1.75} />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className={TOOLTIP_GLASS}>
                Time — {formatHour(timeOfDay)}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              side="right"
              align="start"
              sideOffset={10}
              className="glass flex w-52 flex-col gap-2 rounded-xl bg-neutral-950/65 p-3 font-mono text-white/70"
            >
              <span className="text-[10px] text-white/35">Time — {formatHour(timeOfDay)}</span>
              <Slider
                min={0}
                max={24}
                step={0.1}
                value={[timeOfDay]}
                onValueChange={(vals) => onTimeOfDayChange(vals[0])}
                className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-white/15"
              />
            </PopoverContent>
          </Popover>

          {/* Walk mode */}
          <RailButton Icon={Footprints} label="Walk mode" onClick={onEnterWalk} />
        </div>

        {/* Contextual options for the active tool */}
        {activeTool && (
          <div className="glass pointer-events-auto flex w-44 flex-col gap-3 rounded-xl bg-neutral-950/50 p-3 text-sm">
            <div className="text-[11px] font-medium tracking-wide text-white/55">
              {activeTool.label}
            </div>

            {/* Surface palette — paint mode only */}
            {toolMode === 'paint' && (
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
                      className={cn(
                        'box-border size-6 cursor-pointer rounded border-2 transition-all',
                        active
                          ? 'border-white shadow-[0_0_0_1px_oklch(0.527_0.154_150.069)]'
                          : 'border-black/30 hover:border-white/40',
                      )}
                    />
                  )
                })}
              </div>
            )}

            {/* Brush size + shape — sculpt tools (incl. paint) */}
            {isSculpt && (
              <>
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
                <p className="text-[10px] leading-relaxed text-white/22">
                  L-drag: sculpt
                  <br />
                  R-drag: orbit
                  <br />
                  Scroll: zoom
                </p>
              </>
            )}

            {/* Object picker + golfer — object mode only */}
            {isObject && (
              <>
                <div className="flex flex-col gap-0.5">
                  {ALL_OBJECT_TYPES.map((t) => {
                    const active = selectedObjType === t
                    return (
                      <div
                        key={t}
                        onClick={() => onObjTypeChange(t)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-all',
                          active
                            ? 'bg-green-900/50 text-green-200'
                            : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80',
                        )}
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
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-all',
                    showGolfer
                      ? 'bg-white/10 text-white/90'
                      : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70',
                  )}
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
              </>
            )}

            {toolMode === 'hole' && (
              <p className="text-[10px] leading-relaxed text-white/30">
                Click the tee, then the green, to draw a hole. Yardage arcs count up from the tee.
                <br />
                <br />
                Drag an endpoint to adjust. Esc cancels. Del removes.
              </p>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
