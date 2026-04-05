import { useCollectionStore } from '../../store/collectionStore'

interface TopbarProps {
  onGoToProjects: () => void
}

export function Topbar({ onGoToProjects }: TopbarProps) {
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

  return (
    <div className="h-10 bg-white border-b border-gray-100 flex items-center px-4 shrink-0 select-none">
      <button
        onClick={onGoToProjects}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Projects
      </button>

      {isDirty && (
        <span className="ml-3 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
      )}

      <div className="flex-1" />

      <button
        onClick={handleSave}
        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        Save
      </button>
    </div>
  )
}
