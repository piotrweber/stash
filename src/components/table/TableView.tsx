import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useCollectionStore } from '../../store/collectionStore'
import { FilterSortBar } from '../shared/FilterSortBar'
import { applyFilters, applySort } from '../shared/filterSort'
import { optionStyle, OPTION_COLORS, COLOR_KEYS } from '../shared/optionColors'
import type { Item, Field, Collection } from '../../types/collection'

// ─── Top-level view ──────────────────────────────────────────────────────────

interface TableViewProps {
  onGoToProjects: () => void
  onShowSchema: () => void
}

export function TableView({ onGoToProjects, onShowSchema }: TableViewProps) {
  const { collection, addItem, updateItem, setTableState, renameProject, saveProject, isDirty } = useCollectionStore()
  const [viewMode, setViewMode] = useState<'catalogue' | 'focus'>('catalogue')
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overGroup, setOverGroup] = useState<string | null>(null)

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

  const groupableFields = useMemo(() =>
    (schema?.fields ?? [])
      .filter((f) => f.type === 'select' || f.type === 'multi-select')
      .map((f) => ({ id: f.id, name: f.name })),
  [schema])

  const processedItems = useMemo(() => {
    if (!collection) return []
    const filtered = applyFilters(collection.items, tableState?.filters ?? [])
    return applySort(filtered, tableState?.sortBy ?? null, tableState?.sortDir ?? 'asc')
  }, [collection, tableState])

  const grouped = useMemo(() => {
    if (!groupBy || !collection) return null
    const field = collection.schema.fields.find((f) => f.id === groupBy)
    if (!field) return null

    const map: Map<string, Item[]> = new Map()
    for (const item of processedItems) {
      const val = item.fields[groupBy]
      let keys: string[]
      if (val == null || val === '') keys = ['(none)']
      else if (Array.isArray(val)) keys = val.length > 0 ? val.map(String) : ['(none)']
      else keys = [String(val)]
      for (const k of keys) {
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(item)
      }
    }

    const orderedKeys = [
      ...field.options.filter((o) => map.has(o)),
      ...[...(map.keys())].filter((k) => !field.options.includes(k)),
    ]
    return orderedKeys.map((key) => ({ key, items: map.get(key) ?? [] }))
  }, [groupBy, processedItems, collection])

  const groupField = groupBy ? collection?.schema.fields.find((f) => f.id === groupBy) : undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const draggingItem = draggingId ? collection?.items.find((it) => it.id === draggingId) : null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const handleDragOver = ({ over }: { over: { id: string } | null }) => {
    setOverGroup(over ? (over.id as string) : null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setOverGroup(null)
    if (!over || !groupBy || !collection) return
    const targetGroup = over.id as string
    const item = collection.items.find((it) => it.id === active.id)
    if (!item) return
    const currentVal = item.fields[groupBy]
    const newVal = targetGroup === '(none)' ? null : targetGroup
    const currentStr = currentVal == null || currentVal === '' ? '(none)' : (Array.isArray(currentVal) ? currentVal.join(',') : String(currentVal))
    if (currentStr === targetGroup) return
    updateItem(item.id, { fields: { ...item.fields, [groupBy]: newVal } })
  }

  if (!collection || !tableState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open.
      </div>
    )
  }

  const fields = collection.schema.fields

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver as never}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col min-h-0">

        {/* ── Fixed header ── */}
        <div className="shrink-0 bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-8 pt-8 pb-3">
            {/* Back link */}
            <button
              onClick={onGoToProjects}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Projects
            </button>

            {/* Title row */}
            <div className="flex items-center gap-3">
              <ProjectTitleInput
                value={collection.meta.name}
                onSave={(name) => renameProject(name)}
              />
              <button
                onClick={() => {
                  const json = saveProject()
                  if (!json || !collection) return
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${collection.meta.name}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-colors ${
                  isDirty
                    ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                }`}
              >
                {isDirty ? 'Save' : 'Saved'}
              </button>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              <button
                onClick={() => addItem({ name: 'New item', description: '', imagePath: '', fields: {}, canvas: { x: 0, y: 0 } })}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                + New
              </button>
              <FilterSortBar
                bare
                sortFields={sortFields}
                filterFields={filterFields}
                schemaFields={fields}
                sortBy={tableState.sortBy}
                sortDir={tableState.sortDir}
                onSortChange={(s, d) => setTableState({ sortBy: s, sortDir: d })}
                filters={tableState.filters}
                onFiltersChange={(f) => setTableState({ filters: f })}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                groupableFields={groupableFields}
                endSlot={<ViewModeToggle mode={viewMode} onChange={setViewMode} />}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8">

            {/* ── Content ── */}
            {viewMode === 'focus' ? (
              <div className="py-6 flex flex-col">
                {grouped ? (
                  grouped.map(({ key, items }) => (
                    <div key={key}>
                      <FocusGroupHeader label={key} field={groupField} />
                      {items.map((item) => (
                        <FocusItemCard
                          key={item.id}
                          item={item}
                          onUpdate={(patch) => updateItem(item.id, patch)}
                        />
                      ))}
                    </div>
                  ))
                ) : (
                  processedItems.map((item) => (
                    <FocusItemCard
                      key={item.id}
                      item={item}
                      onUpdate={(patch) => updateItem(item.id, patch)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="pt-4 pb-8 flex flex-col gap-6">
                {grouped ? (
                  <>
                    {grouped.map(({ key, items }) => (
                      <GroupSection
                        key={key}
                        groupKey={key}
                        items={items}
                        fields={fields}
                        isOver={overGroup === key}
                        isDragging={!!draggingId}
                        onUpdate={(id, patch) => updateItem(id, patch)}
                        groupField={groupField}
                        collection={collection}
                      />
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    {processedItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        fields={fields}
                        draggable={false}
                        onUpdate={(patch) => updateItem(item.id, patch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <DragOverlay>
        {draggingItem && (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <ItemCard
              item={draggingItem}
              fields={fields}
              draggable={false}
              onUpdate={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  groupKey, items, fields, isOver, isDragging, onUpdate, groupField, collection,
}: {
  groupKey: string
  items: Item[]
  fields: Field[]
  isOver: boolean
  isDragging: boolean
  onUpdate: (id: string, patch: Partial<Item>) => void
  groupField?: Field
  collection: Collection | null
}) {
  const { updateField, updateItem } = useCollectionStore()
  const { setNodeRef } = useDroppable({ id: groupKey })
  const [collapsed, setCollapsed] = useState(false)
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)

  const isEditableGroup = groupField && groupKey !== '(none)'
  const chipStyle = isEditableGroup ? optionStyle(groupField.optionColors?.[groupKey]) : null

  const handleChipClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isEditableGroup || !chipRef.current) return
    setPopoverAnchor(chipRef.current.getBoundingClientRect())
  }

  const handleSaveOption = ({ name: newName, colorKey: newColorKey }: { name: string; colorKey: string }) => {
    if (!groupField || !collection) return
    const oldName = groupKey
    let newOptions = groupField.options.map((o) => (o === oldName ? newName : o))
    const newColors = { ...(groupField.optionColors ?? {}) }
    if (newName !== oldName) {
      if (newColors[oldName]) { newColors[newName] = newColors[oldName]; delete newColors[oldName] }
    }
    newColors[newName] = newColorKey
    updateField(groupField.id, { options: newOptions, optionColors: newColors })

    if (newName !== oldName) {
      for (const item of collection.items) {
        const val = item.fields[groupField.id]
        if (val === oldName) {
          updateItem(item.id, { fields: { ...item.fields, [groupField.id]: newName } })
        } else if (Array.isArray(val) && val.includes(oldName)) {
          updateItem(item.id, { fields: { ...item.fields, [groupField.id]: val.map((v) => (v === oldName ? newName : v)) } })
        }
      }
    }
    setPopoverAnchor(null)
  }

  const handleDeleteOption = () => {
    if (!groupField || !collection) return
    const oldName = groupKey
    const newOptions = groupField.options.filter((o) => o !== oldName)
    const newColors = { ...(groupField.optionColors ?? {}) }
    delete newColors[oldName]
    updateField(groupField.id, { options: newOptions, optionColors: newColors })
    for (const item of collection.items) {
      const val = item.fields[groupField.id]
      if (val === oldName) {
        updateItem(item.id, { fields: { ...item.fields, [groupField.id]: null } })
      } else if (Array.isArray(val) && val.includes(oldName)) {
        updateItem(item.id, { fields: { ...item.fields, [groupField.id]: val.filter((v) => v !== oldName) } })
      }
    }
    setPopoverAnchor(null)
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-all duration-150 ${
        isDragging
          ? isOver
            ? 'ring-2 ring-indigo-500 bg-indigo-50/60 shadow-lg'
            : 'ring-1 ring-dashed ring-gray-300'
          : ''
      }`}
    >
      {/* Group header */}
      <div className="flex items-center gap-2.5 px-2 pb-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isEditableGroup && chipStyle ? (
          <button
            ref={chipRef}
            onClick={handleChipClick}
            style={{ ...chipStyle, border: `1px solid ${chipStyle.borderColor}` }}
            className="text-sm font-semibold px-2.5 py-0.5 rounded-full hover:opacity-80 transition-opacity"
          >
            {groupKey}
          </button>
        ) : (
          <span className="text-sm font-semibold text-gray-500">{groupKey}</span>
        )}

        <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 min-w-[24px] text-center">
          {items.length}
        </span>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <div className={`h-14 rounded-lg border-2 border-dashed flex items-center justify-center text-xs transition-colors ${
              isOver ? 'border-indigo-400 text-indigo-400' : 'border-gray-200 text-gray-300'
            }`}>
              Drop here
            </div>
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                fields={fields}
                draggable
                onUpdate={(patch) => onUpdate(item.id, patch)}
              />
            ))
          )}
        </div>
      )}

      {/* Category edit popover */}
      {popoverAnchor && isEditableGroup && groupField && (
        <CategoryPopover
          option={groupKey}
          field={groupField}
          anchor={popoverAnchor}
          onSave={handleSaveOption}
          onDelete={handleDeleteOption}
          onClose={() => setPopoverAnchor(null)}
        />
      )}
    </div>
  )
}

// ─── Category popover ─────────────────────────────────────────────────────────

function CategoryPopover({ option, field, anchor, onSave, onDelete, onClose }: {
  option: string
  field: Field
  anchor: DOMRect
  onSave: (patch: { name: string; colorKey: string }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(option)
  const [colorKey, setColorKey] = useState(field.optionColors?.[option] ?? 'gray')
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onSave({ name: name.trim() || option, colorKey })
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [name, colorKey, option, onSave, onClose])

  const commit = () => {
    onSave({ name: name.trim() || option, colorKey })
    onClose()
  }

  const top = Math.min(anchor.bottom + 6, window.innerHeight - 240)
  const left = Math.min(anchor.left, window.innerWidth - 230)

  return createPortal(
    <div
      ref={popRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: 220 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex flex-col gap-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Name */}
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { onClose() }
        }}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
      />

      {/* Color */}
      <div>
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Color</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_KEYS.map((key) => {
            const c = OPTION_COLORS[key]
            return (
              <button
                key={key}
                onClick={() => setColorKey(key)}
                style={{
                  background: c.bg,
                  border: `2px solid ${colorKey === key ? c.text : c.border}`,
                }}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                title={key}
              />
            )
          })}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors text-left"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Delete option
      </button>
    </div>,
    document.body,
  )
}

// ─── Add category row ─────────────────────────────────────────────────────────

function AddCategoryRow({ field }: { field: Field }) {
  const { updateField } = useCollectionStore()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const add = () => {
    const v = value.trim()
    if (!v || field.options.includes(v)) { setValue(''); return }
    updateField(field.id, { options: [...field.options, v] })
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        placeholder="+ Add category…"
        className="text-xs text-gray-500 placeholder-gray-300 bg-transparent border-none outline-none focus:text-gray-700 w-40"
      />
      {value && (
        <button
          onClick={add}
          className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
        >
          Add
        </button>
      )}
    </div>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, fields, draggable, onUpdate,
}: {
  item: Item
  fields: Field[]
  draggable: boolean
  onUpdate: (patch: Partial<Item>) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-all ${
        isDragging ? 'opacity-0' : 'hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div className="flex items-start">
        {/* Drag handle */}
        <div
          {...(draggable ? { ...attributes, ...listeners } : {})}
          className={`flex items-center justify-center self-stretch px-2.5 shrink-0 rounded-l-xl ${draggable ? 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:bg-gray-50' : 'text-transparent'}`}
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
            <circle cx="3.5" cy="3.5" r="1.2" fill="currentColor"/>
            <circle cx="8.5" cy="3.5" r="1.2" fill="currentColor"/>
            <circle cx="3.5" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="8.5" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="3.5" cy="12.5" r="1.2" fill="currentColor"/>
            <circle cx="8.5" cy="12.5" r="1.2" fill="currentColor"/>
          </svg>
        </div>

        {/* Image — padded to align with text */}
        <div className="pt-3 pb-3 pl-1 pr-2 shrink-0">
          <ImageCell item={item} onUpdate={onUpdate} size="sm" />
        </div>

        {/* Name + description */}
        <div className="flex flex-col py-3 px-3 w-80 shrink-0 border-r border-gray-100">
          <InlineInput
            value={item.name}
            onSave={(v) => onUpdate({ name: v })}
            className="text-sm font-medium text-gray-800"
          />
          <InlineTextarea
            value={item.description}
            onSave={(v) => onUpdate({ description: v })}
            placeholder="Description"
          />
        </div>

        {/* Fields — one per column, table-style */}
        {fields.length > 0 && (
          <div className="flex items-start divide-x divide-gray-100 flex-1 min-w-0 overflow-visible">
            {fields.map((field) => (
              <div key={field.id} className="flex flex-col px-3 py-3 min-w-[120px]">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">{field.name}</span>
                <FieldChip
                  field={field}
                  value={item.fields[field.id] ?? null}
                  onChange={(v) => onUpdate({ fields: { ...item.fields, [field.id]: v } })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Field chip ───────────────────────────────────────────────────────────────

function OptionTag({ label, colorKey, size = 'sm' }: { label: string; colorKey?: string; size?: 'sm' | 'xs' }) {
  const style = optionStyle(colorKey)
  return (
    <span
      style={{ ...style, border: `1px solid ${style.borderColor}` }}
      className={`inline-block rounded-full font-medium ${size === 'xs' ? 'text-[10px] px-1.5 py-px' : 'text-[11px] px-2 py-0.5'}`}
    >
      {label}
    </span>
  )
}

function FieldChip({ field, value, onChange }: {
  field: Field
  value: Item['fields'][string]
  onChange: (v: Item['fields'][string]) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const openMenu = () => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 200)
    setMenuPos({ top: rect.bottom + 4, left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (field.type === 'select') {
    const label = (value as string) || null
    const colorKey = label ? field.optionColors?.[label] : undefined

    return (
      <div>
        <button ref={btnRef} onClick={openMenu}>
          {label
            ? <OptionTag label={label} colorKey={colorKey} />
            : <span className="text-[11px] text-gray-300 border border-dashed border-gray-200 rounded-full px-2 py-0.5 hover:border-gray-400 transition-colors">—</span>
          }
        </button>
        {open && menuPos && createPortal(
          <SelectMenu
            field={field}
            selected={label}
            onSelect={(opt) => { onChange(opt); setOpen(false) }}
            onClose={() => setOpen(false)}
            pos={menuPos}
          />,
          document.body,
        )}
      </div>
    )
  }

  if (field.type === 'multi-select') {
    const selected: string[] = Array.isArray(value) ? value : []

    return (
      <div>
        <button ref={btnRef} onClick={openMenu} className="flex flex-wrap gap-1 items-center">
          {selected.length > 0
            ? selected.map((s) => <OptionTag key={s} label={s} colorKey={field.optionColors?.[s]} />)
            : <span className="text-[11px] text-gray-300 border border-dashed border-gray-200 rounded-full px-2 py-0.5 hover:border-gray-400 transition-colors">—</span>
          }
        </button>
        {open && menuPos && createPortal(
          <MultiSelectMenu
            field={field}
            selected={selected}
            onToggle={(opt) => onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])}
            onClose={() => setOpen(false)}
            pos={menuPos}
          />,
          document.body,
        )}
      </div>
    )
  }

  if (field.type === 'text') {
    return <InlineInput value={(value as string) ?? ''} onSave={onChange} placeholder="—" className="text-xs text-gray-700" />
  }

  if (field.type === 'number') {
    return <InlineNumber value={value as number | null} onSave={onChange} />
  }

  return null
}

function SelectMenu({ field, selected, onSelect, onClose, pos }: {
  field: Field; selected: string | null
  onSelect: (v: string | null) => void; onClose: () => void
  pos: { top: number; left: number }
}) {
  return (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 160 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button onClick={() => onSelect(null)} className="block w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">
        — none
      </button>
      {field.options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50 ${opt === selected ? 'font-medium' : ''}`}
        >
          <OptionTag label={opt} colorKey={field.optionColors?.[opt]} />
          {opt === selected && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
        </button>
      ))}
    </div>
  )
}

function MultiSelectMenu({ field, selected, onToggle, onClose, pos }: {
  field: Field; selected: string[]
  onToggle: (v: string) => void; onClose: () => void
  pos: { top: number; left: number }
}) {
  return (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 160 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl py-1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {field.options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50"
          >
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
              {active && <span className="text-white text-[9px] leading-none">✓</span>}
            </span>
            <OptionTag label={opt} colorKey={field.optionColors?.[opt]} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Editable primitives ──────────────────────────────────────────────────────

function InlineInput({ value, onSave, placeholder = '', className = '' }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const commit = () => { if (draft !== value) onSave(draft) }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => { setDraft(value); e.target.select() }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur() }
      }}
      placeholder={placeholder}
      className={`block w-full bg-transparent border border-transparent rounded px-1 py-0.5 focus:bg-white focus:border-indigo-400 focus:outline-none placeholder-gray-300 transition-colors ${className}`}
    />
  )
}

function InlineTextarea({ value, onSave, placeholder = '' }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize: set height to scrollHeight while focused, revert to 2-row fixed on blur
  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const commit = () => {
    setFocused(false)
    if (ref.current) ref.current.style.height = ''
    if (draft !== value) onSave(draft)
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={2}
      onChange={(e) => { setDraft(e.target.value); resize() }}
      onFocus={() => { setDraft(value); setFocused(true); setTimeout(resize, 0) }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLTextAreaElement).blur() }
      }}
      placeholder={placeholder}
      className={`block w-full border rounded px-1 py-0.5 text-sm text-gray-700 font-normal focus:outline-none placeholder-gray-300 resize-none leading-snug transition-colors ${
        focused ? 'bg-white border-indigo-400' : 'bg-transparent border-transparent'
      }`}
    />
  )
}

function InlineNumber({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const commit = () => {
    const n = draft === '' ? null : Number(draft)
    onSave(isNaN(n as number) ? null : n)
  }

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => { setDraft(String(value ?? '')); e.target.select() }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') { setDraft(String(value ?? '')); (e.target as HTMLInputElement).blur() }
      }}
      className="w-16 bg-transparent border border-transparent rounded px-1 py-0.5 text-xs text-gray-700 focus:bg-white focus:border-indigo-400 focus:outline-none transition-colors"
    />
  )
}

function ImageCell({ item, onUpdate, size = 'md' }: { item: Item; onUpdate: (patch: Partial<Item>) => void; size?: 'md' | 'sm' }) {
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

  const dim = size === 'sm' ? 'w-12 h-12' : 'w-24 h-24'
  const iconSize = size === 'sm' ? 14 : 22

  return (
    <div
      onClick={handleClick}
      className={`${dim} shrink-0 overflow-hidden flex items-center justify-center cursor-pointer transition-all rounded-lg ${
        item.imagePath
          ? 'hover:opacity-80'
          : 'bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 hover:border-gray-400'
      }`}
      title={item.imagePath ? 'Click to replace image' : 'Click to upload image'}
    >
      {item.imagePath ? (
        <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-gray-400 select-none">
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
            <path d="M12 15V7M12 7l-3 3M12 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {size !== 'sm' && <span className="text-[10px] font-medium tracking-wide uppercase">Image</span>}
        </div>
      )}
    </div>
  )
}

// ─── View mode toggle ─────────────────────────────────────────────────────────

function ViewModeToggle({ mode, onChange }: {
  mode: 'catalogue' | 'focus'
  onChange: (m: 'catalogue' | 'focus') => void
}) {
  return (
    <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
      <button
        onClick={() => onChange('catalogue')}
        title="Catalogue mode"
        className={`flex items-center justify-center w-7 h-6 transition-colors ${
          mode === 'catalogue' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        {/* Grid/table icon */}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="9" y="1" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="1" y="7" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="9" y="7" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="1" y="13" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          <rect x="9" y="13" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </button>
      <div className="w-px h-4 bg-gray-200" />
      <button
        onClick={() => onChange('focus')}
        title="Focus mode"
        className={`flex items-center justify-center w-7 h-6 transition-colors ${
          mode === 'focus' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        {/* Text/document icon */}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3 4h10M3 7h10M3 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Focus mode bar ───────────────────────────────────────────────────────────

function FocusModeBar({ onExit, toggle }: { onExit: () => void; toggle: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 bg-white shrink-0 flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs text-gray-400 font-serif italic">Focus mode</span>
      <div className="ml-auto pl-2">{toggle}</div>
    </div>
  )
}

// ─── Focus group header ───────────────────────────────────────────────────────

function FocusGroupHeader({ label }: { label: string; field?: Field }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-2 first:mt-0">
      <span className="font-serif text-sm font-semibold text-gray-400">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ─── Focus item card ──────────────────────────────────────────────────────────

function FocusItemCard({ item, onUpdate }: { item: Item; onUpdate: (patch: Partial<Item>) => void }) {
  return (
    <div className="flex items-start gap-5 py-6 border-b border-gray-100 last:border-0">
      {/* Image — small, rounded */}
      <div
        onClick={() => {
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
        }}
        className={`w-24 h-24 shrink-0 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
          item.imagePath
            ? 'hover:opacity-80'
            : 'bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 hover:border-gray-400'
        }`}
        title={item.imagePath ? 'Click to replace' : 'Click to upload'}
      >
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-gray-400 select-none">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 15V7M12 7l-3 3M12 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] font-medium tracking-wide uppercase">Image</span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <FocusInlineInput
          value={item.name}
          onSave={(v) => onUpdate({ name: v })}
          placeholder="Title…"
        />
        <FocusTextarea
          value={item.description}
          onSave={(v) => onUpdate({ description: v })}
          placeholder="Write something…"
        />
      </div>
    </div>
  )
}

function FocusInlineInput({ value, onSave, placeholder = '' }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => { setDraft(value); e.target.select() }}
      onBlur={() => { if (draft !== value) onSave(draft) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur() }
      }}
      placeholder={placeholder}
      className="block w-full bg-transparent border-none outline-none font-serif font-semibold text-lg text-gray-900 placeholder-gray-300 leading-snug"
    />
  )
}

function FocusTextarea({ value, onSave, placeholder = '' }: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  // Always keep height matching content
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [draft])

  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLTextAreaElement).blur() }
      }}
      placeholder={placeholder}
      className="block w-full bg-transparent border-none outline-none font-serif text-base text-gray-600 leading-relaxed resize-none placeholder-gray-300"
    />
  )
}

// ─── Project title input ──────────────────────────────────────────────────────

function ProjectTitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() && draft !== value) onSave(draft.trim()) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur() }
      }}
      className="block w-full bg-transparent border-none outline-none text-3xl font-bold text-gray-900 placeholder-gray-300 leading-tight"
      placeholder="Untitled"
    />
  )
}

// ─── Upload images button ─────────────────────────────────────────────────────

function UploadImagesButton() {
  const { addItem } = useCollectionStore()

  const handleClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        addItem({ name: file.name.replace(/\.[^.]+$/, ''), description: '', imagePath: dataUrl, fields: {}, canvas: { x: 0, y: 0 } })
      }
    }
    input.click()
  }

  return (
    <button
      onClick={handleClick}
      className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
    >
      Upload images
    </button>
  )
}
