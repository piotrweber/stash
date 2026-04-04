import { useState } from 'react'
import { nanoid } from 'nanoid'
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
}

function opsForField(field: FilterableField | undefined): Op[] {
  if (!field) return ['is', 'is_not', 'contains']
  if (field.type === 'select') return ['is', 'is_not', 'is_any_of']
  if (field.type === 'multi-select') return ['is_any_of', 'contains']
  if (field.type === 'number') return ['is', 'is_not']
  return ['is', 'is_not', 'contains']
}

const OP_LABELS: Record<Op, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  is_any_of: 'is any of',
}

export function FilterSortBar({
  sortFields, filterFields, schemaFields,
  sortBy, sortDir, onSortChange,
  filters, onFiltersChange,
}: FilterSortBarProps) {
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)

  const addFilter = () => {
    const first = filterFields[0]
    if (!first) return
    onFiltersChange([...filters, { fieldId: first.id, op: 'contains', value: '' }])
    setShowFilter(true)
  }

  const updateFilter = (idx: number, patch: Partial<Filter>) => {
    const next = filters.map((f, i) => {
      if (i !== idx) return f
      const updated = { ...f, ...patch }
      // reset value when field or op changes
      if (patch.fieldId !== undefined || patch.op !== undefined) updated.value = ''
      return updated
    })
    onFiltersChange(next)
  }

  const removeFilter = (idx: number) => {
    const next = filters.filter((_, i) => i !== idx)
    onFiltersChange(next)
    if (!next.length) setShowFilter(false)
  }

  const sortLabel = sortBy ? (sortFields.find((f) => f.id === sortBy)?.name ?? sortBy) : null

  return (
    <div className="border-b border-gray-100 bg-white shrink-0">
      {/* Toolbar row */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button
          onClick={() => { setShowFilter((v) => !v); setShowSort(false) }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            filters.length > 0
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Filter
          {filters.length > 0 && (
            <span className="ml-0.5 bg-indigo-200 text-indigo-800 rounded-full px-1.5 text-[10px] font-semibold">
              {filters.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setShowSort((v) => !v); setShowFilter(false) }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            sortBy
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M2 5h12M4 8h8M6 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Sort
          {sortLabel && (
            <span className="ml-0.5 text-indigo-600 font-semibold">
              {sortLabel} {sortDir === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </button>

        {(filters.length > 0 || sortBy) && (
          <button
            onClick={() => { onFiltersChange([]); onSortChange(null, 'asc'); setShowFilter(false); setShowSort(false) }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {filters.map((filter, idx) => {
            const field = filterFields.find((f) => f.id === filter.fieldId)
            const ops = opsForField(field)
            const schemaField = schemaFields.find((f) => f.id === filter.fieldId)
            const hasOptions = (field?.type === 'select' || field?.type === 'multi-select') && schemaField?.options.length

            return (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                {/* Field */}
                <select
                  value={filter.fieldId}
                  onChange={(e) => updateFilter(idx, { fieldId: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                >
                  {filterFields.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={filter.op}
                  onChange={(e) => updateFilter(idx, { op: e.target.value as Op })}
                  className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                >
                  {ops.map((op) => (
                    <option key={op} value={op}>{OP_LABELS[op]}</option>
                  ))}
                </select>

                {/* Value */}
                {hasOptions && filter.op === 'is_any_of' ? (
                  <div className="flex flex-wrap gap-1">
                    {schemaField!.options.map((opt) => {
                      const arr = Array.isArray(filter.value) ? filter.value : []
                      const active = arr.includes(opt)
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            const next = active ? arr.filter((v) => v !== opt) : [...arr, opt]
                            updateFilter(idx, { value: next })
                          }}
                          className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                            active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                ) : hasOptions ? (
                  <select
                    value={filter.value as string}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">—</option>
                    {schemaField!.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field?.type === 'number' ? 'number' : 'text'}
                    value={filter.value as string}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder="Value…"
                    className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400 w-32"
                  />
                )}

                <button onClick={() => removeFilter(idx)} className="text-gray-300 hover:text-red-400 transition-colors ml-auto">×</button>
              </div>
            )
          })}

          <button
            onClick={addFilter}
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors text-left"
          >
            + Add filter
          </button>
        </div>
      )}

      {/* Sort panel */}
      {showSort && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <select
            value={sortBy ?? ''}
            onChange={(e) => onSortChange(e.target.value || null, sortDir)}
            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
          >
            <option value="">No sort</option>
            {sortFields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {sortBy && (
            <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => onSortChange(sortBy, 'asc')}
                className={`px-2.5 py-1 transition-colors ${sortDir === 'asc' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                ↑ Asc
              </button>
              <button
                onClick={() => onSortChange(sortBy, 'desc')}
                className={`px-2.5 py-1 transition-colors ${sortDir === 'desc' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                ↓ Desc
              </button>
            </div>
          )}

          {sortBy && (
            <button onClick={() => onSortChange(null, 'asc')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
