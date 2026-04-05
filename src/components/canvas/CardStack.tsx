import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Item, Schema } from '../../types/collection'

const STACK_W = 200
const PEEK_OFFSET = 10   // px each card peeks above the one in front
const FRONT_CARD_H = 140 // front card visible height when collapsed
const EXPANDED_IMG_H = 96

interface CardStackProps {
  groupValue: string
  label: string
  items: Item[]
  schema: Schema
  screenX: number
  screenY: number
  isExpanded: boolean
  onToggle: () => void
}

export function CardStack({
  groupValue, label, items, schema,
  screenX, screenY, isExpanded, onToggle,
}: CardStackProps) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: 'stack:' + groupValue,
    data: { type: 'stack', groupValue },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'stack:' + groupValue })

  const translate = transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined

  // Collapsed deck: front card + up to 3 cards peeking behind
  const peekCount = Math.min(Math.max(items.length - 1, 0), 3)
  const collapsedBodyH = peekCount * PEEK_OFFSET + FRONT_CARD_H

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: STACK_W,
        transform: translate,
        zIndex: isDragging ? 2000 : isExpanded ? 100 : 5,
        pointerEvents: 'auto',
      }}
    >
      {/* Column header — drag handle */}
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl border border-b-0 cursor-grab active:cursor-grabbing select-none transition-colors ${
          isOver
            ? 'bg-indigo-100 border-indigo-400'
            : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
      >
        <span className="text-xs font-semibold text-gray-700 truncate flex-1">{label}</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">{items.length}</span>
        <span className="text-[10px] text-gray-500 shrink-0">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      <div
        ref={setDropRef}
        className={`rounded-b-xl border bg-gray-50 transition-colors ${
          isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
        }`}
        style={{ minHeight: 48 }}
      >
        {items.length === 0 ? (
          <div className="h-12 flex items-center justify-center text-[11px] text-gray-300">
            empty — drop here
          </div>
        ) : isExpanded ? (
          /* ---- Expanded: board-style column ---- */
          <div className="flex flex-col gap-2 p-2">
            {items.map((item) => (
              <DraggableCard key={item.id} item={item} groupValue={groupValue} schema={schema} />
            ))}
          </div>
        ) : (
          /* ---- Collapsed: physical card deck ---- */
          <div
            style={{ height: collapsedBodyH, position: 'relative' }}
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="cursor-pointer"
          >
            {/* Back cards — peek above the front card */}
            {Array.from({ length: peekCount }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * PEEK_OFFSET,
                  left: 6 - i * 1,
                  right: 6 - i * 1,
                  height: FRONT_CARD_H,
                  zIndex: i + 1,
                  borderRadius: 8,
                  background: i % 2 === 0 ? '#f3f4f6' : '#e5e7eb',
                  border: '1px solid #d1d5db',
                  overflow: 'hidden',
                }}
              />
            ))}

            {/* Front card */}
            <div
              style={{
                position: 'absolute',
                top: peekCount * PEEK_OFFSET,
                left: 0,
                right: 0,
                height: FRONT_CARD_H,
                zIndex: peekCount + 2,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #d1d5db',
                background: 'white',
              }}
            >
              {items[items.length - 1] && (() => {
                const top = items[items.length - 1]
                return (
                  <>
                    <div className="w-full bg-gray-50 flex items-center justify-center overflow-hidden" style={{ height: FRONT_CARD_H - 36 }}>
                      {top.imagePath ? (
                        <img src={top.imagePath} alt={top.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-4xl text-gray-300 select-none">{top.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="px-2 py-1.5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-800 truncate">{top.name}</p>
                      {top.description && <p className="text-[10px] text-gray-400 truncate">{top.description}</p>}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableCard({ item, groupValue, schema }: { item: Item; groupValue: string; schema: Schema }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'card', groupValue, canvasX: item.canvas.x, canvasY: item.canvas.y },
  })

  const visibleFields = schema.fields.filter((f) => schema.cardVisibleFields.includes(f.id))

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        zIndex: isDragging ? 2000 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      className={`bg-white rounded-lg border-2 shadow-sm select-none overflow-hidden transition-shadow ${
        isDragging ? 'shadow-xl opacity-80 border-indigo-300' : 'border-gray-200 hover:border-gray-300 hover:shadow'
      }`}
    >
      {/* Image area */}
      <div
        className="w-full bg-gray-50 flex items-center justify-center overflow-hidden"
        style={{ height: EXPANDED_IMG_H }}
      >
        {item.imagePath ? (
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-4xl text-gray-300 select-none">{item.name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Text */}
      <div className="p-2">
        <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
        {item.description && (
          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {visibleFields.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {visibleFields.map((f) => {
              const val = item.fields[f.id]
              if (val == null || val === '') return null
              const lbl = Array.isArray(val) ? val.join(', ') : String(val)
              return (
                <span key={f.id} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{lbl}</span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
