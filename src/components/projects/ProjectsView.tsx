import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCollectionStore } from '../../store/collectionStore'
import { Plus, FileSpreadsheet, Images, FolderOpen, LayoutGrid, List, Copy, Trash2, Pencil, Download, FileJson, FileText } from 'lucide-react'
import type { Collection } from '../../types/collection'

interface ProjectsViewProps {
  onOpen: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function exportCsv(project: Collection) {
  const fields = project.schema.fields
  const headers = ['Name', 'Description', ...fields.map((f) => f.name)]
  const rows = project.items.map((item) => [
    item.name,
    item.description,
    ...fields.map((f) => {
      const v = item.fields[f.id]
      return Array.isArray(v) ? v.join('; ') : String(v ?? '')
    }),
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${project.meta.name}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportJson(project: Collection) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${project.meta.name}.json`; a.click()
  URL.revokeObjectURL(url)
}

export function ProjectsView({ onOpen }: ProjectsViewProps) {
  const { projects, createBlankProject, createProjectFromCsv, createProjectFromImages, deleteProject, duplicateProject, loadSample } = useCollectionStore()
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  useEffect(() => {
    if (projects.length === 0) loadSample()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNewBlank = () => {
    const name = prompt('Project name:', 'Untitled project')
    if (!name) return
    createBlankProject(name.trim() || 'Untitled project')
    onOpen(useCollectionStore.getState().activeProjectId!)
  }

  const handleFromCsv = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.csv'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      createProjectFromCsv(file.name.replace(/\.csv$/i, ''), await file.text())
      onOpen(useCollectionStore.getState().activeProjectId!)
    }
    input.click()
  }

  const handleFromImages = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? []); if (!files.length) return
      const images = await Promise.all(files.map(file => new Promise<{ name: string; dataUrl: string }>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name.replace(/\.[^.]+$/, ''), dataUrl: reader.result as string })
        reader.readAsDataURL(file)
      })))
      const name = prompt('Project name:', images[0]?.name ?? 'Untitled project') ?? 'Untitled project'
      createProjectFromImages(name.trim() || 'Untitled project', images)
      onOpen(useCollectionStore.getState().activeProjectId!)
    }
    input.click()
  }

  const handleLoadFile = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      useCollectionStore.getState().loadProjectFile(await file.text())
      onOpen(useCollectionStore.getState().activeProjectId!)
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
      <div className="max-w-4xl mx-auto px-10 py-14">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-baseline gap-3 mb-2">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Pliny</h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 bg-primary/5 px-2 py-0.5 rounded-sm">Alpha</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">Design and organise your inventory, roster and collections.</p>
        </div>

        {/* Create cards */}
        <div className="grid grid-cols-4 gap-3 mb-14">
          <CreateCard icon={<Plus size={22} />} label="New project" description="Start from scratch" onClick={handleNewBlank} />
          <CreateCard icon={<FileSpreadsheet size={22} />} label="Import CSV" description="From spreadsheet" onClick={handleFromCsv} />
          <CreateCard icon={<Images size={22} />} label="Upload images" description="One item per image" onClick={handleFromImages} />
          <CreateCard icon={<FolderOpen size={22} />} label="Open file" description="Load a .json file" onClick={handleLoadFile} />
        </div>

        {/* Projects list */}
        {projects.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  className={`flex items-center justify-center w-8 h-7 transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() => setViewMode('table')}
                  title="Table view"
                  className={`flex items-center justify-center w-8 h-7 transition-colors ${
                    viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <List size={14} />
                </button>
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {sorted.map((project) => (
                  <GridCard key={project.meta.id} project={project} onOpen={onOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                ))}
              </div>
            ) : (
              <div className="border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fields</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updated</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((project) => (
                      <TableRow key={project.meta.id} project={project} onOpen={onOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({ project, onOpen, onDelete }: {
  project: Collection
  onOpen: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string, name: string) => void
  onDuplicate: (e: React.MouseEvent, id: string) => void
}) {
  return (
    <button
      onClick={() => onOpen(project.meta.id)}
      className="group relative bg-card text-left border border-border hover:border-primary/50 hover:shadow-sm transition-all duration-150 overflow-hidden cursor-pointer"
    >
      <button
        onClick={(e) => onDelete(e, project.meta.id, project.meta.name)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
      >
        ×
      </button>
      <div className="flex gap-2 p-4 pb-3 h-24 overflow-hidden">
        {project.items.slice(0, 5).map((item) =>
          item.imagePath ? (
            <div key={item.id} className="w-14 h-14 shrink-0 overflow-hidden bg-muted">
              <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div key={item.id} className="w-14 h-14 shrink-0 bg-muted flex items-center justify-center">
              <span className="text-sm font-semibold text-muted-foreground">{item.name.charAt(0).toUpperCase()}</span>
            </div>
          )
        )}
        {project.items.length === 0 && (
          <div className="w-full h-14 bg-muted/50 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Empty</span>
          </div>
        )}
      </div>
      <div className="px-4 pb-4">
        <p className="text-sm font-semibold text-foreground truncate pr-6 mb-0.5">{project.meta.name}</p>
        <p className="text-xs text-muted-foreground">
          {project.items.length} {project.items.length === 1 ? 'item' : 'items'}
          {project.schema.fields.length > 0 && ` · ${project.schema.fields.length} fields`}
        </p>
      </div>
    </button>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TableRow({ project, onOpen, onDelete, onDuplicate }: {
  project: Collection
  onOpen: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string, name: string) => void
  onDuplicate: (e: React.MouseEvent, id: string) => void
}) {
  const { renameProject, openProject } = useCollectionStore()
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(project.meta.name)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPos, setExportPos] = useState<{ top: number; left: number } | null>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setNameDraft(project.meta.name) }, [project.meta.name])

  useEffect(() => {
    if (!exportOpen) return
    const close = () => setExportOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const commitRename = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== project.meta.name) {
      openProject(project.meta.id)
      renameProject(trimmed)
    }
    setEditing(false)
  }

  const openExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!exportBtnRef.current) return
    const r = exportBtnRef.current.getBoundingClientRect()
    setExportPos({ top: r.bottom + 4, left: r.right - 150 })
    setExportOpen(true)
  }

  return (
    <tr className="group bg-card hover:bg-accent/30 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setNameDraft(project.meta.name); setEditing(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-foreground bg-transparent border-b border-primary outline-none"
            />
          ) : (
            <button
              onClick={() => onOpen(project.meta.id)}
              className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-left"
            >
              {project.meta.name}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setEditing((v) => !v) }}
            className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
          >
            <Pencil size={12} />
          </button>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{project.items.length}</td>
      <td className="px-5 py-3.5 text-sm text-muted-foreground">{project.schema.fields.length}</td>
      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(project.meta.updatedAt)}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1 justify-end">
          <ActionBtn ref={exportBtnRef} icon={<Download size={13} />} label="Export" onClick={openExport} />
          <ActionBtn icon={<Copy size={13} />} label="Duplicate" onClick={(e) => onDuplicate(e, project.meta.id)} />
          <ActionBtn icon={<Trash2 size={13} />} label="Delete" danger onClick={(e) => onDelete(e, project.meta.id, project.meta.name)} />
        </div>

        {exportOpen && exportPos && createPortal(
          <div
            style={{ position: 'fixed', top: exportPos.top, left: exportPos.left, width: 150, zIndex: 9999 }}
            className="bg-popover border border-border py-1 shadow-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { exportCsv(project); setExportOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileText size={14} />CSV
            </button>
            <button
              onClick={() => { exportJson(project); setExportOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileJson size={14} />JSON
            </button>
          </div>,
          document.body,
        )}
      </td>
    </tr>
  )
}

// ─── Action button ────────────────────────────────────────────────────────────

const ActionBtn = ({ icon, label, onClick, danger = false, ref }: {
  icon: React.ReactNode
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  ref?: React.RefObject<HTMLButtonElement>
}) => (
  <button
    ref={ref}
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
      danger
        ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
        : 'text-muted-foreground hover:text-primary hover:bg-primary/8'
    }`}
  >
    {icon}{label}
  </button>
)

// ─── Create card ──────────────────────────────────────────────────────────────

function CreateCard({ icon, label, description, onClick }: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 bg-card border border-border p-5 text-left hover:border-primary/60 hover:bg-accent/20 transition-all duration-150 cursor-pointer"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground mb-0.5">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
