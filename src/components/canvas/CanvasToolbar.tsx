import type { Field } from '../../types/collection'

export type CanvasTool = 'select' | 'pan'

const GRID_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Fine', value: 20 },
  { label: 'Normal', value: 40 },
  { label: 'Coarse', value: 80 },
]

interface CanvasToolbarProps {
  tool: CanvasTool
  onToolChange: (t: CanvasTool) => void
  grid: number
  onGridChange: (g: number) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onCleanup: () => void
  fields: Field[]
  groupBy: string | null
  onGroupByChange: (fieldId: string | null) => void
}

export function CanvasToolbar({
  tool, onToolChange,
  grid, onGridChange,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  onCleanup,
  fields, groupBy, onGroupByChange,
}: CanvasToolbarProps) {
  const groupableFields = fields.filter((f) => f.type === 'select' || f.type === 'multi-select')

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-md px-2 py-3 select-none">

      {/* Tool selector */}
      <ToolBtn active={tool === 'pan'} title="Pan (H)" onClick={() => onToolChange('pan')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 11V6a2 2 0 0 1 4 0v5M9 11a2 2 0 0 0-2 2v1M9 11h4m0 0a2 2 0 0 1 2 2v1m0 0a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </ToolBtn>
      <ToolBtn active={tool === 'select'} title="Select (S)" onClick={() => onToolChange('select')}>
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l4.5 10 1.5-4 4-1.5L2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      </ToolBtn>

      <Divider />

      {/* Grid granularity */}
      <span className="text-[10px] text-gray-400 font-medium mt-0.5">Grid</span>
      {GRID_OPTIONS.map((opt) => (
        <ToolBtn
          key={opt.value}
          active={grid === opt.value}
          title={`Grid: ${opt.label}`}
          onClick={() => onGridChange(opt.value)}
        >
          <span className="text-xs font-medium">{opt.label}</span>
        </ToolBtn>
      ))}

      <Divider />

      {/* Cleanup */}
      <ToolBtn title="Clean up (arrange in grid)" onClick={onCleanup}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="10" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </ToolBtn>

      {groupableFields.length > 0 && (
        <>
          <Divider />
          <span className="text-[10px] text-gray-400 font-medium mt-0.5">Stack</span>
          <ToolBtn
            active={groupBy === null}
            title="No grouping"
            onClick={() => onGroupByChange(null)}
          >
            <span className="text-xs font-medium">Off</span>
          </ToolBtn>
          {groupableFields.map((f) => (
            <ToolBtn
              key={f.id}
              active={groupBy === f.id}
              title={`Stack by ${f.name}`}
              onClick={() => onGroupByChange(f.id)}
            >
              <span className="text-[10px] font-medium leading-tight text-center">{f.name}</span>
            </ToolBtn>
          ))}
        </>
      )}

      <Divider />

      {/* Zoom */}
      <ToolBtn title="Zoom in" onClick={onZoomIn}>
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </ToolBtn>
      <button
        onClick={onZoomReset}
        title="Reset zoom"
        className="text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-1.5 py-1.5 transition-colors w-full text-center"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolBtn title="Zoom out" onClick={onZoomOut}>
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </ToolBtn>
    </div>
  )
}

function ToolBtn({
  active, onClick, title, children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="h-px w-full bg-gray-200 my-0.5" />
}
