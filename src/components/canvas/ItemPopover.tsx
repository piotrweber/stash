import { useState, useEffect } from 'react'
import type { Item, Schema, Field } from '../../types/collection'

interface ItemPopoverProps {
  item: Item
  schema: Schema
  anchorRect: { left: number; top: number; right: number; bottom: number }
  onUpdate: (patch: Partial<Item>) => void
  onDelete: () => void
  onClose: () => void
}

const POPOVER_W = 260
const GAP = 10

export function ItemPopover({ item, schema, anchorRect, onUpdate, onDelete, onClose }: ItemPopoverProps) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)

  useEffect(() => { setName(item.name) }, [item.name])
  useEffect(() => { setDescription(item.description) }, [item.description])

  const viewW = window.innerWidth
  const viewH = window.innerHeight

  let left = anchorRect.right + GAP
  if (left + POPOVER_W > viewW - 8) left = anchorRect.left - POPOVER_W - GAP
  left = Math.max(8, left)

  const top = Math.max(8, Math.min(anchorRect.top, viewH - 40))
  const maxH = viewH - top - 16

  const setField = (fieldId: string, value: Item['fields'][string]) => {
    onUpdate({ fields: { ...item.fields, [fieldId]: value } })
  }

  return (
    <div
      className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col"
      style={{ left, top, width: POPOVER_W, maxHeight: maxH, overflowY: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-600 truncate">{item.name}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2 shrink-0">×</button>
      </div>

      <div className="w-full h-32 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <div className="text-4xl text-gray-400">{item.name.charAt(0).toUpperCase()}</div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onUpdate({ name })}
          placeholder="Name"
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:border-indigo-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => onUpdate({ description })}
          placeholder="Description"
          rows={2}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:border-indigo-400"
        />

        {schema.fields.map((field) => (
          <FieldEditor
            key={field.id}
            field={field}
            value={item.fields[field.id] ?? null}
            onChange={(v) => setField(field.id, v)}
          />
        ))}

        <button
          onClick={() => { if (confirm(`Delete "${item.name}"?`)) onDelete() }}
          className="text-[10px] text-red-400 hover:text-red-600 transition-colors text-left mt-1"
        >
          Delete item
        </button>
      </div>
    </div>
  )
}

function FieldEditor({ field, value, onChange }: {
  field: Field
  value: Item['fields'][string]
  onChange: (v: Item['fields'][string]) => void
}) {
  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{field.name}</label>
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
        >
          <option value="">— none —</option>
          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'multi-select') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{field.name}</label>
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => {
            const active = selected.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{field.name}</label>
        <input
          defaultValue={(value as string) ?? ''}
          onBlur={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
        />
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div>
        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{field.name}</label>
        <input
          type="number"
          defaultValue={(value as number) ?? ''}
          onBlur={(e) => onChange(e.target.valueAsNumber)}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
        />
      </div>
    )
  }

  return null
}
