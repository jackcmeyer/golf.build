import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TerrainPreset } from '../engine/terrainPresets'

interface Props {
  userId: string | null
  onCreate: (courseId: string, preset: TerrainPreset) => void
  onClose: () => void
}

type Mode = 'terrain' | 'blank'

interface Preset {
  id: TerrainPreset
  label: string
  desc: string
  icon: string
}

const PRESETS: Preset[] = [
  {
    id: 'default',
    label: 'Classic',
    desc: 'Gentle hills, dogleg fairway, water hazard',
    icon: '🌿',
  },
  {
    id: 'parkland',
    label: 'Parkland',
    desc: 'Rolling landscape with trees and a river',
    icon: '🌳',
  },
  { id: 'links', label: 'Links', desc: 'Coastal dunes, fescue rough, open sky', icon: '🌊' },
  { id: 'mountain', label: 'Mountain', desc: 'Dramatic elevation, rock outcrops', icon: '⛰️' },
  { id: 'desert', label: 'Desert', desc: 'Waste areas, sand bunkers, bare terrain', icon: '☀️' },
]

export function OnboardingModal({ userId, onCreate, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('terrain')
  const [selectedPreset, setSelectedPreset] = useState<TerrainPreset>('default')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (creating) return
    const preset: TerrainPreset = mode === 'blank' ? 'blank' : selectedPreset
    const courseId = crypto.randomUUID()
    if (!supabase || !userId) {
      onCreate(courseId, preset)
      return
    }
    setCreating(true)
    const { error } = await supabase
      .from('courses')
      .insert({ id: courseId, user_id: userId, name: 'Untitled Course' })
    setCreating(false)
    if (!error) onCreate(courseId, preset)
  }

  const modeBtn = (m: Mode, _label: string): React.CSSProperties => ({
    flex: 1,
    background: mode === m ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${mode === m ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 8,
    color: mode === m ? 'rgba(134,239,172,0.9)' : 'rgba(255,255,255,0.45)',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '10px 0',
    cursor: 'pointer',
    textAlign: 'center',
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 110,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'rgba(12,12,16,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '28px 28px 24px',
          width: 420,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>New Course</div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={modeBtn('terrain', 'Generate terrain')} onClick={() => setMode('terrain')}>
            Generate terrain
          </button>
          <button style={modeBtn('blank', 'Blank canvas')} onClick={() => setMode('blank')}>
            Blank canvas
          </button>
        </div>

        {/* Terrain presets */}
        {mode === 'terrain' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.05em',
                marginBottom: 2,
              }}
            >
              TERRAIN STYLE
            </div>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background:
                    selectedPreset === p.id ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedPreset === p.id ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{p.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        selectedPreset === p.id
                          ? 'rgba(134,239,172,0.9)'
                          : 'rgba(255,255,255,0.75)',
                      fontWeight: selectedPreset === p.id ? 600 : 400,
                    }}
                  >
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                    {p.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'blank' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.7,
            }}
          >
            Starts as a flat fairway surface — sculpt from scratch.
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 0,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '9px 16px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              flex: 1,
              background: creating ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: 6,
              color: 'rgba(134,239,172,0.9)',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '9px 0',
              cursor: creating ? 'default' : 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            {creating ? 'Creating…' : 'Create course →'}
          </button>
        </div>
      </div>
    </div>
  )
}
