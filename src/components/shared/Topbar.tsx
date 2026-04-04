import { useCollectionStore } from '../../store/collectionStore'

export type ViewType = 'canvas' | 'table' | 'board' | 'assign'

function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim()); current = ''
        } else {
          current += ch
        }
      }
      fields.push(current.trim())
      return fields
    })
}

interface TopbarProps {
  view: ViewType
  onViewChange: (v: ViewType) => void
  onAddItem: () => void
  onShowSchema: () => void
}

export function Topbar({ view, onViewChange, onAddItem, onShowSchema }: TopbarProps) {
  const { collection, isDirty, newCollection, loadSample, saveCollection } = useCollectionStore()

  const handleNew = () => {
    const name = prompt('Collection name:', 'My Collection')
    if (name) newCollection(name)
  }

  const handleSave = () => {
    const json = saveCollection()
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collection?.meta.name ?? 'collection'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadImages = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (!files.length) return
      const COLS = 8
      const SPACING_X = 140
      const SPACING_Y = 160
      const START_X = 80
      const START_Y = 80
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        const name = file.name.replace(/\.[^.]+$/, '')
        const col = i % COLS
        const row = Math.floor(i / COLS)
        useCollectionStore.getState().addItem({
          name,
          description: '',
          imagePath: dataUrl,
          fields: {},
          canvas: { x: START_X + col * SPACING_X, y: START_Y + row * SPACING_Y },
        })
      }
    }
    input.click()
  }

  const handleOpen = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      useCollectionStore.getState().openCollection(text, file.name)
    }
    input.click()
  }

  const handleImportCsv = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length < 2) return

      const COLS = 8
      const SPACING_X = 140
      const SPACING_Y = 160
      const START_X = 80

      const headers = rows[0]
      const dataRows = rows.slice(1)

      const nameColIdx = (() => {
        const i = headers.findIndex((h) => h.toLowerCase() === 'name')
        return i >= 0 ? i : 0
      })()
      const descColIdx = headers.findIndex((h) => h.toLowerCase() === 'description')

      // Map each column to a schema field id
      const fieldIdMap: Record<number, string> = {}
      for (let ci = 0; ci < headers.length; ci++) {
        if (ci === nameColIdx || ci === descColIdx) continue
        const headerLower = headers[ci].toLowerCase()
        const existingFields = useCollectionStore.getState().collection?.schema.fields ?? []
        const existing = existingFields.find((f) => f.name.toLowerCase() === headerLower)
        if (existing) {
          fieldIdMap[ci] = existing.id
        } else {
          useCollectionStore.getState().addField({ name: headers[ci], type: 'text', options: [] })
          const updated = useCollectionStore.getState().collection?.schema.fields ?? []
          const newField = [...updated].reverse().find((f) => f.name.toLowerCase() === headerLower)
          if (newField) fieldIdMap[ci] = newField.id
        }
      }

      // Place below existing items
      const existingItems = useCollectionStore.getState().collection?.items ?? []
      const maxY = existingItems.length > 0 ? Math.max(...existingItems.map((it) => it.canvas.y)) : -SPACING_Y
      const baseY = maxY + SPACING_Y

      dataRows.forEach((row, i) => {
        const name = row[nameColIdx]?.trim() || 'Unnamed'
        const description = descColIdx >= 0 ? (row[descColIdx]?.trim() ?? '') : ''
        const fields: Record<string, string> = {}
        for (const [ciStr, fieldId] of Object.entries(fieldIdMap)) {
          fields[fieldId] = row[Number(ciStr)]?.trim() ?? ''
        }
        const col = i % COLS
        const rowIdx = Math.floor(i / COLS)
        useCollectionStore.getState().addItem({
          name,
          description,
          imagePath: '',
          fields,
          canvas: { x: START_X + col * SPACING_X, y: baseY + rowIdx * SPACING_Y },
        })
      })
    }
    input.click()
  }

  const views: { key: ViewType; label: string }[] = [
    { key: 'canvas', label: 'Canvas' },
    { key: 'table', label: 'Table' },
    { key: 'board', label: 'Board' },
    { key: 'assign', label: 'Assign' },
  ]

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0 select-none">
      {/* Title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-semibold text-sm text-gray-800 truncate max-w-48">
          {collection?.meta.name ?? 'No collection'}
        </span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
        )}
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* View switcher */}
      <div className="flex items-center bg-gray-100 rounded-md p-0.5 gap-0.5">
        {views.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              view === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {collection && (
          <>
            <button
              onClick={onAddItem}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              + Add item
            </button>
            <button
              onClick={handleUploadImages}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              + Upload images
            </button>
            <button
              onClick={handleImportCsv}
              className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Import CSV
            </button>
            <button
              onClick={onShowSchema}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              Schema
            </button>
            <button
              onClick={handleSave}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              Save
            </button>
          </>
        )}
        <button
          onClick={handleOpen}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          Open
        </button>
        <button
          onClick={handleNew}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          New
        </button>
        <button
          onClick={loadSample}
          className="px-2.5 py-1 text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Load sample
        </button>
      </div>
    </div>
  )
}
