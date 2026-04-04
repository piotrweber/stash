import { useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCollectionStore } from '../../store/collectionStore'
import { FilterSortBar } from '../shared/FilterSortBar'
import { applyFilters, applySort } from '../shared/filterSort'
import type { Item } from '../../types/collection'

interface BoardViewProps {
  onSelectItem: (id: string) => void
  selectedItemId: string | null
}

function BoardCard({
  item,
  isSelected,
  onClick,
  schema,
}: {
  item: Item
  isSelected: boolean
  onClick: () => void
  schema: import('../../types/collection').Schema
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`bg-white rounded-lg border-2 cursor-grab active:cursor-grabbing shadow-sm transition-shadow select-none overflow-hidden ${
        isSelected ? 'border-indigo-400 shadow-md' : 'border-gray-200 hover:border-gray-300'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {item.imagePath && (
        <img src={item.imagePath} alt={item.name} className="w-full h-32 object-contain bg-gray-50" />
      )}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {schema.fields.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {schema.fields.map((field) => {
              const val = item.fields[field.id]
              if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) return null
              const labels = Array.isArray(val) ? val : [String(val)]
              return labels.map((label) => (
                <span key={field.id + label} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {label}
                </span>
              ))
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Column({
  title,
  columnId,
  items,
  schema,
  onSelectItem,
  selectedItemId,
  onAddItem,
}: {
  title: string
  columnId: string
  items: Item[]
  schema: import('../../types/collection').Schema
  onSelectItem: (id: string) => void
  selectedItemId: string | null
  onAddItem: () => void
}) {
  const { setNodeRef } = useDroppable({ id: columnId })

  return (
    <div className="flex flex-col w-64 shrink-0 bg-gray-50 rounded-xl border border-gray-200">
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
        <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">{items.length}</span>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 flex flex-col gap-2 min-h-[120px]">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              schema={schema}
              isSelected={item.id === selectedItemId}
              onClick={() => onSelectItem(item.id)}
            />
          ))}
        </SortableContext>
      </div>

      <div className="px-3 py-2 border-t border-gray-200">
        <button
          onClick={onAddItem}
          className="text-xs text-gray-400 hover:text-indigo-600 transition-colors w-full text-left"
        >
          + Add card
        </button>
      </div>
    </div>
  )
}

export function BoardView({ onSelectItem, selectedItemId }: BoardViewProps) {
  const { collection, updateItem, addItem, setBoardState } = useCollectionStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const boardState = collection?.views.board
  const groupByFieldId = boardState?.groupBy ?? null
  const groupByField = collection?.schema.fields.find((f) => f.id === groupByFieldId)

  const sortFields = useMemo(() => [
    { id: 'name', name: 'Name' },
    ...(collection?.schema.fields ?? []).map((f) => ({ id: f.id, name: f.name })),
  ], [collection])

  const filterFields = useMemo(() => [
    { id: 'name', name: 'Name', type: 'text' as const },
    ...(collection?.schema.fields ?? []).map((f) => ({ id: f.id, name: f.name, type: f.type })),
  ], [collection])

  const visibleItems = useMemo(() => {
    if (!collection || !boardState) return collection?.items ?? []
    const filtered = applyFilters(collection.items, boardState.filters ?? [])
    return applySort(filtered, boardState.sortBy, boardState.sortDir ?? 'asc')
  }, [collection, boardState])

  const columns = useMemo(() => {
    if (!collection) return []

    if (!groupByField) {
      return [{ id: '__all__', title: 'All items', items: visibleItems }]
    }

    const options = [...groupByField.options, '__uncategorised__']
    return options.map((opt) => ({
      id: opt,
      title: opt === '__uncategorised__' ? 'Uncategorised' : opt,
      items: visibleItems.filter((item) => {
        const val = item.fields[groupByField.id]
        if (opt === '__uncategorised__') {
          return val == null || val === '' || (Array.isArray(val) && val.length === 0)
        }
        if (Array.isArray(val)) return val.includes(opt)
        return val === opt
      }),
    }))
  }, [collection, groupByField, visibleItems])

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || !groupByField) return
    const itemId = active.id as string
    const targetColumn = over.id as string
    if (targetColumn === '__uncategorised__') {
      updateItem(itemId, { fields: { ...collection?.items.find((i) => i.id === itemId)?.fields, [groupByField.id]: null } })
    } else if (targetColumn !== '__all__') {
      updateItem(itemId, { fields: { ...collection?.items.find((i) => i.id === itemId)?.fields, [groupByField.id]: targetColumn } })
    }
  }

  const handleAddInColumn = (columnId: string) => {
    const fields: Item['fields'] = {}
    if (groupByField && columnId !== '__all__' && columnId !== '__uncategorised__') {
      fields[groupByField.id] = columnId
    }
    addItem({ name: 'New item', description: '', imagePath: '', fields, canvas: { x: 0, y: 0 } })
  }

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open.
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex flex-col min-h-0">
      <FilterSortBar
        sortFields={sortFields}
        filterFields={filterFields}
        schemaFields={collection.schema.fields}
        sortBy={boardState?.sortBy ?? null}
        sortDir={boardState?.sortDir ?? 'asc'}
        onSortChange={(sortBy, sortDir) => setBoardState({ sortBy, sortDir })}
        filters={boardState?.filters ?? []}
        onFiltersChange={(filters) => setBoardState({ filters })}
      />
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 h-full min-h-0 items-start">
          {columns.map((col) => (
            <Column
              key={col.id}
              title={col.title}
              columnId={col.id}
              items={col.items}
              schema={collection.schema}
              onSelectItem={onSelectItem}
              selectedItemId={selectedItemId}
              onAddItem={() => handleAddInColumn(col.id)}
            />
          ))}

          {/* Group-by selector if no field set */}
          {!groupByField && collection.schema.fields.length > 0 && (
            <div className="text-xs text-gray-400 self-center ml-4">
              <p className="mb-2">Group by a field:</p>
              <div className="flex flex-col gap-1">
                {collection.schema.fields
                  .filter((f) => f.type === 'select' || f.type === 'multi-select')
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => useCollectionStore.getState().setBoardState({ groupBy: f.id })}
                      className="text-indigo-500 hover:underline text-left"
                    >
                      {f.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </DndContext>
  )
}
