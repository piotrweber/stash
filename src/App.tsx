import { useState, useEffect } from 'react'
import { useCollectionStore } from './store/collectionStore'
import { Topbar } from './components/shared/Topbar'
import { TableView } from './components/table/TableView'
import { ProjectsView } from './components/projects/ProjectsView'
import { SchemaEditor } from './components/sidebar/SchemaEditor'

export default function App() {
  const [screen, setScreen] = useState<'projects' | 'project'>('projects')
  const [showSchema, setShowSchema] = useState(false)
  const { collection, saveProject, addItem, openProject, closeProject } = useCollectionStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (screen === 'project') saveProject()
      }
      if (e.key === 'Escape') setShowSchema(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, saveProject])

  const handleOpenProject = (id: string) => {
    openProject(id)
    setScreen('project')
  }

  const handleGoToProjects = () => {
    setScreen('projects')
    setShowSchema(false)
  }

  const handleAddItem = () => {
    if (!collection) return
    addItem({ name: 'New item', description: '', imagePath: '', fields: {}, canvas: { x: 80, y: 80 } })
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {screen === 'project' && (
        <Topbar
          onGoToProjects={handleGoToProjects}
          onAddItem={handleAddItem}
          onShowSchema={() => setShowSchema(true)}
        />
      )}

      <div className="flex flex-1 min-h-0">
        {screen === 'projects' && <ProjectsView onOpen={handleOpenProject} />}
        {screen === 'project' && <TableView />}
      </div>

      {showSchema && <SchemaEditor onClose={() => setShowSchema(false)} />}
    </div>
  )
}
