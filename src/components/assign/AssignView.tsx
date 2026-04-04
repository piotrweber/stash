import { useState, useMemo } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCollectionStore } from '../../store/collectionStore'
import type { Item } from '../../types/collection'

export function AssignView() {
  const { collection, updateItem } = useCollectionStore()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const assignedMap = useMemo(() => {
    if (!collection) return {}
    const map: Record<string, Item[]> = {}
    for (const item of collection.items) {
      if (item.imagePath) {
        map[item.imagePath] ??= []
        map[item.imagePath].push(item)
      }
    }
    return map
  }, [collection?.items])

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open.
      </div>
    )
  }

  const imageItems = collection.items.filter((it) => !!it.imagePath)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const imagePath = active.data.current?.imagePath as string | undefined
    if (!imagePath) return
    updateItem(over.id as string, { imagePath })
  }

  const handleClickAssign = (imagePath: string) => {
    if (!selectedItemId) return
    const cur = collection.items.find((it) => it.id === selectedItemId)
    if (!cur) return
    updateItem(selectedItemId, { imagePath: cur.imagePath === imagePath ? '' : imagePath })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 min-h-0">
        {/* Left — item list */}
        <div className="w-[400px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Items — click to select, then click an image to assign
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {collection.items.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                No items yet. Import a CSV or add items.
              </div>
            ) : (
              collection.items.map((item) => (
                <DroppableItemRow
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onClick={() => setSelectedItemId(item.id === selectedItemId ? null : item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right — image pool */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Image Pool — click or drag onto an item
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {imageItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                No images yet. Upload images first.
              </div>
            ) : (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
              >
                {imageItems.map((item) => {
                  const assignedElsewhere = (assignedMap[item.imagePath] ?? []).filter(
                    (it) => it.id !== item.id,
                  )
                  return (
                    <DraggableImageThumb
                      key={item.id}
                      item={item}
                      assignedTo={assignedElsewhere}
                      isSelectedItemImage={
                        selectedItemId != null &&
                        collection.items.find((it) => it.id === selectedItemId)?.imagePath ===
                          item.imagePath
                      }
                      onClick={() => handleClickAssign(item.imagePath)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function DroppableItemRow({
  item,
  isSelected,
  onClick,
}: {
  item: Item
  isSelected: boolean
  onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: item.id })
  const hasImage = !!item.imagePath

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 cursor-pointer select-none transition-colors ${
        isSelected
          ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
          : !hasImage
          ? 'bg-amber-50 hover:bg-amber-100'
          : 'hover:bg-gray-50'
      } ${isOver ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 shrink-0 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-lg text-gray-400 font-medium">{item.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 truncate">{item.description}</p>
        )}
      </div>

      {/* Status badge */}
      {!hasImage && (
        <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
          no image
        </span>
      )}
    </div>
  )
}

function DraggableImageThumb({
  item,
  assignedTo,
  isSelectedItemImage,
  onClick,
}: {
  item: Item
  assignedTo: Item[]
  isSelectedItemImage: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'img-' + item.id,
    data: { imagePath: item.imagePath },
  })

  const assigned = assignedTo.length > 0
  const firstName = assignedTo[0]?.name

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      className={`relative rounded-lg overflow-hidden bg-gray-100 aspect-square select-none transition-shadow ${
        isSelectedItemImage
          ? 'ring-2 ring-indigo-500 shadow-md'
          : assigned
          ? 'ring-1 ring-green-400'
          : 'hover:shadow-md'
      }`}
    >
      <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />

      {/* Assigned overlay */}
      {assigned && (
        <div className="absolute bottom-0 left-0 right-0 bg-green-600/80 px-1.5 py-0.5 flex items-center gap-1">
          <span className="text-white text-[10px]">✓</span>
          <span className="text-white text-[10px] truncate font-medium">{firstName}</span>
        </div>
      )}

      {/* Name label */}
      <div className="absolute top-0 left-0 right-0 bg-black/30 px-1.5 py-0.5">
        <span className="text-white text-[10px] truncate block">{item.name}</span>
      </div>
    </div>
  )
}
