import { useDraggable } from '@dnd-kit/core'
import type { Item, Schema } from '../../types/collection'

interface ItemCardProps {
  item: Item
  schema: Schema
  isSelected: boolean
  onClick: () => void
}

const RARITY_COLORS: Record<string, string> = {
  Common: 'bg-gray-100 text-gray-600',
  Rare: 'bg-blue-100 text-blue-700',
  Epic: 'bg-purple-100 text-purple-700',
}

export function ItemCard({ item, schema, isSelected, onClick }: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { canvasX: item.canvas.x, canvasY: item.canvas.y },
  })

  const visibleFields = schema.fields.filter((f) => schema.cardVisibleFields.includes(f.id))

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        position: 'absolute',
        left: item.canvas.x,
        top: item.canvas.y,
        width: 120,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        zIndex: isDragging ? 1000 : isSelected ? 10 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      data-item-card
      className={`bg-white rounded-lg shadow-sm border-2 overflow-hidden select-none ${
        isSelected ? 'border-indigo-500 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow'
      } ${isDragging ? 'shadow-xl opacity-90' : ''}`}
    >
      <div className="w-full h-[80px] bg-gray-100 flex items-center justify-center overflow-hidden">
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <div className="text-3xl select-none">{item.name.charAt(0).toUpperCase()}</div>
        )}
      </div>
      <div className="px-2 pt-1.5 pb-1">
        <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
      </div>
      {visibleFields.length > 0 && (
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          {visibleFields.map((field) => {
            const val = item.fields[field.id]
            if (val == null || val === '') return null
            const label = Array.isArray(val) ? val.join(', ') : String(val)
            const colorClass = RARITY_COLORS[label] ?? 'bg-gray-100 text-gray-600'
            return (
              <span key={field.id} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
                {label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
