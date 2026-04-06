import { useState } from 'react'
import { useCollectionStore } from '../../store/collectionStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Plus, FileSpreadsheet, Images, FolderOpen, LayoutGrid, List, Copy, Trash2 } from 'lucide-react'

interface ProjectsViewProps {
  onOpen: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ProjectsView({ onOpen }: ProjectsViewProps) {
  const { projects, createBlankProject, createProjectFromCsv, createProjectFromImages, deleteProject, duplicateProject, loadSample } = useCollectionStore()
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

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

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    duplicateProject(id)
  }

  const sorted = [...projects].reverse()

  return (
    <div className="flex-1 overflow-y-auto bg-background min-h-0">
      <div className="max-w-4xl mx-auto px-8 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your collections</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadSample(); onOpen(useCollectionStore.getState().activeProjectId!) }}
            >
              Load sample
            </Button>
          </div>
        </div>

        {/* Create cards */}
        <div className="grid grid-cols-4 gap-3 mb-12">
          <CreateCard icon={<Plus size={20} />} label="New project" description="Start from scratch" onClick={handleNewBlank} />
          <CreateCard icon={<FileSpreadsheet size={20} />} label="Import CSV" description="From spreadsheet" onClick={handleFromCsv} />
          <CreateCard icon={<Images size={20} />} label="Upload images" description="One item per image" onClick={handleFromImages} />
          <CreateCard icon={<FolderOpen size={20} />} label="Open file" description="Load a .json file" onClick={handleLoadFile} />
        </div>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
              <Separator className="flex-1" />
              {/* View toggle */}
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`flex items-center justify-center w-7 h-6 transition-colors ${
                    viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <LayoutGrid size={12} />
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() => setViewMode('table')}
                  title="Table view"
                  className={`flex items-center justify-center w-7 h-6 transition-colors ${
                    viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <List size={12} />
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {sorted.map((project) => (
                  <button
                    key={project.meta.id}
                    onClick={() => onOpen(project.meta.id)}
                    className="group relative bg-card rounded-xl border border-border text-left hover:border-primary/40 hover:shadow-md transition-all duration-150 overflow-hidden cursor-pointer"
                  >
                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(e, project.meta.id, project.meta.name)}
                      className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
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
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fields</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updated</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((project) => (
                      <tr
                        key={project.meta.id}
                        className="group bg-card hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onOpen(project.meta.id)}
                            className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-left"
                          >
                            {project.meta.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {project.items.length}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {project.schema.fields.length}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDate(project.meta.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDuplicate(e, project.meta.id)}
                              title="Duplicate"
                              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                            >
                              <Copy size={12} />
                              Duplicate
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, project.meta.id, project.meta.name)}
                              title="Delete"
                              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
      className="flex flex-col items-start gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-150 group cursor-pointer"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  )
}

