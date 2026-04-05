import { useState } from 'react'
import { useCollectionStore } from '../../store/collectionStore'
import { OPTION_COLORS, COLOR_KEYS } from '../shared/optionColors'
import type { FieldType } from '../../types/collection'

interface SchemaEditorProps {
  onClose: () => void
}

export function SchemaEditor({ onClose }: SchemaEditorProps) {
  const { collection, addField, updateField, deleteField } = useCollectionStore()
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('select')

  if (!collection) return null

  const { fields, cardVisibleFields } = collection.schema

  const handleAddField = () => {
    if (!newFieldName.trim()) return
    addField({ name: newFieldName.trim(), type: newFieldType, options: [] })
    setNewFieldName('')
    setNewFieldType('select')
  }

  const handleDeleteField = (id: string, name: string) => {
    if (!confirm(`Delete field "${name}"? This will clear its value on all items.`)) return
    deleteField(id)
  }

  const toggleCardVisible = (fieldId: string) => {
    const next = cardVisibleFields.includes(fieldId)
      ? cardVisibleFields.filter((id) => id !== fieldId)
      : [...cardVisibleFields, fieldId]
    useCollectionStore.getState().updateField(fieldId, {}) // trigger a re-render via a no-op
    // We need to update schema.cardVisibleFields directly — patch via a workaround
    const store = useCollectionStore.getState()
    const col = store.collection
    if (!col) return
    // Directly mutate via zustand's setState
    useCollectionStore.setState({
      collection: {
        ...col,
        schema: { ...col.schema, cardVisibleFields: next },
      },
      isDirty: true,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">Schema editor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No fields yet. Add one below.</p>
          )}

          {fields.map((field) => (
            <div key={field.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
              <div className="flex-1 flex flex-col gap-2">
                {/* Name + type row */}
                <div className="flex gap-2">
                  <input
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value })}
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                    className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none"
                  >
                    <option value="select">Select</option>
                    <option value="multi-select">Multi-select</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
                </div>

                {/* Options (for select types) */}
                {(field.type === 'select' || field.type === 'multi-select') && (
                  <OptionsEditor
                    options={field.options}
                    optionColors={field.optionColors ?? {}}
                    onChange={(opts) => updateField(field.id, { options: opts })}
                    onColorChange={(colors) => updateField(field.id, { optionColors: colors })}
                  />
                )}

                {/* Card badge toggle */}
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cardVisibleFields.includes(field.id)}
                    onChange={() => toggleCardVisible(field.id)}
                    className="rounded"
                  />
                  Show as badge on cards
                </label>
              </div>

              <button
                onClick={() => handleDeleteField(field.id, field.name)}
                className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none mt-0.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add field */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-2">
          <input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            placeholder="New field name…"
            className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none"
          >
            <option value="select">Select</option>
            <option value="multi-select">Multi-select</option>
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
          <button
            onClick={handleAddField}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function OptionsEditor({
  options, optionColors, onChange, onColorChange,
}: {
  options: string[]
  optionColors: Record<string, string>
  onChange: (opts: string[]) => void
  onColorChange: (colors: Record<string, string>) => void
}) {
  const [input, setInput] = useState('')
  const [pickingColorFor, setPickingColorFor] = useState<string | null>(null)

  const add = () => {
    const v = input.trim()
    if (!v || options.includes(v)) return
    onChange([...options, v])
    setInput('')
  }

  const setColor = (opt: string, colorKey: string) => {
    onColorChange({ ...optionColors, [opt]: colorKey })
    setPickingColorFor(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1">
        {options.map((opt) => {
          const colorKey = optionColors[opt] ?? 'gray'
          const c = OPTION_COLORS[colorKey] ?? OPTION_COLORS.gray
          return (
            <div key={opt} className="flex items-center gap-1.5">
              {/* Color dot — click to pick */}
              <button
                onClick={() => setPickingColorFor(pickingColorFor === opt ? null : opt)}
                style={{ background: c.bg, borderColor: c.border, border: '1px solid' }}
                className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110"
                title="Pick color"
              />
              <span
                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, border: '1px solid' }}
                className="text-xs px-2 py-0.5 rounded-full flex-1"
              >
                {opt}
              </span>
              <button
                onClick={() => onChange(options.filter((o) => o !== opt))}
                className="text-gray-300 hover:text-red-500 leading-none text-base"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* Color picker */}
      {pickingColorFor && (
        <div className="flex flex-wrap gap-1 px-1">
          {COLOR_KEYS.map((key) => {
            const c = OPTION_COLORS[key]
            return (
              <button
                key={key}
                onClick={() => setColor(pickingColorFor, key)}
                style={{ background: c.bg, borderColor: optionColors[pickingColorFor] === key ? c.text : c.border, border: '2px solid' }}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                title={key}
              />
            )
          })}
        </div>
      )}

      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add option…"
          className="flex-1 border border-gray-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-300 bg-gray-50"
        />
        <button onClick={add} className="text-xs text-indigo-600 hover:text-indigo-800 px-1">+</button>
      </div>
    </div>
  )
}
