import { useState, useEffect } from 'react'
import { useCollectionStore } from './store/collectionStore'
import { Topbar, ViewType } from './components/shared/Topbar'
import { CanvasView } from './components/canvas/CanvasView'
import { TableView } from './components/table/TableView'
import { BoardView } from './components/board/BoardView'
import { ItemDetail } from './components/sidebar/ItemDetail'
import { ComparePanel } from './components/sidebar/ComparePanel'
import { SchemaEditor } from './components/sidebar/SchemaEditor'

export default function App() {
  const [view, setView] = useState<ViewType>('canvas')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showSchema, setShowSchema] = useState(false)
  const { collection, saveCollection, addItem } = useCollectionStore()

  const selectedItemId = selectedIds.length === 1 ? selectedIds[0] : null
  const comparingIds = selectedIds.length === 2 ? selectedIds as [string, string] : null

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveCollection()
      }
      if (e.key === 'Escape') {
        setSelectedIds([])
        setShowSchema(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveCollection])

  const handleAddItem = () => {
    if (!collection) return
    addItem({ name: 'New item', description: '', imagePath: '', fields: {}, canvas: { x: 80, y: 80 } })
    setTimeout(() => {
      const items = useCollectionStore.getState().collection?.items
      if (items && items.length > 0) setSelectedIds([items[items.length - 1].id])
    }, 0)
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <Topbar
        view={view}
        onViewChange={setView}
        onAddItem={handleAddItem}
        onShowSchema={() => setShowSchema(true)}
      />

      <div className="flex flex-1 min-h-0">
        {view === 'canvas' && (
          <CanvasView
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
          />
        )}
        {view === 'table' && (
          <TableView
            onSelectItem={(id) => setSelectedIds([id])}
            selectedItemId={selectedItemId}
          />
        )}
        {view === 'board' && (
          <BoardView
            onSelectItem={(id) => setSelectedIds([id])}
            selectedItemId={selectedItemId}
          />
        )}

        {view !== 'canvas' && (comparingIds ? (
          <ComparePanel itemIds={comparingIds} onClose={() => setSelectedIds([])} />
        ) : selectedItemId != null ? (
          <ItemDetail itemId={selectedItemId} onClose={() => setSelectedIds([])} />
        ) : null)}
      </div>

      {showSchema && <SchemaEditor onClose={() => setShowSchema(false)} />}
    </div>
  )
}
