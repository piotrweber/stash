import { useMemo, useState, useRef } from 'react'
import { useCollectionStore } from '../../store/collectionStore'
import { FilterSortBar } from '../shared/FilterSortBar'
import { applyFilters, applySort } from '../shared/filterSort'
import type { Item, Field } from '../../types/collection'

export function TableView() {
  const { collection, addItem, updateItem, setTableState } = useCollectionStore()

  const tableState = collection?.views.table
  const schema = collection?.schema

  const sortFields = useMemo(() => [
    { id: 'name', name: 'Name' },
    { id: 'description', name: 'Description' },
    ...(schema?.fields ?? []).map((f) => ({ id: f.id, name: f.name })),
  ], [schema])

  const filterFields = useMemo(() => [
    { id: 'name', name: 'Name', type: 'text' as const },
    { id: 'description', name: 'Description', type: 'text' as const },
    ...(schema?.fields ?? []).map((f) => ({ id: f.id, name: f.name, type: f.type })),
  ], [schema])

  const processedItems = useMemo(() => {
    if (!collection) return []
    const filtered = applyFilters(collection.items, tableState?.filters ?? [])
    return applySort(filtered, tableState?.sortBy ?? null, tableState?.sortDir ?? 'asc')
  }, [collection, tableState])

  if (!collection || !tableState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open.
      </div>
    )
  }

  const fields = collection.schema.fields

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <FilterSortBar
        sortFields={sortFields}
        filterFields={filterFields}
        schemaFields={fields}
        sortBy={tableState.sortBy}
        sortDir={tableState.sortDir}
        onSortChange={(sortBy, sortDir) => setTableState({ sortBy, sortDir })}
        filters={tableState.filters}
        onFiltersChange={(filters) => setTableState({ filters })}
      />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2.5 w-16" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
              {fields.map((f) => (
                <th key={f.id} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item) => (
              <TableRow key={item.id} item={item} fields={fields} onUpdate={(patch) => updateItem(item.id, patch)} />
            ))}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => addItem({ name: 'New item', description: '', imagePath: '', fields: {}, canvas: { x: 0, y: 0 } })}
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    </div>
  )
}

function TableRow({ item, fields, onUpdate }: {
  item: Item
  fields: Field[]
  onUpdate: (patch: Partial<Item>) => void
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group">
      {/* Image */}
      <td className="px-3 py-1.5">
        <ImageCell item={item} onUpdate={onUpdate} />
      </td>

      {/* Name */}
      <td className="px-3 py-1.5">
        <EditableText
          value={item.name}
          onSave={(v) => onUpdate({ name: v })}
          className="font-medium text-gray-800"
        />
      </td>

      {/* Description */}
      <td className="px-3 py-1.5">
        <EditableText
          value={item.description}
          onSave={(v) => onUpdate({ description: v })}
          placeholder="—"
          className="text-gray-500"
          multiline
        />
      </td>

      {/* Schema fields */}
      {fields.map((field) => (
        <td key={field.id} className="px-3 py-1.5">
          <FieldCell
            field={field}
            value={item.fields[field.id] ?? null}
            onChange={(v) => onUpdate({ fields: { ...item.fields, [field.id]: v } })}
          />
        </td>
      ))}
    </tr>
  )
}

function ImageCell({ item, onUpdate }: { item: Item; onUpdate: (patch: Partial<Item>) => void }) {
  const handleClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => onUpdate({ imagePath: reader.result as string })
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div
      onClick={handleClick}
      className="w-12 h-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-shadow"
      title={item.imagePath ? 'Click to replace image' : 'Click to upload image'}
    >
      {item.imagePath ? (
        <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
      ) : (
        <span className="text-lg font-medium text-gray-400 select-none">
          {item.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function EditableText({ value, onSave, placeholder = '', className = '', multiline = false }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  const start = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => ref.current?.select(), 0)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
  }

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown,
      autoFocus: true,
      className: `w-full bg-white border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none ${className}`,
    }
    return multiline
      ? <textarea {...shared} rows={2} className={shared.className + ' resize-none'} />
      : <input {...shared} />
  }

  return (
    <div
      onClick={start}
      className={`cursor-text rounded px-2 py-1 text-sm hover:bg-gray-100 transition-colors min-h-[28px] ${className} ${!value ? 'text-gray-300' : ''}`}
    >
      {value || placeholder}
    </div>
  )
}

function FieldCell({ field, value, onChange }: {
  field: Field
  value: Item['fields'][string]
  onChange: (v: Item['fields'][string]) => void
}) {
  if (field.type === 'select') {
    return (
      <select
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-xs border-0 bg-transparent text-gray-700 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full"
      >
        <option value="">—</option>
        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }

  if (field.type === 'multi-select') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {field.options.map((opt) => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <EditableText
        value={(value as string) ?? ''}
        onSave={onChange}
        placeholder="—"
        className="text-gray-700"
      />
    )
  }

  if (field.type === 'number') {
    return (
      <EditableNumber
        value={value as number | null}
        onSave={onChange}
      />
    )
  }

  return null
}

function EditableNumber({ value, onSave }: {
  value: number | null
  onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  const commit = () => {
    setEditing(false)
    const n = draft === '' ? null : Number(draft)
    if (n !== value) onSave(isNaN(n as number) ? null : n)
  }

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none"
      />
    )
  }

  return (
    <div
      onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
      className={`cursor-text rounded px-2 py-1 text-sm hover:bg-gray-100 transition-colors min-h-[28px] ${value == null ? 'text-gray-300' : 'text-gray-700'}`}
    >
      {value ?? '—'}
    </div>
  )
}
