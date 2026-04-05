import { useCollectionStore } from '../../store/collectionStore'

interface TopbarProps {
  onGoToProjects: () => void
  onAddItem: () => void
  onShowSchema: () => void
}

export function Topbar({ onGoToProjects, onAddItem, onShowSchema }: TopbarProps) {
  const { collection, isDirty, saveProject } = useCollectionStore()

  const handleSave = () => {
    const json = saveProject()
    if (!json || !collection) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collection.meta.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadImages = () => {
    if (!collection) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (!files.length) return
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        useCollectionStore.getState().addItem({
          name: file.name.replace(/\.[^.]+$/, ''),
          description: '',
          imagePath: dataUrl,
          fields: {},
          canvas: { x: 80 + (i % 8) * 140, y: 80 + Math.floor(i / 8) * 160 },
        })
      }
    }
    input.click()
  }

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-3 shrink-0 select-none">
      {/* Back to projects */}
      <button
        onClick={onGoToProjects}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Projects
      </button>

      <div className="w-px h-5 bg-gray-200" />

      {/* Project name + dirty */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-semibold text-sm text-gray-800 truncate max-w-48">
          {collection?.meta.name ?? ''}
        </span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
        )}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onAddItem}
          className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          + Add item
        </button>
        <button
          onClick={handleUploadImages}
          className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          Upload images
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
      </div>
    </div>
  )
}
