import { useRef } from 'react'
import { useCollectionStore } from '../../store/collectionStore'

interface ProjectsViewProps {
  onOpen: (id: string) => void
}

export function ProjectsView({ onOpen }: ProjectsViewProps) {
  const { projects, createBlankProject, createProjectFromCsv, createProjectFromImages, deleteProject, loadSample } = useCollectionStore()

  const handleNewBlank = () => {
    const name = prompt('Project name:', 'Untitled project')
    if (!name) return
    createBlankProject(name.trim() || 'Untitled project')
    const id = useCollectionStore.getState().activeProjectId!
    onOpen(id)
  }

  const handleFromCsv = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const name = file.name.replace(/\.csv$/i, '')
      createProjectFromCsv(name, text)
      const id = useCollectionStore.getState().activeProjectId!
      onOpen(id)
    }
    input.click()
  }

  const handleFromImages = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (!files.length) return
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise<{ name: string; dataUrl: string }>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve({ name: file.name.replace(/\.[^.]+$/, ''), dataUrl: reader.result as string })
              reader.readAsDataURL(file)
            }),
        ),
      )
      const name = prompt('Project name:', images[0]?.name ?? 'Untitled project') ?? 'Untitled project'
      createProjectFromImages(name.trim() || 'Untitled project', images)
      const id = useCollectionStore.getState().activeProjectId!
      onOpen(id)
    }
    input.click()
  }

  const handleLoadFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      useCollectionStore.getState().loadProjectFile(text)
      const id = useCollectionStore.getState().activeProjectId!
      onOpen(id)
    }
    input.click()
  }

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (!confirm(`Delete "${name}"?`)) return
    deleteProject(id)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <button
            onClick={() => { loadSample(); onOpen(useCollectionStore.getState().activeProjectId!) }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors border border-dashed border-gray-300 rounded px-2.5 py-1 hover:border-gray-400"
          >
            Load sample
          </button>
        </div>

        {/* Create new section */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          <CreateCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            label="New project"
            description="Start from scratch"
            onClick={handleNewBlank}
          />
          <CreateCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            label="Import CSV"
            description="Create from spreadsheet"
            onClick={handleFromCsv}
          />
          <CreateCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            }
            label="Upload images"
            description="One item per image"
            onClick={handleFromImages}
          />
          <CreateCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Open file"
            description="Load a saved .json"
            onClick={handleLoadFile}
          />
        </div>

        {/* Projects grid */}
        {projects.length > 0 && (
          <>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent</h2>
            <div className="grid grid-cols-3 gap-4">
              {[...projects].reverse().map((project) => (
                <button
                  key={project.meta.id}
                  onClick={() => onOpen(project.meta.id)}
                  className="group relative bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, project.meta.id, project.meta.name)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg leading-none"
                  >
                    ×
                  </button>

                  {/* Preview strip */}
                  <div className="flex gap-1 mb-3 h-12 overflow-hidden">
                    {project.items.slice(0, 5).map((item) =>
                      item.imagePath ? (
                        <div key={item.id} className="w-10 h-12 rounded shrink-0 overflow-hidden bg-gray-50">
                          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div key={item.id} className="w-10 h-12 rounded shrink-0 bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-400">{item.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )
                    )}
                    {project.items.length === 0 && (
                      <div className="w-full h-12 rounded bg-gray-50 flex items-center justify-center">
                        <span className="text-xs text-gray-300">Empty</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-gray-800 truncate pr-4">{project.meta.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {project.items.length} {project.items.length === 1 ? 'item' : 'items'}
                    {project.schema.fields.length > 0 && ` · ${project.schema.fields.length} fields`}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 text-sm">No projects yet.</p>
            <p className="text-gray-300 text-xs mt-1">Create one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateCard({ icon, label, description, onClick }: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </button>
  )
}
