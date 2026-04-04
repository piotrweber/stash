import { useState, useEffect } from 'react'
import { useCollectionStore } from '../../store/collectionStore'
import type { Item, Field, FieldType } from '../../types/collection'

interface ItemDetailProps {
  itemId: string | null
  onClose: () => void
}

export function ItemDetail({ itemId, onClose }: ItemDetailProps) {
  const { collection, updateItem, deleteItem, updateField, addField, deleteField } = useCollectionStore()

  const toggleCardVisible = (fieldId: string) => {
    const col = useCollectionStore.getState().collection
    if (!col) return
    const cvf = col.schema.cardVisibleFields
    const next = cvf.includes(fieldId) ? cvf.filter((id) => id !== fieldId) : [...cvf, fieldId]
    useCollectionStore.setState({
      collection: { ...col, schema: { ...col.schema, cardVisibleFields: next } },
      isDirty: true,
    })
  }
  const item = collection?.items.find((i) => i.id === itemId) ?? null
  const [draft, setDraft] = useState<Item | null>(null)

  useEffect(() => {
    setDraft(item ? { ...item, fields: { ...item.fields } } : null)
  }, [itemId, item?.id])

  if (!itemId || !draft || !collection) {
    return (
      <div className="w-72 border-l border-gray-200 bg-white flex items-center justify-center text-gray-400 text-sm p-6 text-center">
        Select an item to edit
      </div>
    )
  }

  const save = () => {
    if (!draft) return
    updateItem(draft.id, draft)
  }

  const handleChange = <K extends keyof Item>(key: K, value: Item[K]) => {
    setDraft((d) => d ? { ...d, [key]: value } : d)
  }

  const handleFieldChange = (fieldId: string, value: string | string[] | number | null) => {
    setDraft((d) => d ? { ...d, fields: { ...d.fields, [fieldId]: value } } : d)
  }

  const handleDelete = () => {
    if (!confirm(`Delete "${draft.name}"?`)) return
    deleteItem(draft.id)
    onClose()
  }

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Item detail</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Image */}
        <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
          {draft.imagePath ? (
            <img src={draft.imagePath} alt={draft.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-4xl">{draft.name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            value={draft.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onBlur={save}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => handleChange('description', e.target.value)}
            onBlur={save}
            rows={3}
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Dynamic fields */}
        {collection.schema.fields.map((field) => {
          const val = draft.fields[field.id]

          if (field.type === 'select') {
            return (
              <FieldRow key={field.id} field={field} onDelete={() => deleteField(field.id)} cardVisible={collection.schema.cardVisibleFields.includes(field.id)} onToggleCardVisible={() => toggleCardVisible(field.id)}>
                <select
                  value={(val as string) ?? ''}
                  onChange={(e) => {
                    handleFieldChange(field.id, e.target.value || null)
                    setTimeout(save, 0)
                  }}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 bg-white mb-2"
                >
                  <option value="">— none —</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <OptionsEditor field={field} onUpdateField={updateField} />
              </FieldRow>
            )
          }

          if (field.type === 'text') {
            return (
              <FieldRow key={field.id} field={field} onDelete={() => deleteField(field.id)} cardVisible={collection.schema.cardVisibleFields.includes(field.id)} onToggleCardVisible={() => toggleCardVisible(field.id)}>
                <input
                  value={(val as string) ?? ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  onBlur={save}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                />
              </FieldRow>
            )
          }

          if (field.type === 'number') {
            return (
              <FieldRow key={field.id} field={field} onDelete={() => deleteField(field.id)} cardVisible={collection.schema.cardVisibleFields.includes(field.id)} onToggleCardVisible={() => toggleCardVisible(field.id)}>
                <input
                  type="number"
                  value={(val as number) ?? ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.valueAsNumber)}
                  onBlur={save}
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                />
              </FieldRow>
            )
          }

          if (field.type === 'multi-select') {
            const selected: string[] = Array.isArray(val) ? val : []
            return (
              <FieldRow key={field.id} field={field} onDelete={() => deleteField(field.id)} cardVisible={collection.schema.cardVisibleFields.includes(field.id)} onToggleCardVisible={() => toggleCardVisible(field.id)}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {field.options.map((opt) => {
                    const active = selected.includes(opt)
                    return (
                      <span key={opt} className="group relative flex items-center">
                        <button
                          onClick={() => {
                            const next = active
                              ? selected.filter((s) => s !== opt)
                              : [...selected, opt]
                            handleFieldChange(field.id, next)
                            setTimeout(save, 0)
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors pr-5 ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {opt}
                        </button>
                        <button
                          onClick={() => updateField(field.id, { options: field.options.filter((o) => o !== opt) })}
                          className="absolute right-1 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                          title="Remove option"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
                <OptionsEditor field={field} onUpdateField={updateField} />
              </FieldRow>
            )
          }

          return null
        })}

        {/* Add field */}
        <AddFieldRow onAdd={(name, type) => addField({ name, type, options: [] })} />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={handleDelete}
          className="w-full text-xs text-red-500 hover:text-red-700 transition-colors py-1"
        >
          Delete item
        </button>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  onDelete,
  cardVisible,
  onToggleCardVisible,
  children,
}: {
  field: Field
  onDelete: () => void
  cardVisible: boolean
  onToggleCardVisible: () => void
  children: React.ReactNode
}) {
  return (
    <div className="group/field">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">{field.name}</label>
        <div className="flex items-center gap-1.5 opacity-0 group-hover/field:opacity-100 transition-opacity">
          <button
            onClick={onToggleCardVisible}
            title={cardVisible ? 'Hide from canvas cards' : 'Show on canvas cards'}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              cardVisible
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'text-gray-400 border-gray-200 hover:border-indigo-200 hover:text-indigo-500'
            }`}
          >
            card
          </button>
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 text-sm leading-none"
            title={`Delete field "${field.name}"`}
          >
            ×
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function AddFieldRow({ onAdd }: { onAdd: (name: string, type: FieldType) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('select')
  const [open, setOpen] = useState(false)

  const submit = () => {
    if (!name.trim()) return
    onAdd(name.trim(), type)
    setName('')
    setType('select')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-indigo-600 transition-colors text-left"
      >
        + Add field
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-2 border border-dashed border-gray-200 rounded-md">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Field name…"
        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
      />
      <div className="flex gap-1.5">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FieldType)}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none"
        >
          <option value="select">Select</option>
          <option value="multi-select">Multi-select</option>
          <option value="text">Text</option>
          <option value="number">Number</option>
        </select>
        <button onClick={submit} className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors">Add</button>
        <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function OptionsEditor({
  field,
  onUpdateField,
}: {
  field: Field
  onUpdateField: (id: string, patch: Partial<Field>) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v || field.options.includes(v)) return
    onUpdateField(field.id, { options: [...field.options, v] })
    setInput('')
  }

  return (
    <div className="flex flex-col gap-1">
      {field.type === 'select' && (
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => (
            <span
              key={opt}
              className="group flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              {opt}
              <button
                onClick={() => onUpdateField(field.id, { options: field.options.filter((o) => o !== opt) })}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 leading-none"
                title="Remove option"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add option…"
          className="flex-1 border border-gray-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-300 bg-gray-50"
        />
        <button
          onClick={add}
          className="text-xs text-indigo-500 hover:text-indigo-700 px-1 font-medium"
        >
          +
        </button>
      </div>
    </div>
  )
}
