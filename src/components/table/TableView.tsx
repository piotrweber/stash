import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ChevronLeft, ChevronDown, ChevronRight, Trash2, X, GripVertical, ImageUp,
  ZoomOut, ZoomIn, Image, PenLine, ChevronsUp, ChevronsDown, Plus, ArrowLeftRight, MessageSquare, SlidersHorizontal,
} from 'lucide-react'
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
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCollectionStore } from '../../store/collectionStore'
import { FilterSortBar } from '../shared/FilterSortBar'
import { applyFilters, applySort } from '../shared/filterSort'
import { optionStyle, COLOR_KEYS } from '../shared/optionColors'
import type { Item, Field, Collection } from '../../types/collection'

// ─── Top-level view ──────────────────────────────────────────────────────────

interface TableViewProps {
  onGoToProjects: () => void
}

export function TableView({ onGoToProjects }: TableViewProps) {
  const { collection, addItem, updateItem, deleteItem, reorderItems, setTableState, renameProject } = useCollectionStore()
  const [viewMode, setViewMode] = useState<'catalogue' | 'focus' | 'cards'>('catalogue')
  const [zoom, setZoom] = useState(1)
  const [allCollapsed, setAllCollapsed] = useState<boolean | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollToId, setScrollToId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overGroup, setOverGroup] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [wide, setWide] = useState(false)

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const clearSelection = () => setSelectedIds(new Set())

  type DraftItem = { name: string; description: string; imagePath: string; fields: Item['fields'] }
  const [draft, setDraft] = useState<DraftItem | null>(null)

  const commitDraft = () => {
    if (!draft) return
    addItem({ name: draft.name.trim() || 'New item', description: draft.description, imagePath: draft.imagePath, fields: draft.fields, canvas: { x: 0, y: 0 } })
    setDraft(null)
  }
  const cancelDraft = () => setDraft(null)


  const goToProperties = (id: string) => { setViewMode('catalogue'); setScrollToId(id) }
  const goToText = (id: string) => { setViewMode('focus'); setScrollToId(id) }

  useEffect(() => {
    if (!scrollToId || (viewMode !== 'catalogue' && viewMode !== 'focus')) return
    const el = document.getElementById(`item-${scrollToId}`)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setScrollToId(null) }
  }, [viewMode, scrollToId])

  const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75]
  const CARD_COLS: Record<number, string> = { 0.75: 'grid-cols-10', 1: 'grid-cols-8', 1.25: 'grid-cols-6', 1.5: 'grid-cols-4', 1.75: 'grid-cols-3' }
  const cardCols = CARD_COLS[zoom] ?? 'grid-cols-8'

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
    if (!over || !collection) return
    if (viewMode === 'cards') {
      if (active.id === over.id) return
      const items = collection.items
      const oldIdx = items.findIndex((it) => it.id === active.id)
      const newIdx = items.findIndex((it) => it.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      reorderItems(arrayMove(items, oldIdx, newIdx).map((it) => it.id))
      return
    }
    if (!groupBy) return
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
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
        <div className="shrink-0 bg-background border-b border-border">
          {/* Collapsible title row */}
          <div
            className="overflow-hidden transition-all duration-200 ease-in-out"
            style={{ maxHeight: scrolled ? 0 : 200, opacity: scrolled ? 0 : 1 }}
          >
            <div className="max-w-4xl mx-auto px-10 pt-7 pb-4">
              <button
                onClick={onGoToProjects}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-3"
              >
                <ChevronLeft size={13} />
                Projects
              </button>
              <ProjectTitleInput
                value={collection.meta.name}
                onSave={(name) => renameProject(name)}
              />
            </div>
          </div>

          {/* Primary toolbar */}
          <div className="max-w-4xl mx-auto px-10 pb-2.5" style={{ paddingTop: scrolled ? 10 : 0 }}>
            {selectedIds.size > 0 ? (
              <BulkActionBar
                count={selectedIds.size}
                fields={fields}
                selectedIds={selectedIds}
                onClear={clearSelection}
                onDelete={(ids) => {
                  ids.forEach((id) => deleteItem(id))
                  clearSelection()
                }}
                onSetField={(fieldId, value) => {
                  selectedIds.forEach((id) => {
                    const item = collection.items.find((it) => it.id === id)
                    if (item) updateItem(id, { fields: { ...item.fields, [fieldId]: value } })
                  })
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => { if (!draft) setDraft({ name: '', description: '', imagePath: '', fields: {} }) }}
                  disabled={!!draft}
                  className="h-8 px-3 text-xs"
                >
                  + New
                </Button>
                <div className="w-px h-5 bg-border mx-0.5" />
                <ViewModeToggle mode={viewMode} onChange={(m) => setViewMode(m)} />
                <div className="w-px h-5 bg-border mx-0.5 ml-auto" />
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
                  onGroupByChange={(id) => { setGroupBy(id); setAllCollapsed(null) }}
                  groupableFields={groupableFields}
                />
              </div>
            )}
          </div>

          {/* Secondary toolbar */}
          <div className="border-t border-border/60 max-w-4xl mx-auto px-10 py-1 flex items-center gap-1">
            <ZoomControl zoom={zoom} steps={ZOOM_STEPS} onChange={setZoom} />
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => setWide((v) => !v)}
              title={wide ? 'Narrow layout' : 'Wide layout'}
              className={`p-1 border rounded transition-colors ${wide ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
            >
              <ArrowLeftRight size={13} />
            </button>
            {(viewMode === 'catalogue' || viewMode === 'cards') && grouped && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => setAllCollapsed((v) => v === true ? null : true)}
                  title="Collapse all"
                  className={`p-1 border rounded transition-colors ${allCollapsed === true ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                >
                  <ChevronsUp size={13} />
                </button>
                <button
                  onClick={() => setAllCollapsed((v) => v === false ? null : false)}
                  title="Expand all"
                  className={`p-1 border rounded transition-colors ${allCollapsed === false ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                >
                  <ChevronsDown size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={(e) => {
            const top = (e.currentTarget as HTMLDivElement).scrollTop
            setScrolled((prev) => prev ? top > 0 : top > 24)
          }}>
          <div className={`${wide ? 'max-w-full' : 'max-w-4xl'} mx-auto px-10 transition-all duration-200`}>

            {/* ── Draft new item row (sticky) ── */}
            {draft && (
              <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
                {viewMode === 'focus' ? (
                  <DraftFocusItemCard
                    draft={draft}
                    onChange={(patch) => setDraft((d) => d ? { ...d, ...patch } : null)}
                    onAdd={commitDraft}
                    onCancel={cancelDraft}
                  />
                ) : (
                  <DraftItemCard
                    draft={draft}
                    fields={fields}
                    onChange={(patch) => setDraft((d) => d ? { ...d, ...patch } : null)}
                    onAdd={commitDraft}
                    onCancel={cancelDraft}
                  />
                )}
              </div>
            )}

            {/* ── Content ── */}
            {viewMode === 'cards' ? (
              <div className={`${draft ? 'pb-8' : 'pt-4 pb-8'} flex flex-col gap-6`} style={{ zoom }}>
                {grouped ? (
                  grouped.map(({ key, items }) => (
                    <CardGroupSection
                      key={key}
                      groupKey={key}
                      items={items}
                      groupField={groupField}
                      collapsedOverride={allCollapsed}
                      onGoToProperties={goToProperties}
                      cardCols={cardCols}
                      showLabels={zoom > 0.75}
                      onOpenPanel={setSelectedImageId}
                    />
                  ))
                ) : (
                  <div className={`grid ${cardCols} gap-3`}>
                    {collection.items.map((item) => (
                      <ImageCard key={item.id} item={item} onGoToProperties={goToProperties} showLabels={zoom > 0.75} onOpenPanel={setSelectedImageId} />
                    ))}
                  </div>
                )}
              </div>
            ) : viewMode === 'focus' ? (
              <div className={`flex flex-col ${draft ? 'pb-8' : 'py-6'}`} style={{ zoom }}>
                {grouped ? (
                  grouped.map(({ key, items }) => (
                    <FocusGroupSection
                      key={key}
                      groupKey={key}
                      items={items}
                      collapsedOverride={allCollapsed}
                      groupField={groupField}
                      onUpdate={(id, patch) => updateItem(id, patch)}
                    />
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
              <div className={`${draft ? 'pb-8' : 'pt-2 pb-8'}`} style={{ zoom }}>
                <table className="w-full border-collapse">
                  {!grouped && <PropertiesTableHead fields={fields} />}
                  {grouped ? (
                    grouped.map(({ key, items: groupItems }) => (
                      <TableGroupSection
                        key={key}
                        groupKey={key}
                        items={groupItems}
                        fields={fields}
                        isOver={overGroup === key}
                        isDragging={!!draggingId}
                        onUpdate={(id: string, patch: Partial<Item>) => updateItem(id, patch)}
                        groupField={groupField}
                        collection={collection}
                        collapsedOverride={allCollapsed}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onGoToText={goToText}
                      />
                    ))
                  ) : (
                    <tbody>
                      {processedItems.map((item) => (
                        <PropertiesRow
                          key={item.id}
                          item={item}
                          fields={fields}
                          selected={selectedIds.has(item.id)}
                          onToggleSelect={() => toggleSelect(item.id)}
                          onUpdate={(patch: Partial<Item>) => updateItem(item.id, patch)}
                          onGoToText={goToText}
                        />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            )}

          </div>
        </div>
      </div>

      <DragOverlay>
        {draggingItem && (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <ItemCard item={draggingItem} fields={fields} draggable={false} onUpdate={() => {}} onGoToText={() => {}} />
          </div>
        )}
      </DragOverlay>

      {selectedImageId && (
        <ImageDetailPanel
          itemId={selectedImageId}
          onClose={() => setSelectedImageId(null)}
        />
      )}
    </DndContext>
  )
}

// ─── Properties table components ─────────────────────────────────────────────

function PropertiesTableHead({ fields }: { fields: Field[] }) {
  const { addField } = useCollectionStore()
  const [addOpen, setAddOpen] = useState(false)
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <thead>
      <tr className="border-b border-border bg-muted/40">
        <th className="w-8 px-2 py-2" />
        <th className="w-10 px-2 py-2" />
        <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[160px]">Name</th>
        {fields.map((f) => (
          <FieldHeaderCell key={f.id} field={f} />
        ))}
        <th className="px-2 py-2">
          <button
            ref={addBtnRef}
            onClick={() => {
              if (!addBtnRef.current) return
              setAddAnchor(addBtnRef.current.getBoundingClientRect())
              setAddOpen(true)
            }}
            className="text-[10px] font-medium text-muted-foreground/50 hover:text-primary transition-colors whitespace-nowrap"
          >
            + Field
          </button>
          {addOpen && addAnchor && (
            <AddFieldPopover
              anchor={addAnchor}
              onClose={() => { setAddOpen(false); setAddAnchor(null) }}
              onAdd={(name, type) => { addField({ name, type, options: [] }); setAddOpen(false); setAddAnchor(null) }}
            />
          )}
        </th>
      </tr>
    </thead>
  )
}

function FieldHeaderCell({ field }: { field: Field }) {
  const { updateField, deleteField } = useCollectionStore()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLTableCellElement>(null)

  return (
    <th
      ref={ref}
      className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/60 transition-colors min-w-[120px]"
      onClick={() => { if (ref.current) setAnchor(ref.current.getBoundingClientRect()) }}
    >
      {field.name}
      {anchor && (
        <FieldEditPopover
          field={field}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onRename={(name) => updateField(field.id, { name })}
          onDelete={() => { deleteField(field.id); setAnchor(null) }}
          value={null}
          onValueChange={() => {}}
        />
      )}
    </th>
  )
}

function PropertiesCell({ field, value, onChange }: {
  field: Field
  value: Item['fields'][string]
  onChange: (v: Item['fields'][string]) => void
}) {
  const { updateField, deleteField } = useCollectionStore()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLTableCellElement>(null)

  return (
    <td
      ref={ref}
      className="px-3 py-2 min-w-[120px] cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => { if (ref.current) setAnchor(ref.current.getBoundingClientRect()) }}
    >
      <FieldChip field={field} value={value} onChange={onChange} />
      {anchor && (
        <FieldEditPopover
          field={field}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onRename={(name) => updateField(field.id, { name })}
          onDelete={() => { deleteField(field.id); setAnchor(null) }}
          value={value}
          onValueChange={onChange}
        />
      )}
    </td>
  )
}

function PropertiesRow({ item, fields, selected, onToggleSelect, onUpdate, onGoToText }: {
  item: Item
  fields: Field[]
  selected?: boolean
  onToggleSelect?: () => void
  onUpdate: (patch: Partial<Item>) => void
  onGoToText: (id: string) => void
}) {
  return (
    <tr
      id={`item-${item.id}`}
      className={`border-b border-border/60 transition-colors ${selected ? 'bg-accent/20' : 'hover:bg-muted/30'}`}
    >
      <td className="w-8 px-2 py-2">
        <Checkbox checked={!!selected} onCheckedChange={() => onToggleSelect?.()} onClick={(e) => e.stopPropagation()} />
      </td>
      <td className="w-10 px-1 py-1.5">
        <ImageCell item={item} onUpdate={onUpdate} size="sm" />
      </td>
      <td className="px-3 py-2 min-w-[160px]">
        <div onClick={(e) => e.stopPropagation()}>
          <InlineInput value={item.name} onSave={(v) => onUpdate({ name: v })} className="text-sm font-medium text-foreground" />
        </div>
        {item.description && (
          <div
            onClick={() => onGoToText(item.id)}
            title={item.description}
            className="text-xs text-muted-foreground truncate max-w-[200px] cursor-pointer hover:text-primary transition-colors"
          >
            {item.description}
          </div>
        )}
      </td>
      {fields.map((field) => (
        <PropertiesCell
          key={field.id}
          field={field}
          value={item.fields[field.id] ?? null}
          onChange={(v: Item['fields'][string]) => onUpdate({ fields: { ...item.fields, [field.id]: v } })}
        />
      ))}
      <td />
    </tr>
  )
}

function TableGroupSection({
  groupKey, items, fields, isOver, isDragging, onUpdate, groupField, collection, collapsedOverride, selectedIds, onToggleSelect, onGoToText,
}: {
  groupKey: string
  items: Item[]
  fields: Field[]
  isOver: boolean
  isDragging: boolean
  onUpdate: (id: string, patch: Partial<Item>) => void
  groupField?: Field
  collection: Collection | null
  collapsedOverride?: boolean | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onGoToText: (id: string) => void
}) {
  const { updateField, updateItem } = useCollectionStore()
  const { setNodeRef } = useDroppable({ id: groupKey })
  const [collapsed, setCollapsed] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (collapsedOverride !== null && collapsedOverride !== undefined) setCollapsed(collapsedOverride)
  }, [collapsedOverride])

  const isEditableGroup = groupField && groupKey !== '(none)'
  const chipStyle = isEditableGroup ? optionStyle(groupField.optionColors?.[groupKey]) : null

  const handleChipClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isEditableGroup || !chipRef.current) return
    const r = chipRef.current.getBoundingClientRect()
    setPopoverPos({ top: r.bottom + 6, left: r.left })
  }

  const handleRenameOption = (oldName: string, newName: string) => {
    if (!groupField || !collection) return
    const newOptions = groupField.options.map((o) => (o === oldName ? newName : o))
    const newColors = { ...(groupField.optionColors ?? {}) }
    const newDescs = { ...(groupField.optionDescriptions ?? {}) }
    if (newColors[oldName]) { newColors[newName] = newColors[oldName]; delete newColors[oldName] }
    if (newDescs[oldName]) { newDescs[newName] = newDescs[oldName]; delete newDescs[oldName] }
    updateField(groupField.id, { options: newOptions, optionColors: newColors, optionDescriptions: newDescs })
    for (const item of collection.items) {
      const val = item.fields[groupField.id]
      if (val === oldName) updateItem(item.id, { fields: { ...item.fields, [groupField.id]: newName } })
      else if (Array.isArray(val) && val.includes(oldName)) updateItem(item.id, { fields: { ...item.fields, [groupField.id]: val.map((v) => (v === oldName ? newName : v)) } })
    }
  }

  const handleDeleteOption = () => {
    if (!groupField || !collection) return
    const newOptions = groupField.options.filter((o) => o !== groupKey)
    const newColors = { ...(groupField.optionColors ?? {}) }
    const newDescs = { ...(groupField.optionDescriptions ?? {}) }
    delete newColors[groupKey]; delete newDescs[groupKey]
    updateField(groupField.id, { options: newOptions, optionColors: newColors, optionDescriptions: newDescs })
    for (const item of collection.items) {
      const val = item.fields[groupField.id]
      if (val === groupKey) updateItem(item.id, { fields: { ...item.fields, [groupField.id]: null } })
      else if (Array.isArray(val) && val.includes(groupKey)) updateItem(item.id, { fields: { ...item.fields, [groupField.id]: val.filter((v) => v !== groupKey) } })
    }
    setPopoverPos(null)
  }

  const colSpan = fields.length + 4

  return (
    <tbody ref={setNodeRef} className={isDragging ? isOver ? 'ring-2 ring-primary' : '' : ''}>
      {/* Group header row */}
      <tr
        className="cursor-pointer select-none hover:bg-muted/40 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <td colSpan={colSpan} className="pt-4 pb-1 px-2">
          <div className="flex items-center gap-2.5">
            <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            {isEditableGroup && chipStyle ? (
              <button
                ref={chipRef}
                onClick={(e) => { e.stopPropagation(); handleChipClick(e) }}
                style={{ color: chipStyle.color }}
                className="font-semibold text-base hover:opacity-70 transition-opacity"
              >
                {groupKey}
              </button>
            ) : (
              <span className="font-semibold text-base text-foreground">{groupKey}</span>
            )}
            <span className="text-sm text-muted-foreground">{items.length}</span>
          </div>
        </td>
      </tr>
      {/* Description row */}
      {groupField?.optionDescriptions?.[groupKey] && !collapsed && (
        <tr>
          <td colSpan={colSpan} className="px-7 pb-2 text-sm text-muted-foreground">
            {groupField.optionDescriptions[groupKey]}
          </td>
        </tr>
      )}
      {/* Column headers */}
      {!collapsed && (
        <tr className="border-b border-border/60 bg-muted/20">
          <th className="w-8 px-2 py-1.5" />
          <th className="w-10 px-2 py-1.5" />
          <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
          {fields.map((f) => (
            <th key={f.id} className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{f.name}</th>
          ))}
          <th />
        </tr>
      )}
      {/* Items */}
      {!collapsed && (
        items.length === 0 ? (
          <tr>
            <td colSpan={colSpan}>
              <div className={`h-10 flex items-center justify-center text-xs transition-colors ${
                isOver ? 'text-primary' : 'text-muted-foreground/50'
              }`}>
                Drop here
              </div>
            </td>
          </tr>
        ) : (
          items.map((item) => (
            <PropertiesRow
              key={item.id}
              item={item}
              fields={fields}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => onToggleSelect(item.id)}
              onUpdate={(patch) => onUpdate(item.id, patch)}
              onGoToText={onGoToText}
            />
          ))
        )
      )}

      {popoverPos && isEditableGroup && groupField && createPortal(
        <OptionEditSubPopover
          opt={groupKey}
          field={groupField}
          pos={popoverPos}
          onClose={() => setPopoverPos(null)}
          onRename={handleRenameOption}
          onDelete={handleDeleteOption}
          onColor={(opt, colorKey) => updateField(groupField.id, { optionColors: { ...(groupField.optionColors ?? {}), [opt]: colorKey } })}
        />,
        document.body,
      )}
    </tbody>
  )
}

// ─── Field header row ─────────────────────────────────────────────────────────

const FIELD_TYPES: { type: Field['type']; label: string }[] = [
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Select' },
  { type: 'multi-select', label: 'Multi-select' },
]


// ─── Field cells (fields section of each catalogue row) ──────────────────────

function FieldCells({ fields, itemFields, onChange }: {
  fields: Field[]
  itemFields: Item['fields']
  onChange: (fieldId: string, v: Item['fields'][string]) => void
}) {
  const { addField, updateField, deleteField } = useCollectionStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const editingField = editingId ? fields.find((f) => f.id === editingId) : null

  return (
    <div className="flex items-stretch flex-1 min-w-0 overflow-x-auto scrollbar-hide">
      <div className="flex items-start divide-x divide-border/60">
        {fields.map((field) => (
          <div
            key={field.id}
            ref={(el) => { labelRefs.current[field.id] = el }}
            onClick={() => {
              const el = labelRefs.current[field.id]
              if (!el) return
              setEditAnchor(el.getBoundingClientRect())
              setEditingId(field.id)
            }}
            className="flex flex-col min-w-[120px] shrink-0 hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <span className="px-3 pt-3 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {field.name}
            </span>
            <div className="px-3 pb-3">
              <FieldChip
                field={field}
                value={itemFields[field.id] ?? null}
                onChange={(v) => onChange(field.id, v)}
              />
            </div>
          </div>
        ))}
        {/* + New field cell */}
        <button
          ref={addBtnRef}
          onClick={() => {
            if (!addBtnRef.current) return
            setAddAnchor(addBtnRef.current.getBoundingClientRect())
            setAddOpen(true)
          }}
          className="flex items-center px-3 self-stretch min-w-[120px] text-[10px] font-medium text-muted-foreground/50 hover:text-primary hover:bg-muted/40 transition-colors whitespace-nowrap shrink-0"
        >
          + New
        </button>
      </div>

      {editingField && editAnchor && (
        <FieldEditPopover
          field={editingField}
          anchor={editAnchor}
          onClose={() => { setEditingId(null); setEditAnchor(null) }}
          onRename={(name) => updateField(editingField.id, { name })}
          onDelete={() => { deleteField(editingField.id); setEditingId(null); setEditAnchor(null) }}
          value={itemFields[editingField.id] ?? null}
          onValueChange={(v) => onChange(editingField.id, v)}
        />
      )}
      {addOpen && addAnchor && (
        <AddFieldPopover
          anchor={addAnchor}
          onClose={() => { setAddOpen(false); setAddAnchor(null) }}
          onAdd={(name, type) => { addField({ name, type, options: [] }); setAddOpen(false); setAddAnchor(null) }}
        />
      )}
    </div>
  )
}

function FieldEditPopover({ field, anchor, onClose, onRename, onDelete, value, onValueChange }: {
  field: Field
  anchor: DOMRect
  onClose: () => void
  onRename: (name: string) => void
  onDelete: () => void
  value: Item['fields'][string]
  onValueChange: (v: Item['fields'][string]) => void
}) {
  const { updateField, renameOption, deleteOption } = useCollectionStore()
  const [name, setName] = useState(field.name)
  const [localOpts, setLocalOpts] = useState(field.options)
  const [editingOpt, setEditingOpt] = useState<string | null>(null)
  const [editOptPos, setEditOptPos] = useState<{ top: number; left: number } | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [dragOptId, setDragOptId] = useState<string | null>(null)

  // Sync localOpts when field.options changes (e.g., after store update)
  useEffect(() => { setLocalOpts(field.options) }, [field.options])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        if (name.trim() && name !== field.name) onRename(name.trim())
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [name, field.name, onRename, onClose])

  const commit = () => {
    if (name.trim() && name !== field.name) onRename(name.trim())
    onClose()
  }

  const hasOptions = field.type === 'select' || field.type === 'multi-select'

  const addOption = () => {
    const newOpt = `Option ${localOpts.length + 1}`
    const updated = [...localOpts, newOpt]
    setLocalOpts(updated)
    updateField(field.id, { options: updated })
  }
  const selected: string[] = field.type === 'multi-select' ? (Array.isArray(value) ? value as string[] : []) : []
  const selectedSingle = field.type === 'select' ? (value as string | null) : null

  const handleOptDragEnd = (e: DragEndEvent) => {
    setDragOptId(null)
    if (!e.over || e.active.id === e.over.id) return
    const oldIdx = localOpts.indexOf(e.active.id as string)
    const newIdx = localOpts.indexOf(e.over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(localOpts, oldIdx, newIdx)
    setLocalOpts(reordered)
    updateField(field.id, { options: reordered })
  }

  const openOptEdit = (opt: string, rowEl: HTMLElement) => {
    const rect = rowEl.getBoundingClientRect()
    // Position sub-popover to the right of main popover
    const mainLeft = Math.min(anchor.left, window.innerWidth - 230)
    setEditOptPos({ top: rect.top, left: mainLeft + 228 })
    setEditingOpt(opt)
  }

  const top = Math.min(anchor.bottom + 6, window.innerHeight - 320)
  const left = Math.min(anchor.left, window.innerWidth - 230)

  return createPortal(
    <div
      ref={popRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: 220 }}
      className="bg-popover border border-border rounded-xl overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Rename + delete row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') onClose()
          }}
          className="flex-1 min-w-0 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:border-primary/50"
        />
        <button
          onClick={onDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5"
          title="Delete field"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Options list */}
      {hasOptions && (
        <>
          <div className="h-px bg-border mx-3 mb-1" />
          <DndContext
            sensors={optSensors}
            onDragStart={(e) => setDragOptId(e.active.id as string)}
            onDragEnd={handleOptDragEnd}
          >
            <SortableContext items={localOpts} strategy={rectSortingStrategy}>
              <div className="py-1 max-h-52 overflow-y-auto">
                {field.type === 'select' && (
                  <button
                    onClick={() => { onValueChange(null) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    — none
                    {selectedSingle === null && <span className="ml-auto text-primary text-[10px]">✓</span>}
                  </button>
                )}
                {localOpts.map((opt) => (
                  <SortableOptionRow
                    key={opt}
                    opt={opt}
                    field={field}
                    selectedSingle={selectedSingle}
                    selected={selected}
                    isDragging={dragOptId === opt}
                    onValueChange={onValueChange}
                    onOpenEdit={openOptEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={addOption}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/60 hover:text-primary hover:bg-muted/40 transition-colors"
          >
            <X size={10} className="rotate-45" />
            Add option
          </button>
        </>
      )}
      <div className="pb-1" />

      {/* Sub-popover for option edit */}
      {editingOpt && editOptPos && createPortal(
        <OptionEditSubPopover
          opt={editingOpt}
          field={field}
          pos={editOptPos}
          onClose={() => { setEditingOpt(null); setEditOptPos(null) }}
          onRename={(oldName, newName) => {
            renameOption(field.id, oldName, newName)
            setEditingOpt(newName)
            if (selectedSingle === oldName) onValueChange(newName)
          }}
          onDelete={(opt) => {
            deleteOption(field.id, opt)
            setEditingOpt(null)
            setEditOptPos(null)
            if (selectedSingle === opt) onValueChange(null)
            if (selected.includes(opt)) onValueChange(selected.filter((s) => s !== opt))
          }}
          onColor={(opt, colorKey) => {
            updateField(field.id, { optionColors: { ...(field.optionColors ?? {}), [opt]: colorKey } })
          }}
        />,
        document.body,
      )}
    </div>,
    document.body,
  )
}

function SortableOptionRow({ opt, field, selectedSingle, selected, isDragging, onValueChange, onOpenEdit }: {
  opt: string
  field: Field
  selectedSingle: string | null
  selected: string[]
  isDragging: boolean
  onValueChange: (v: Item['fields'][string]) => void
  onOpenEdit: (opt: string, el: HTMLElement) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: opt })
  const rowRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isActive = field.type === 'select' ? opt === selectedSingle : selected.includes(opt)

  const toggle = () => {
    if (field.type === 'select') {
      onValueChange(opt === selectedSingle ? null : opt)
    } else {
      onValueChange(isActive ? selected.filter((s) => s !== opt) : [...selected, opt])
    }
  }

  return (
    <div
      ref={(el) => { setNodeRef(el); rowRef.current = el }}
      style={style}
      className="group flex items-center gap-1.5 px-2 py-1 hover:bg-muted/50 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing p-0.5"
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </button>

      {/* Value toggle */}
      <button onClick={toggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        {field.type === 'multi-select' && (
          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-primary border-primary' : 'border-border'}`}>
            {isActive && <span className="text-primary-foreground text-[9px] leading-none">✓</span>}
          </span>
        )}
        <OptionTag label={opt} colorKey={field.optionColors?.[opt]} />
        {field.type === 'select' && isActive && <span className="ml-auto text-primary text-[10px]">✓</span>}
      </button>

      {/* Edit arrow */}
      <button
        onClick={() => { if (rowRef.current) onOpenEdit(opt, rowRef.current) }}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-0.5"
      >
        <ChevronRight size={10} />
      </button>
    </div>
  )
}

function OptionEditSubPopover({ opt, field, pos, onClose, onRename, onDelete, onColor }: {
  opt: string
  field: Field
  pos: { top: number; left: number }
  onClose: () => void
  onRename: (oldName: string, newName: string) => void
  onDelete: (opt: string) => void
  onColor: (opt: string, colorKey: string) => void
}) {
  const { updateField } = useCollectionStore()
  const [name, setName] = useState(opt)
  const [description, setDescription] = useState(field.optionDescriptions?.[opt] ?? '')
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const commitRename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== opt) onRename(opt, trimmed)
  }

  const top = Math.min(pos.top, window.innerHeight - 200)
  const left = Math.min(pos.left, window.innerWidth - 196)

  return (
    <div
      ref={popRef}
      style={{ position: 'fixed', top, left, zIndex: 10000, width: 188 }}
      className="bg-popover border border-border rounded-xl  overflow-hidden p-3 flex flex-col gap-2.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Rename + add + delete */}
      <div className="flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); onClose() }
            if (e.key === 'Escape') onClose()
          }}
          className="flex-1 min-w-0 border border-border rounded-md px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:border-primary/50"
        />
        <button
          onClick={() => onDelete(opt)}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5"
          title="Delete option"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => { setDescription(e.target.value); updateField(field.id, { optionDescriptions: { ...(field.optionDescriptions ?? {}), [opt]: e.target.value.trim() } }) }}
        placeholder="Description (optional)"
        rows={2}
        className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none leading-relaxed"
      />

      {/* Color picker */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Color</p>
        <div className="flex flex-wrap gap-1">
          {COLOR_KEYS.map((ck) => {
            const style = optionStyle(ck)
            const isActive = (field.optionColors?.[opt] ?? 'gray') === ck
            return (
              <button
                key={ck}
                onClick={() => onColor(opt, ck)}
                title={ck}
                style={{ backgroundColor: style.backgroundColor, borderColor: isActive ? style.color : style.borderColor }}
                className={`w-5 h-5 rounded-md border-2 transition-all ${isActive ? 'scale-110' : 'hover:scale-105'}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AddFieldPopover({ anchor, onClose, onAdd }: {
  anchor: DOMRect
  onClose: () => void
  onAdd: (name: string, type: Field['type']) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Field['type']>('select')
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const commit = () => {
    if (!name.trim()) return
    onAdd(name.trim(), type)
  }

  const estimatedHeight = 320
  const top = anchor.bottom + 6 + estimatedHeight > window.innerHeight
    ? anchor.top - estimatedHeight - 6
    : anchor.bottom + 6
  const left = Math.min(anchor.left, window.innerWidth - 220)

  return createPortal(
    <div
      ref={popRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: 220 }}
      className="bg-popover border border-border rounded-xl p-3 flex flex-col gap-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Field name"
        className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
      />
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Type</p>
        <div className="grid grid-cols-2 gap-1">
          {FIELD_TYPES.map(({ type: t, label }) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors text-left ${
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Button size="sm" onClick={commit} disabled={!name.trim()}>Add field</Button>
    </div>,
    document.body,
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, fields, draggable, selected, onToggleSelect, onUpdate, onGoToText,
}: {
  item: Item
  fields: Field[]
  draggable: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onUpdate: (patch: Partial<Item>) => void
  onGoToText: (id: string) => void
}) {
  const { setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggable,
  })

  return (
    <div
      id={`item-${item.id}`}
      ref={setNodeRef}
      className={`bg-card rounded-xl border transition-all ${
        isDragging ? 'opacity-0' : ''
      } ${selected ? 'border-primary/40 bg-accent/20' : 'border-border hover:border-border/80'}`}
    >
      <div className="flex items-start">
        {/* Checkbox */}
        <div className="flex items-center justify-center self-stretch pl-2.5 pr-1 shrink-0">
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>

        {/* Image */}
        <div className="pt-3 pb-3 pl-1 pr-2 shrink-0">
          <ImageCell item={item} onUpdate={onUpdate} size="sm" />
        </div>

        {/* Name + description — click to open in Text view */}
        <div
          onClick={() => onGoToText(item.id)}
          className="flex flex-col justify-center py-3 px-3 w-52 shrink-0 border-r border-border/60 cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <InlineInput
              value={item.name}
              onSave={(v) => onUpdate({ name: v })}
              className="text-sm font-medium text-foreground w-full"
            />
          </div>
          {item.description && (
            <span title={item.description} className="text-xs text-muted-foreground truncate block">
              {item.description}
            </span>
          )}
        </div>

        {/* Fields — horizontally scrollable */}
        <FieldCells
          fields={fields}
          itemFields={item.fields}
          onChange={(fieldId, v) => onUpdate({ fields: { ...item.fields, [fieldId]: v } })}
        />
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
      className={`inline-block rounded font-medium ${size === 'xs' ? 'text-[10px] px-1.5 py-px' : 'text-[11px] px-2 py-0.5'}`}
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
  if (field.type === 'select') {
    const label = (value as string) || null
    const colorKey = label ? field.optionColors?.[label] : undefined
    return label
      ? <OptionTag label={label} colorKey={colorKey} />
      : <span className="text-[11px] text-muted-foreground/60">—</span>
  }

  if (field.type === 'multi-select') {
    const selected: string[] = Array.isArray(value) ? value : []
    return selected.length > 0
      ? <div className="flex flex-wrap gap-1">{selected.map((s) => <OptionTag key={s} label={s} colorKey={field.optionColors?.[s]} />)}</div>
      : <span className="text-[11px] text-muted-foreground/60">—</span>
  }

  if (field.type === 'text') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <InlineInput value={(value as string) ?? ''} onSave={onChange} placeholder="—" className="text-xs text-foreground" />
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <InlineNumber value={value as number | null} onSave={onChange} />
      </div>
    )
  }

  return null
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
      className={`block w-full bg-transparent border border-transparent rounded px-1 py-0.5 focus:bg-background focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/60 transition-colors ${className}`}
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
      className="w-16 bg-transparent border border-transparent rounded px-1 py-0.5 text-xs text-foreground focus:bg-background focus:border-primary/50 focus:outline-none transition-colors"
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
          : 'bg-muted hover:bg-muted/80'
      }`}
      title={item.imagePath ? 'Click to replace image' : 'Click to upload image'}
    >
      {item.imagePath ? (
        <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground select-none">
          <ImageUp size={iconSize} />
          {size !== 'sm' && <span className="text-[10px] font-medium tracking-wide uppercase">Image</span>}
        </div>
      )}
    </div>
  )
}

// ─── View mode toggle ─────────────────────────────────────────────────────────

// ─── Zoom control ─────────────────────────────────────────────────────────────

function ZoomControl({ zoom, steps, onChange }: { zoom: number; steps: number[]; onChange: (z: number) => void }) {
  const idx = steps.indexOf(zoom)
  const canDec = idx > 0
  const canInc = idx < steps.length - 1
  const label = zoom === 1 ? '100%' : `${Math.round(zoom * 100)}%`

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => canDec && onChange(steps[idx - 1])}
        disabled={!canDec}
        className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors"
        title="Zoom out"
      >
        <ZoomOut size={12} />
      </button>
      <button
        onClick={() => onChange(1)}
        className={`text-[10px] font-medium px-1 transition-colors ${zoom !== 1 ? 'text-primary hover:text-primary/70' : 'text-muted-foreground hover:text-foreground'}`}
        title="Reset zoom"
      >
        {label}
      </button>
      <button
        onClick={() => canInc && onChange(steps[idx + 1])}
        disabled={!canInc}
        className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors"
        title="Zoom in"
      >
        <ZoomIn size={12} />
      </button>
    </div>
  )
}

// ─── View mode toggle ─────────────────────────────────────────────────────────

function ViewModeToggle({ mode, onChange }: {
  mode: 'catalogue' | 'focus' | 'cards'
  onChange: (m: 'catalogue' | 'focus' | 'cards') => void
}) {
  const btn = (m: typeof mode, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => onChange(m)}
      title={label}
      className={`flex items-center gap-2 px-3 h-8 text-xs font-medium transition-colors ${
        mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="flex items-center border border-border overflow-hidden">
      {btn('catalogue', 'Properties', <SlidersHorizontal size={14} />)}
      <div className="w-px h-5 bg-border" />
      {btn('focus', 'Text', <PenLine size={14} />)}
      <div className="w-px h-5 bg-border" />
      {btn('cards', 'Images', <Image size={14} />)}
    </div>
  )
}

// ─── Focus mode bar ───────────────────────────────────────────────────────────

// ─── Focus group header ───────────────────────────────────────────────────────

function FocusGroupSection({ groupKey, items, collapsedOverride, groupField, onUpdate }: {
  groupKey: string
  items: Item[]
  collapsedOverride?: boolean | null
  groupField?: Field
  onUpdate: (id: string, patch: Partial<Item>) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (collapsedOverride !== null && collapsedOverride !== undefined) {
      setCollapsed(collapsedOverride)
    }
  }, [collapsedOverride])

  return (
    <div>
      <div
        className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        <span className="font-semibold text-base text-foreground">{groupKey}</span>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      {groupField?.optionDescriptions?.[groupKey] && !collapsed && (
        <p className="text-sm text-muted-foreground px-2 pb-2 -mt-1">{groupField.optionDescriptions[groupKey]}</p>
      )}
      {!collapsed && items.map((item) => (
        <FocusItemCard key={item.id} item={item} onUpdate={(patch) => onUpdate(item.id, patch)} />
      ))}
    </div>
  )
}

// ─── Focus item card ──────────────────────────────────────────────────────────

function FocusItemCard({ item, onUpdate }: { item: Item; onUpdate: (patch: Partial<Item>) => void }) {
  const { addRevision, deleteRevision } = useCollectionStore()
  const revisions = item.revisions ?? []
  const [revIdx, setRevIdx] = useState(0)

  // Keep index in bounds as revisions change
  const clampedIdx = revisions.length === 0 ? 0 : Math.min(revIdx, revisions.length - 1)
  const currentRev = revisions[clampedIdx] ?? null

  const swap = (rev: NonNullable<Item['revisions']>[number]) => {
    addRevision(item.id)
    onUpdate({ name: rev.name, description: rev.description })
  }

  return (
    <div className="flex items-start gap-5 py-6 border-b border-border/60 last:border-0">
      {/* Image */}
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
        className={`w-24 h-24 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
          item.imagePath ? 'hover:opacity-80' : 'bg-muted hover:bg-muted/80'
        }`}
        title={item.imagePath ? 'Click to replace' : 'Click to upload'}
      >
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground select-none">
            <ImageUp size={22} />
            <span className="text-[10px] font-medium tracking-wide uppercase">Image</span>
          </div>
        )}
      </div>

      {/* Text + save */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <FocusInlineInput value={item.name} onSave={(v) => onUpdate({ name: v })} placeholder="Title…" />
        <FocusTextarea value={item.description} onSave={(v) => onUpdate({ description: v })} placeholder="Write something…" />
        <button
          onClick={() => addRevision(item.id)}
          className="self-start flex items-center gap-1 mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 transition-colors"
        >
          <Plus size={11} />
          Save revision
        </button>
      </div>

      {/* Revisions carousel */}
      <div className="w-64 shrink-0 border-l border-border pl-5 self-stretch flex flex-col min-h-[96px]">
        {revisions.length === 0 ? (
          <p className="text-xs text-foreground/60 italic">No revisions yet.</p>
        ) : currentRev && (
          <div className="flex flex-col gap-2 flex-1">
            <p className="text-sm font-semibold text-foreground line-clamp-1">{currentRev.name || <span className="italic text-foreground/60">Untitled</span>}</p>
            {currentRev.description && (
              <p className="text-xs text-foreground/85 line-clamp-4 leading-relaxed">{currentRev.description}</p>
            )}
            <div className="flex items-center gap-1 mt-auto pt-2">
              <button
                onClick={() => setRevIdx(i => Math.max(0, i - 1))}
                disabled={clampedIdx === 0}
                className="p-0.5 text-foreground/60 hover:text-foreground disabled:opacity-25 transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[11px] tabular-nums text-foreground/70">{clampedIdx + 1}/{revisions.length}</span>
              <button
                onClick={() => setRevIdx(i => Math.min(revisions.length - 1, i + 1))}
                disabled={clampedIdx === revisions.length - 1}
                className="p-0.5 text-foreground/60 hover:text-foreground disabled:opacity-25 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => swap(currentRev)}
                  title="Swap current with this revision"
                  className="flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground border border-border px-2.5 py-1 transition-colors"
                >
                  <ArrowLeftRight size={12} />
                  Swap
                </button>
                <button
                  onClick={() => deleteRevision(item.id, currentRev.id)}
                  title="Delete revision"
                  className="p-1 text-foreground/60 hover:text-destructive transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        )}
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
      className="block w-full bg-transparent border-none outline-none font-serif font-semibold text-lg text-foreground placeholder:text-muted-foreground/60 leading-snug"
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
      className="block w-full bg-transparent border-none outline-none font-serif text-base text-foreground leading-relaxed resize-none placeholder:text-muted-foreground/60"
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
      className="block w-full bg-transparent border-none outline-none font-serif text-3xl font-bold text-foreground placeholder:text-muted-foreground/60 leading-tight"
      placeholder="Untitled"
    />
  )
}

// ─── Card group section ───────────────────────────────────────────────────────

function CardGroupSection({ groupKey, items, groupField, collapsedOverride, onGoToProperties, cardCols, showLabels, onOpenPanel }: {
  groupKey: string
  items: Item[]
  groupField?: Field
  collapsedOverride?: boolean | null
  onGoToProperties: (id: string) => void
  cardCols: string
  showLabels: boolean
  onOpenPanel: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (collapsedOverride !== null && collapsedOverride !== undefined) setCollapsed(collapsedOverride)
  }, [collapsedOverride])

  const isEditableGroup = groupField && groupKey !== '(none)'
  const chipStyle = isEditableGroup ? optionStyle(groupField.optionColors?.[groupKey]) : null

  return (
    <div>
      <div
        className="flex items-center gap-2.5 px-1 py-2 mb-1 rounded-lg cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        {isEditableGroup && chipStyle ? (
          <span style={{ color: chipStyle.color }} className="font-semibold text-base">{groupKey}</span>
        ) : (
          <span className="font-semibold text-base text-foreground">{groupKey}</span>
        )}
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      {groupField?.optionDescriptions?.[groupKey] && (
        <p className="text-xs text-muted-foreground px-1 pb-2 -mt-1">{groupField.optionDescriptions[groupKey]}</p>
      )}
      {!collapsed && (
        <div className={`grid ${cardCols} gap-3`}>
          {items.map((item) => (
            <ImageCard key={item.id} item={item} onGoToProperties={onGoToProperties} showLabels={showLabels} onOpenPanel={onOpenPanel} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Image card (images view) ─────────────────────────────────────────────────

function ImageCard({ item, onGoToProperties: _onGoToProperties, showLabels: _showLabels = true, onOpenPanel }: {
  item: Item
  onGoToProperties: (id: string) => void
  showLabels?: boolean
  onOpenPanel: (id: string) => void
}) {
  const { updateItem } = useCollectionStore()

  const handlePlaceholderUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => updateItem(item.id, { imagePath: reader.result as string })
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div className="group">
      {/* Image area */}
      <div
        className="aspect-square overflow-hidden cursor-pointer bg-muted hover:bg-muted/80 transition-colors"
        onClick={() => item.imagePath ? onOpenPanel(item.id) : handlePlaceholderUpload()}
        title={item.imagePath ? 'Click to view details' : 'Click to upload image'}
      >
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/50 select-none">
            <ImageUp size={18} />
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => onOpenPanel(item.id)}
        className="w-full flex items-center gap-1 px-1 pt-1 pb-1 hover:bg-muted/50 transition-colors rounded"
        title="Open details"
      >
        <p className="flex-1 text-xs font-medium text-foreground truncate min-w-0 text-left">
          {item.name || <span className="text-muted-foreground/60 italic">Untitled</span>}
        </p>
        <span className={`shrink-0 p-1 rounded transition-colors ${item.imageNote ? 'text-primary' : 'text-muted-foreground/30'}`}>
          <MessageSquare size={11} fill={item.imageNote ? 'currentColor' : 'none'} />
        </span>
      </button>
    </div>
  )
}

// ─── Image detail panel ───────────────────────────────────────────────────────

function ImageDetailPanel({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { collection, updateItem } = useCollectionStore()
  const item = collection?.items.find((i) => i.id === itemId)
  const fields = collection?.schema.fields ?? []
  const [noteDraft, setNoteDraft] = useState(item?.imageNote ?? '')

  useEffect(() => {
    setNoteDraft(item?.imageNote ?? '')
  }, [itemId, item?.imageNote])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!item) return null

  const handleImageReplace = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => updateItem(item.id, { imagePath: reader.result as string })
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return createPortal(
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-80 bg-background border-l border-border flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <p className="text-xs font-medium text-muted-foreground">Details</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          <div
            className="aspect-square relative cursor-pointer group bg-muted"
            onClick={handleImageReplace}
            title="Click to replace image"
          >
            {item.imagePath ? (
              <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageUp size={24} />
                <span className="text-xs font-medium">Upload image</span>
              </div>
            )}
            {item.imagePath && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                <ImageUp size={13} /> Replace
              </div>
            )}
          </div>

          {/* Name */}
          <div className="px-4 pt-3 pb-2">
            <InlineInput
              value={item.name}
              onSave={(v) => updateItem(item.id, { name: v })}
              placeholder="Item name"
              className="text-sm font-semibold"
            />
          </div>

          {/* Description */}
          {item.description && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground line-clamp-3">{item.description}</p>
            </div>
          )}

          {/* Notes */}
          <div className="mx-4 mb-3 border-t border-border pt-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              value={noteDraft}
              rows={4}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => updateItem(item.id, { imageNote: noteDraft })}
              placeholder="Add a note…"
              className="w-full bg-muted/30 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground resize-none leading-relaxed outline-none focus:border-primary/50 focus:bg-background transition-colors"
            />
          </div>

          {/* Properties */}
          {fields.length > 0 && (
            <div className="mx-4 mb-4 border-t border-border pt-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Properties</p>
              <div className="flex flex-col gap-3">
                {fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{field.name}</p>
                    <FieldChip
                      field={field}
                      value={item.fields[field.id] ?? null}
                      onChange={(v) => updateItem(item.id, { fields: { ...item.fields, [field.id]: v } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Draft item cards ─────────────────────────────────────────────────────────

type DraftItemType = { name: string; description: string; imagePath: string; fields: Item['fields'] }

function DraftItemCard({ draft, fields, onChange, onAdd, onCancel }: {
  draft: DraftItemType
  fields: Field[]
  onChange: (patch: Partial<DraftItemType>) => void
  onAdd: () => void
  onCancel: () => void
}) {
  const imageItem = { id: '__draft__', ...draft, canvas: { x: 0, y: 0 } } as Item

  return (
    <div className="bg-card rounded-xl border border-primary/40  ring-1 ring-primary/10">
      <div className="flex items-start">
        {/* Spacer aligns with checkbox + drag handle in ItemCard */}
        <div className="w-[52px] shrink-0" />

        {/* Image */}
        <div className="pt-3 pb-3 pl-1 pr-2 shrink-0">
          <ImageCell
            item={imageItem}
            onUpdate={(p) => { if (p.imagePath !== undefined) onChange({ imagePath: p.imagePath as string }) }}
            size="sm"
          />
        </div>

        {/* Name + description */}
        <div className="flex flex-col justify-center py-3 px-3 w-80 shrink-0 border-r border-border/60">
          <InlineInput
            value={draft.name}
            onSave={(v) => onChange({ name: v })}
            placeholder="Item name"
            className="text-sm font-medium text-foreground"
          />
          <InlineInput
            value={draft.description}
            onSave={(v) => onChange({ description: v })}
            placeholder="Description"
            className="text-sm text-muted-foreground"
          />
        </div>

        {/* Fields */}
        <FieldCells
          fields={fields}
          itemFields={draft.fields}
          onChange={(fieldId, v) => onChange({ fields: { ...draft.fields, [fieldId]: v } })}
        />

        {/* Add / Cancel */}
        <div className="flex items-center gap-1.5 px-3 self-stretch border-l border-border/60 shrink-0">
          <Button size="sm" onClick={onAdd}>Add</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function DraftFocusItemCard({ draft, onChange, onAdd, onCancel }: {
  draft: DraftItemType
  onChange: (patch: Partial<DraftItemType>) => void
  onAdd: () => void
  onCancel: () => void
}) {
  const handleImageUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => onChange({ imagePath: reader.result as string })
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div className="border border-primary/40 rounded-xl bg-accent/20 ring-1 ring-primary/10 px-5 pt-5 pb-4">
      <div className="flex items-start gap-5">
        <div
          onClick={handleImageUpload}
          className={`w-24 h-24 shrink-0 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
            draft.imagePath
              ? 'hover:opacity-80'
              : 'bg-muted hover:bg-muted/80'
          }`}
          title={draft.imagePath ? 'Click to replace' : 'Click to upload'}
        >
          {draft.imagePath ? (
            <img src={draft.imagePath} alt={draft.name} className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground select-none">
              <ImageUp size={22} />
              <span className="text-[10px] font-medium tracking-wide uppercase">Image</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <FocusInlineInput value={draft.name} onSave={(v) => onChange({ name: v })} placeholder="Title…" />
          <FocusTextarea value={draft.description} onSave={(v) => onChange({ description: v })} placeholder="Write something…" />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-3">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onAdd}>Add</Button>
      </div>
    </div>
  )
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({ count, fields, selectedIds, onClear, onDelete, onSetField }: {
  count: number
  fields: Field[]
  selectedIds: Set<string>
  onClear: () => void
  onDelete: (ids: string[]) => void
  onSetField: (fieldId: string, value: string | null) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openFieldId, setOpenFieldId] = useState<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [fieldMenuPos, setFieldMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!openFieldId) return
    const handler = (e: MouseEvent) => {
      const btn = fieldRefs.current[openFieldId]
      if (btn && !btn.contains(e.target as Node)) setOpenFieldId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openFieldId])

  const selectFields = fields.filter((f) => f.type === 'select' || f.type === 'multi-select')

  const openFieldMenu = (fieldId: string) => {
    const btn = fieldRefs.current[fieldId]
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setFieldMenuPos({ top: r.bottom + 6, left: r.left })
    setOpenFieldId(fieldId)
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-accent border border-primary/20 rounded-xl px-4 py-2">
        {/* Counter + deselect */}
        <button onClick={onClear} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
          <span className="w-5 h-5 bg-primary text-primary-foreground rounded flex items-center justify-center text-[11px] font-bold">{count}</span>
          selected
          <X size={11} />
        </button>

        <div className="w-px h-4 bg-primary/20 mx-1" />

        {/* Field dropdowns */}
        {selectFields.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-primary/70 font-medium">Set:</span>
            {selectFields.map((f) => (
              <button
                key={f.id}
                ref={(el) => { fieldRefs.current[f.id] = el }}
                onClick={() => openFieldMenu(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  openFieldId === f.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-primary border-primary/30 hover:bg-accent'
                }`}
              >
                {f.name}
                <ChevronDown size={9} />
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto" />

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-md border border-transparent hover:border-destructive/20 transition-colors"
          title="Delete selected"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>

      {/* Field option menu */}
      {openFieldId && fieldMenuPos && (() => {
        const field = fields.find((f) => f.id === openFieldId)!
        return createPortal(
          <div
            style={{ position: 'fixed', top: fieldMenuPos.top, left: fieldMenuPos.left, zIndex: 9999, minWidth: 160 }}
            className="bg-popover border border-border rounded-xl  py-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-border/60">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{field.name}</span>
            </div>
            <button
              onClick={() => { onSetField(field.id, null); setOpenFieldId(null) }}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
            >
              — none
            </button>
            {field.options.map((opt) => {
              const style = optionStyle(field.optionColors?.[opt])
              return (
                <button
                  key={opt}
                  onClick={() => { onSetField(field.id, opt); setOpenFieldId(null) }}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted/50"
                >
                  <span style={{ ...style, border: `1px solid ${style.borderColor}` }} className="text-[11px] px-2 py-0.5 rounded font-medium">
                    {opt}
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      })()}

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete {count} {count === 1 ? 'item' : 'items'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { setConfirmDelete(false); onDelete([...selectedIds]) }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
