import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core'
import { useCollectionStore } from '../../store/collectionStore'
import { ItemCard } from './ItemCard'
import { FrameBox } from './FrameBox'
import { CanvasToolbar } from './CanvasToolbar'
import { ItemPopover } from './ItemPopover'
import { ComparePopover } from './ComparePopover'
import { CardStack } from './CardStack'
import type { CanvasTool } from './CanvasToolbar'

const CARD_W = 120
const CARD_H = 160

function snap(v: number, grid: number) {
  if (grid === 0) return v
  return Math.round(v / grid) * grid
}

interface Rect { x1: number; y1: number; x2: number; y2: number }

function rectsOverlap(a: Rect, b: Rect) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
}

interface CanvasViewProps {
  selectedIds: string[]
  onSelectIds: (ids: string[]) => void
}

export function CanvasView({ selectedIds, onSelectIds }: CanvasViewProps) {
  const { collection, moveItem, setViewport, updateItem, deleteItem, setCanvasState } = useCollectionStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })
  const spaceDown = useRef(false)

  const [tool, setTool] = useState<CanvasTool>('pan')
  const [grid, setGrid] = useState(40)
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)

  // Hover state for popovers (non-stack mode)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)

  // Expanded stacks
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set())

  const viewport = collection?.views.canvas ?? { zoom: 1, panX: 0, panY: 0, activeFilters: [], groupBy: null, stackPositions: {} }
  const groupBy = viewport.groupBy ?? null
  const stackPositions = viewport.stackPositions ?? {}

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const snapModifier: Modifier = useCallback(({ transform, active }) => {
    if (grid === 0) return transform
    const step = grid * viewport.zoom
    const startX = ((active?.data?.current?.canvasX ?? 0) as number) * viewport.zoom
    const startY = ((active?.data?.current?.canvasY ?? 0) as number) * viewport.zoom
    return {
      ...transform,
      x: Math.round((startX + transform.x) / step) * step - startX,
      y: Math.round((startY + transform.y) / step) * step - startY,
    }
  }, [grid, viewport.zoom])

  const zoomAt = useCallback((screenX: number, screenY: number, factor: number) => {
    const { zoom, panX, panY } = viewport
    const newZoom = Math.min(3, Math.max(0.25, zoom * factor))
    const newPanX = screenX - (screenX - panX) * (newZoom / zoom)
    const newPanY = screenY - (screenY - panY) * (newZoom / zoom)
    setViewport(newZoom, newPanX, newPanY)
  }, [viewport, setViewport])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
  }, [zoomAt])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = e.type === 'keydown'
      if (e.type === 'keydown' && !e.metaKey && !e.ctrlKey) {
        if (e.key === 's') setTool('select')
        if (e.key === 'h') setTool('pan')
        if (e.key === 'Escape') onSelectIds([])
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [onSelectIds])

  const screenToCanvas = (sx: number, sy: number) => {
    const { panX, panY, zoom } = viewport
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom }
  }

  const getContainerOffset = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceDown.current) {
      isPanning.current = true
      lastPan.current = { x: e.clientX, y: e.clientY }
      containerRef.current?.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }

    if (e.button !== 0) return

    const onItem = !!(e.target as HTMLElement).closest('[data-item-card]')

    if (tool === 'pan' && !onItem) {
      isPanning.current = true
      lastPan.current = { x: e.clientX, y: e.clientY }
      containerRef.current?.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }

    if (tool === 'select' && !onItem && !groupBy) {
      const offset = getContainerOffset(e)
      setMarquee({ start: offset, end: offset })
      containerRef.current?.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x
      const dy = e.clientY - lastPan.current.y
      lastPan.current = { x: e.clientX, y: e.clientY }
      setViewport(viewport.zoom, viewport.panX + dx, viewport.panY + dy)
      return
    }
    if (marquee) {
      const offset = getContainerOffset(e)
      setMarquee((m) => m ? { ...m, end: offset } : null)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      return
    }
    if (marquee && collection) {
      const screenRect: Rect = {
        x1: Math.min(marquee.start.x, marquee.end.x),
        y1: Math.min(marquee.start.y, marquee.end.y),
        x2: Math.max(marquee.start.x, marquee.end.x),
        y2: Math.max(marquee.start.y, marquee.end.y),
      }
      const dragged = Math.abs(marquee.end.x - marquee.start.x) > 4 || Math.abs(marquee.end.y - marquee.start.y) > 4
      if (dragged) {
        const c1 = screenToCanvas(screenRect.x1, screenRect.y1)
        const c2 = screenToCanvas(screenRect.x2, screenRect.y2)
        const canvasRect: Rect = { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y }
        const hit = collection.items
          .filter((item) => rectsOverlap(canvasRect, { x1: item.canvas.x, y1: item.canvas.y, x2: item.canvas.x + CARD_W, y2: item.canvas.y + CARD_H }))
          .map((item) => item.id)
        onSelectIds(hit)
      } else {
        onSelectIds([])
      }
      setMarquee(null)
    }
  }

  const handleDragStart = (_e: DragStartEvent) => {
    isDraggingRef.current = true
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setHoveredId(null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    isDraggingRef.current = false
    const { active, delta, over } = e
    const activeId = active.id as string
    const type = active.data.current?.type as string | undefined

    // Stack drag — move the whole stack
    if (type === 'stack') {
      const groupValue = active.data.current?.groupValue as string
      const currentPos = stackPositions[groupValue] ?? { x: 80, y: 80 }
      setCanvasState({
        stackPositions: {
          ...stackPositions,
          [groupValue]: {
            x: snap(currentPos.x + delta.x / viewport.zoom, grid),
            y: snap(currentPos.y + delta.y / viewport.zoom, grid),
          },
        },
      })
      return
    }

    // Card drag in stack mode — reassign to target stack
    if (type === 'card' && groupBy) {
      if (!over) return
      const targetGroupValue = (over.id as string).replace('stack:', '')
      const sourceGroupValue = active.data.current?.groupValue as string
      if (targetGroupValue !== sourceGroupValue) {
        const item = collection?.items.find((it) => it.id === activeId)
        if (item) {
          updateItem(activeId, {
            fields: {
              ...item.fields,
              [groupBy]: targetGroupValue === '__none__' ? null : targetGroupValue,
            },
          })
        }
      }
      return
    }

    // Normal item drag (no stack mode)
    if (!groupBy) {
      const item = collection?.items.find((it) => it.id === activeId)
      if (!item) return
      const newX = snap(item.canvas.x + delta.x / viewport.zoom, grid)
      const newY = snap(item.canvas.y + delta.y / viewport.zoom, grid)
      moveItem(activeId, { x: newX, y: newY })
    }
  }

  const centerOfContainer = () => {
    const el = containerRef.current
    if (!el) return { x: 400, y: 300 }
    return { x: el.clientWidth / 2, y: el.clientHeight / 2 }
  }

  const handleCleanup = () => {
    if (!collection) return
    const COLS = 8
    const SPACING_X = 160
    const SPACING_Y = 200
    const START_X = 80
    const START_Y = 80
    collection.items.forEach((item, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      moveItem(item.id, { x: START_X + col * SPACING_X, y: START_Y + row * SPACING_Y })
    })
  }

  // Compute groups for stack mode
  const groups = useMemo(() => {
    if (!collection || !groupBy) return []
    const field = collection.schema.fields.find((f) => f.id === groupBy)
    if (!field) return []

    const grouped: Record<string, typeof collection.items> = {}
    for (const item of collection.items) {
      const val = item.fields[groupBy]
      let keys: string[]
      if (val == null || val === '') {
        keys = ['__none__']
      } else if (Array.isArray(val)) {
        keys = val.length > 0 ? val.map(String) : ['__none__']
      } else {
        keys = [String(val)]
      }
      for (const k of keys) {
        grouped[k] ??= []
        grouped[k].push(item)
      }
    }

    // Order: field options first, then __none__
    const orderedKeys = [
      ...field.options.filter((o) => grouped[o]),
      ...Object.keys(grouped).filter((k) => !field.options.includes(k)),
    ]

    return orderedKeys.map((key, i) => ({
      key,
      label: key === '__none__' ? '(none)' : key,
      items: grouped[key] ?? [],
      autoPos: { x: 80 + i * 180, y: 80 },
    }))
  }, [collection, groupBy])

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open. Use <span className="mx-1 font-semibold">Load sample</span> or{' '}
        <span className="mx-1 font-semibold">Open</span> to get started.
      </div>
    )
  }

  const { zoom, panX, panY } = viewport

  const itemScreenRect = (item: { canvas: { x: number; y: number } }) => ({
    left: item.canvas.x * zoom + panX,
    top: item.canvas.y * zoom + panY,
    right: (item.canvas.x + CARD_W) * zoom + panX,
    bottom: (item.canvas.y + CARD_H) * zoom + panY,
  })

  const singleItem = !groupBy && selectedIds.length === 1
    ? collection.items.find((it) => it.id === selectedIds[0])
    : null
  const comparingIds = !groupBy && selectedIds.length === 2 ? selectedIds as [string, string] : null
  const containerW = containerRef.current?.clientWidth ?? 800
  const containerH = containerRef.current?.clientHeight ?? 600

  // Hover popover item (non-stack mode, not in comparing state)
  const hoveredItem = !groupBy && !comparingIds && hoveredId
    ? collection.items.find((it) => it.id === hoveredId)
    : null

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.start.x, marquee.end.x),
        top: Math.min(marquee.start.y, marquee.end.y),
        width: Math.abs(marquee.end.x - marquee.start.x),
        height: Math.abs(marquee.end.y - marquee.start.y),
      }
    : null

  const activeCursor = isPanning.current || spaceDown.current || tool === 'pan' ? 'grab' : marquee ? 'crosshair' : 'default'

  return (
    <DndContext sensors={sensors} modifiers={groupBy ? [] : [snapModifier]} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-hidden relative bg-gray-50">
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ cursor: activeCursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Grid background */}
          {grid > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
                backgroundSize: `${grid * zoom}px ${grid * zoom}px`,
                backgroundPosition: `${panX}px ${panY}px`,
              }}
            />
          )}

          {groupBy ? (
            /* ---- STACK MODE ---- */
            groups.map((group) => {
              const pos = stackPositions[group.key] ?? group.autoPos
              return (
                <CardStack
                  key={group.key}
                  groupValue={group.key}
                  label={group.label}
                  items={group.items}
                  schema={collection.schema}
                  screenX={pos.x * zoom + panX}
                  screenY={pos.y * zoom + panY}
                  isExpanded={expandedStacks.has(group.key)}
                  isOver={false}
                  onToggle={() =>
                    setExpandedStacks((prev) => {
                      const next = new Set(prev)
                      if (next.has(group.key)) next.delete(group.key)
                      else next.add(group.key)
                      return next
                    })
                  }
                />
              )
            })
          ) : (
            /* ---- NORMAL MODE ---- */
            <>
              {/* Transform layer */}
              <div
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                {collection.canvas.frames.map((frame) => (
                  <FrameBox key={frame.id} frame={frame} />
                ))}
                {collection.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    schema={collection.schema}
                    isSelected={selectedIds.includes(item.id)}
                    onClick={() => onSelectIds([item.id])}
                    onMouseEnter={() => {
                      if (isDraggingRef.current) return
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                      hoverTimeoutRef.current = setTimeout(() => {
                        if (!isDraggingRef.current) setHoveredId(item.id)
                      }, 300)
                    }}
                    onMouseLeave={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                      hoverTimeoutRef.current = setTimeout(() => setHoveredId(null), 200)
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Marquee selection rect */}
          {marqueeRect && (
            <div
              className="absolute pointer-events-none border border-indigo-500 bg-indigo-100/20"
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }}
            />
          )}
        </div>

        <CanvasToolbar
          tool={tool}
          onToolChange={setTool}
          grid={grid}
          onGridChange={setGrid}
          zoom={zoom}
          onZoomIn={() => { const c = centerOfContainer(); zoomAt(c.x, c.y, 1.25) }}
          onZoomOut={() => { const c = centerOfContainer(); zoomAt(c.x, c.y, 1 / 1.25) }}
          onZoomReset={() => setViewport(1, 0, 0)}
          onCleanup={handleCleanup}
          fields={collection.schema.fields}
          groupBy={groupBy}
          onGroupByChange={(fieldId) => {
            setCanvasState({ groupBy: fieldId })
            setExpandedStacks(new Set())
          }}
        />

        {/* Hover popover (non-stack mode) */}
        {hoveredItem && !singleItem && !comparingIds && (
          <div
            onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current) }}
            onMouseLeave={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setHoveredId(null) }}
          >
            <ItemPopover
              key={hoveredItem.id}
              item={hoveredItem}
              schema={collection.schema}
              anchorRect={itemScreenRect(hoveredItem)}
              onUpdate={(patch) => updateItem(hoveredItem.id, patch)}
              onDelete={() => { deleteItem(hoveredItem.id); onSelectIds([]) }}
              onClose={() => setHoveredId(null)}
            />
          </div>
        )}

        {/* Click-selected single item popover */}
        {singleItem && !hoveredItem && (
          <ItemPopover
            key={singleItem.id}
            item={singleItem}
            schema={collection.schema}
            anchorRect={itemScreenRect(singleItem)}
            onUpdate={(patch) => updateItem(singleItem.id, patch)}
            onDelete={() => { deleteItem(singleItem.id); onSelectIds([]) }}
            onClose={() => onSelectIds([])}
          />
        )}

        {/* Compare popover */}
        {comparingIds && (
          <ComparePopover
            key={comparingIds.join('-')}
            itemIds={comparingIds}
            containerW={containerW}
            containerH={containerH}
            onClose={() => onSelectIds([])}
          />
        )}
      </div>
    </DndContext>
  )
}
