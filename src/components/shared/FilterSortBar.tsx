import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Filter, Field } from '../../types/collection'

type Op = Filter['op']

interface SortableField { id: string; name: string }
interface FilterableField extends SortableField { type: Field['type'] | 'text' }

interface FilterSortBarProps {
  sortFields: SortableField[]
  filterFields: FilterableField[]
  schemaFields: Field[]
  sortBy: string | null
  sortDir: 'asc' | 'desc'
  onSortChange: (sortBy: string | null, sortDir: 'asc' | 'desc') => void
  filters: Filter[]
  onFiltersChange: (filters: Filter[]) => void
  groupBy?: string | null
  onGroupByChange?: (fieldId: string | null) => void
  groupableFields?: SortableField[]
  endSlot?: React.ReactNode
  bare?: boolean
}

const OP_LABELS: Record<Op, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  is_any_of: 'is any of',
}

function opsForType(type: FilterableField['type']): Op[] {
  if (type === 'select') return ['is', 'is_not', 'is_any_of']
  if (type === 'multi-select') return ['is_any_of', 'contains']
  if (type === 'number') return ['is', 'is_not']
  return ['is', 'is_not', 'contains']
}

// ─── Dropdown portal ──────────────────────────────────────────────────────────

function useDropdown(anchor: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const toggle = useCallback(() => {
    if (!anchor.current) return
    if (!open) {
      const r = anchor.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen((v) => !v)
  }, [open, anchor])

  const close = useCallback(() => setOpen(false), [])

  return { open, pos, toggle, close }
}

function Dropdown({ pos, onClose, children, width = 260 }: {
  pos: { top: number; left: number }
  onClose: () => void
  children: React.ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const left = Math.min(pos.left, window.innerWidth - width - 12)
  const top = Math.min(pos.top, window.innerHeight - 400)

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({ filters, filterFields, onChange, onClose, pos }: {
  filters: Filter[]
  filterFields: FilterableField[]
  onChange: (f: Filter[]) => void
  onClose: () => void
  pos: { top: number; left: number }
}) {
  const activeIds = new Set(filters.map((f) => f.fieldId))

  const toggle = (field: FilterableField) => {
    if (activeIds.has(field.id)) {
      onChange(filters.filter((f) => f.fieldId !== field.id))
    } else {
      const op = opsForType(field.type)[0]
      onChange([...filters, { fieldId: field.id, op, value: '' }])
    }
  }

  return (
    <Dropdown pos={pos} onClose={onClose} width={200}>
      <div className="py-1">
        {filterFields.map((f) => (
          <button
            key={f.id}
            onClick={() => toggle(f)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              activeIds.has(f.id) ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              activeIds.has(f.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
            }`}>
              {activeIds.has(f.id) && <span className="text-white text-[9px] leading-none">✓</span>}
            </span>
            {f.name}
          </button>
        ))}
      </div>
    </Dropdown>
  )
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function SortDropdown({ sortBy, sortDir, sortFields, onChange, onClose, pos }: {
  sortBy: string | null
  sortDir: 'asc' | 'desc'
  sortFields: SortableField[]
  onChange: (sortBy: string | null, sortDir: 'asc' | 'desc') => void
  onClose: () => void
  pos: { top: number; left: number }
}) {
  return (
    <Dropdown pos={pos} onClose={onClose} width={220}>
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort</span>
      </div>

      {sortBy && (
        <div className="px-3 py-2.5 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 font-medium flex-1">{sortFields.find((f) => f.id === sortBy)?.name}</span>
            <button onClick={() => onChange(null, 'asc')} className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none">×</button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onChange(sortBy, 'asc')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortDir === 'asc' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 9V3M6 3L3 6M6 3l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Ascending
            </button>
            <button
              onClick={() => onChange(sortBy, 'desc')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortDir === 'desc' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 3v6M6 9L3 6M6 9l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Descending
            </button>
          </div>
        </div>
      )}

      <div className="py-1">
        {!sortBy && <p className="text-xs text-gray-400 px-3 py-2">Pick a field to sort by</p>}
        {sortFields.map((f) => (
          <button
            key={f.id}
            onClick={() => { onChange(f.id, sortDir); }}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
              sortBy === f.id ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {sortBy === f.id && <span className="text-indigo-500 text-[10px]">✓</span>}
            {f.name}
          </button>
        ))}
      </div>
    </Dropdown>
  )
}

// ─── Group dropdown ───────────────────────────────────────────────────────────

function GroupDropdown({ groupBy, groupableFields, onChange, onClose, pos }: {
  groupBy: string | null
  groupableFields: SortableField[]
  onChange: (fieldId: string | null) => void
  onClose: () => void
  pos: { top: number; left: number }
}) {
  return (
    <Dropdown pos={pos} onClose={onClose} width={200}>
      <div className="px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Group by</span>
      </div>
      <div className="py-1">
        <button
          onClick={() => { onChange(null); onClose() }}
          className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            !groupBy ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {!groupBy && <span className="text-indigo-500 text-[10px]">✓</span>}
          No grouping
        </button>
        {groupableFields.map((f) => (
          <button
            key={f.id}
            onClick={() => { onChange(f.id); onClose() }}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
              groupBy === f.id ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {groupBy === f.id && <span className="text-indigo-500 text-[10px]">✓</span>}
            {f.name}
          </button>
        ))}
      </div>
    </Dropdown>
  )
}

// ─── Main bar ─────────────────────────────────────────────────────────────────

export function FilterSortBar({
  sortFields, filterFields, schemaFields,
  sortBy, sortDir, onSortChange,
  filters, onFiltersChange,
  groupBy, onGroupByChange, groupableFields,
  endSlot,
  bare = false,
}: FilterSortBarProps) {
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const groupBtnRef = useRef<HTMLButtonElement>(null)

  const filterDrop = useDropdown(filterBtnRef)
  const sortDrop = useDropdown(sortBtnRef)
  const groupDrop = useDropdown(groupBtnRef)

  const closeAll = () => { filterDrop.close(); sortDrop.close(); groupDrop.close() }

  const hasActive = filters.length > 0 || !!sortBy || !!groupBy
  const groupName = groupBy ? groupableFields?.find((f) => f.id === groupBy)?.name : null
  const sortName = sortBy ? sortFields.find((f) => f.id === sortBy)?.name : null

  const inner = (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* Filter */}
      <button
        ref={filterBtnRef}
        onClick={() => { closeAll(); filterDrop.toggle() }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
          filters.length > 0
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Filter
        {filters.length > 0 && (
          <span className="bg-indigo-200 text-indigo-800 rounded-full px-1.5 text-[10px] font-semibold leading-4">
            {filters.length}
          </span>
        )}
      </button>

      {/* Sort */}
      <button
        ref={sortBtnRef}
        onClick={() => { closeAll(); sortDrop.toggle() }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
          sortBy
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 5h12M4 8h8M6 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Sort
        {sortName && (
          <span className="text-indigo-600 font-semibold">{sortName} {sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </button>

      {/* Group */}
      {onGroupByChange && groupableFields && groupableFields.length > 0 && (
        <button
          ref={groupBtnRef}
          onClick={() => { closeAll(); groupDrop.toggle() }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            groupBy
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          Group
          {groupName && <span className="text-indigo-600 font-semibold">{groupName}</span>}
        </button>
      )}

      {hasActive && (
        <button
          onClick={() => { onFiltersChange([]); onSortChange(null, 'asc'); onGroupByChange?.(null); closeAll() }}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Clear
        </button>
      )}

      {endSlot && <div className="ml-auto pl-2">{endSlot}</div>}

      {/* Portals */}
      {filterDrop.open && filterDrop.pos && (
        <FilterDropdown
          filters={filters}
          filterFields={filterFields}
          onChange={onFiltersChange}
          onClose={filterDrop.close}
          pos={filterDrop.pos}
        />
      )}
      {sortDrop.open && sortDrop.pos && (
        <SortDropdown
          sortBy={sortBy}
          sortDir={sortDir}
          sortFields={sortFields}
          onChange={onSortChange}
          onClose={sortDrop.close}
          pos={sortDrop.pos}
        />
      )}
      {groupDrop.open && groupDrop.pos && onGroupByChange && groupableFields && (
        <GroupDropdown
          groupBy={groupBy ?? null}
          groupableFields={groupableFields}
          onChange={onGroupByChange}
          onClose={groupDrop.close}
          pos={groupDrop.pos}
        />
      )}
    </div>
  )

  if (bare) return <>{inner}</>

  return (
    <div className="border-b border-gray-100 bg-white shrink-0 px-3 py-1.5">
      {inner}
    </div>
  )
}
