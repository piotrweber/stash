import { useRef, useCallback, useEffect, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import { useCollectionStore } from '../../store/collectionStore'
import { ItemCard } from './ItemCard'
import { FrameBox } from './FrameBox'
import { CanvasToolbar } from './CanvasToolbar'
import { ItemPopover } from './ItemPopover'
import { ComparePopover } from './ComparePopover'
import type { CanvasTool } from './CanvasToolbar'

// Card dimensions in canvas-space (used for marquee hit test)
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
  const { collection, moveItem, setViewport, updateItem, deleteItem } = useCollectionStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })
  const spaceDown = useRef(false)

  const [tool, setTool] = useState<CanvasTool>('pan')
  const [grid, setGrid] = useState(40)
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)

  const viewport = collection?.views.canvas ?? { zoom: 1, panX: 0, panY: 0 }

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

  // Zoom toward a screen point
  const zoomAt = useCallback((screenX: number, screenY: number, factor: number) => {
    const { zoom, panX, panY } = viewport
    const newZoom = Math.min(3, Math.max(0.25, zoom * factor))
    const newPanX = screenX - (screenX - panX) * (newZoom / zoom)
    const newPanY = screenY - (screenY - panY) * (newZoom / zoom)
    setViewport(newZoom, newPanX, newPanY)
  }, [viewport, setViewport])

  // Zoom toward cursor on wheel
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

  // Keyboard shortcuts
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
    // Always allow middle-mouse or space pan
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

    if (tool === 'select' && !onItem) {
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
        // Tap on background = clear selection
        onSelectIds([])
      }
      setMarquee(null)
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, delta } = e
    const id = active.id as string
    const item = collection?.items.find((it) => it.id === id)
    if (!item) return
    const newX = snap(item.canvas.x + delta.x / viewport.zoom, grid)
    const newY = snap(item.canvas.y + delta.y / viewport.zoom, grid)
    moveItem(id, { x: newX, y: newY })
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

  const centerOfContainer = () => {
    const el = containerRef.current
    if (!el) return { x: 400, y: 300 }
    return { x: el.clientWidth / 2, y: el.clientHeight / 2 }
  }

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open. Use <span className="mx-1 font-semibold">Load sample</span> or{' '}
        <span className="mx-1 font-semibold">Open</span> to get started.
      </div>
    )
  }

  const { zoom, panX, panY } = viewport

  // Convert a canvas item position to a screen-space rect (relative to the canvas container)
  const itemScreenRect = (item: { canvas: { x: number; y: number } }) => ({
    left: item.canvas.x * zoom + panX,
    top: item.canvas.y * zoom + panY,
    right: (item.canvas.x + CARD_W) * zoom + panX,
    bottom: (item.canvas.y + CARD_H) * zoom + panY,
  })

  // Popover data
  const singleItem = selectedIds.length === 1
    ? collection.items.find((it) => it.id === selectedIds[0])
    : null

  const comparingIds = selectedIds.length === 2 ? selectedIds as [string, string] : null

  const containerW = containerRef.current?.clientWidth ?? 800
  const containerH = containerRef.current?.clientHeight ?? 600

  // Marquee rect in screen space
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
    <DndContext sensors={sensors} modifiers={[snapModifier]} onDragEnd={handleDragEnd}>
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
              />
            ))}
          </div>

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
          onZoomIn={() => {
            const c = centerOfContainer()
            zoomAt(c.x, c.y, 1.25)
          }}
          onZoomOut={() => {
            const c = centerOfContainer()
            zoomAt(c.x, c.y, 1 / 1.25)
          }}
          onZoomReset={() => setViewport(1, 0, 0)}
          onCleanup={handleCleanup}
        />

        {/* Single-item popover */}
        {singleItem && (
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
