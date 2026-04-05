import { useState, useEffect } from 'react'
import { useCollectionStore } from './store/collectionStore'
import { TableView } from './components/table/TableView'
import { ProjectsView } from './components/projects/ProjectsView'
import { SchemaEditor } from './components/sidebar/SchemaEditor'

export default function App() {
  const [screen, setScreen] = useState<'projects' | 'project'>('projects')
  const [showSchema, setShowSchema] = useState(false)
  const { saveProject, openProject } = useCollectionStore()

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

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {screen === 'projects' && <ProjectsView onOpen={handleOpenProject} />}
        {screen === 'project' && (
          <TableView
            onGoToProjects={handleGoToProjects}
            onShowSchema={() => setShowSchema(true)}
          />
        )}
      </div>

      {showSchema && <SchemaEditor onClose={() => setShowSchema(false)} />}
    </div>
  )
}
