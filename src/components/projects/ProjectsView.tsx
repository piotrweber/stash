import { useCollectionStore } from '../../store/collectionStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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
    <div className="flex-1 overflow-y-auto bg-background min-h-0">
      <div className="max-w-4xl mx-auto px-8 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your collections</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadSample(); onOpen(useCollectionStore.getState().activeProjectId!) }}
          >
            Load sample
          </Button>
        </div>

        {/* Create cards */}
        <div className="grid grid-cols-4 gap-3 mb-12">
          <CreateCard
            icon={<PlusIcon />}
            label="New project"
            description="Start from scratch"
            onClick={handleNewBlank}
          />
          <CreateCard
            icon={<CsvIcon />}
            label="Import CSV"
            description="From spreadsheet"
            onClick={handleFromCsv}
          />
          <CreateCard
            icon={<ImagesIcon />}
            label="Upload images"
            description="One item per image"
            onClick={handleFromImages}
          />
          <CreateCard
            icon={<OpenIcon />}
            label="Open file"
            description="Load a .json file"
            onClick={handleLoadFile}
          />
        </div>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[...projects].reverse().map((project) => (
                <button
                  key={project.meta.id}
                  onClick={() => onOpen(project.meta.id)}
                  className="group relative bg-card rounded-xl border border-border text-left hover:border-primary/40 hover:shadow-md transition-all duration-150 overflow-hidden"
                >
                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, project.meta.id, project.meta.name)}
                    className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    ×
                  </button>

                  {/* Preview strip */}
                  <div className="flex gap-1.5 p-4 pb-3 h-20 overflow-hidden">
                    {project.items.slice(0, 5).map((item) =>
                      item.imagePath ? (
                        <div key={item.id} className="w-12 h-12 rounded-lg shrink-0 overflow-hidden bg-muted">
                          <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div key={item.id} className="w-12 h-12 rounded-lg shrink-0 bg-muted flex items-center justify-center">
                          <span className="text-sm font-semibold text-muted-foreground">{item.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )
                    )}
                    {project.items.length === 0 && (
                      <div className="w-full h-12 rounded-lg bg-muted/50 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Empty</span>
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-4">
                    <p className="text-sm font-semibold text-foreground truncate pr-6">{project.meta.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.items.length} {project.items.length === 1 ? 'item' : 'items'}
                      {project.schema.fields.length > 0 && ` · ${project.schema.fields.length} fields`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground text-sm">No projects yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Create one above to get started.</p>
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
      className="flex flex-col items-start gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-150 group"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function CsvIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function ImagesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
