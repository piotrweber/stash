import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  Collection, Item, Field, Frame,
  CanvasPosition, ViewStateTable, ViewStateBoard, ViewStateCanvas,
} from '../types/collection'
import { createSampleCollection } from '../data/sampleCollection'

interface CollectionStore {
  projects: Collection[]
  activeProjectId: string | null
  isDirty: boolean

  // Convenience getter — always the active project or null
  collection: Collection | null

  // Project management
  renameProject: (name: string) => void
  createBlankProject: (name: string) => void
  createProjectFromCsv: (name: string, csvText: string) => void
  createProjectFromImages: (name: string, images: { name: string; dataUrl: string }[]) => void
  loadProjectFile: (json: string) => void
  openProject: (id: string) => void
  closeProject: () => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => void
  saveProject: () => string | null

  // Item actions
  addItem: (item: Omit<Item, 'id'>) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  moveItem: (id: string, pos: CanvasPosition) => void
  reorderItems: (orderedIds: string[]) => void

  // Schema actions
  addField: (field: Omit<Field, 'id'>) => void
  updateField: (id: string, patch: Partial<Field>) => void
  deleteField: (id: string) => void

  // Canvas actions (kept for data compat)
  addFrame: (frame: Omit<Frame, 'id'>) => void
  updateFrame: (id: string, patch: Partial<Frame>) => void
  deleteFrame: (id: string) => void
  setViewport: (zoom: number, panX: number, panY: number) => void

  // View state actions
  setTableState: (patch: Partial<ViewStateTable>) => void
  setBoardState: (patch: Partial<ViewStateBoard>) => void
  setCanvasState: (patch: Partial<ViewStateCanvas>) => void

  // Legacy compat
  loadSample: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyCollection = (name: string): Collection => {
  const now = new Date().toISOString()
  return {
    meta: { id: nanoid(), name, version: 1, createdAt: now, updatedAt: now },
    schema: { fields: [], cardVisibleFields: [] },
    items: [],
    canvas: { frames: [] },
    views: {
      table: { sortBy: null, sortDir: 'asc', filters: [] },
      board: { groupBy: null, sortBy: null, sortDir: 'asc', filters: [] },
      canvas: { zoom: 1, panX: 0, panY: 0, activeFilters: [], groupBy: null, stackPositions: {} },
    },
  }
}

const touch = (col: Collection): Collection => ({
  ...col,
  meta: { ...col.meta, updatedAt: new Date().toISOString() },
})

// Sync updated active collection into the projects array
function sync(
  state: { projects: Collection[]; activeProjectId: string | null },
  updated: Collection,
): Partial<CollectionStore> {
  return {
    isDirty: true,
    collection: updated,
    projects: state.projects.map((p) =>
      p.meta.id === updated.meta.id ? updated : p,
    ),
  }
}

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

// ─── IndexedDB storage adapter (no 5 MB limit) ────────────────────────────────

const IDB_DB = 'collectible-organiser'
const IDB_STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const idbStorage = createJSONStorage<CollectionStore>(() => ({
  getItem: async (key: string) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  },
  setItem: async (key: string, value: string) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },
  removeItem: async (key: string) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },
}))

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
  projects: [],
  activeProjectId: null,
  isDirty: false,
  collection: null,

  renameProject: (name) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, meta: { ...s.collection.meta, name } })
      return sync(s, updated)
    }),

  createBlankProject: (name) => {
    const col = emptyCollection(name)
    const item: Item = {
      id: nanoid(),
      name: 'Name',
      description: 'Description',
      imagePath: '',
      fields: {},
      canvas: { x: 0, y: 0 },
    }
    const colWithItem = { ...col, items: [item] }
    set((s) => ({
      projects: [...s.projects, colWithItem],
      activeProjectId: colWithItem.meta.id,
      collection: colWithItem,
      isDirty: false,
    }))
  },

  createProjectFromCsv: (name, csvText) => {
    const rows = parseCsv(csvText)
    if (rows.length < 2) return

    const col = emptyCollection(name)
    const fields: Field[] = []
    const fieldIdMap: Record<number, string> = {}

    const headers = rows[0]
    const dataRows = rows.slice(1)

    const nameColIdx = (() => {
      const i = headers.findIndex((h) => h.toLowerCase() === 'name')
      return i >= 0 ? i : 0
    })()
    const descColIdx = headers.findIndex((h) => h.toLowerCase() === 'description')

    for (let ci = 0; ci < headers.length; ci++) {
      if (ci === nameColIdx || ci === descColIdx) continue
      // Collect unique non-empty values to decide field type
      const seen: string[] = []
      const seenSet = new Set<string>()
      for (const row of dataRows) {
        const v = row[ci]?.trim()
        if (v && !seenSet.has(v)) { seenSet.add(v); seen.push(v) }
      }
      // Treat as select if there are repeated values and a manageable number of options
      const isSelect = seenSet.size < dataRows.length && seenSet.size <= 20
      const newField: Field = {
        id: nanoid(),
        name: headers[ci],
        type: isSelect ? 'select' : 'text',
        options: isSelect ? seen : [],
      }
      fields.push(newField)
      fieldIdMap[ci] = newField.id
    }

    const items: Item[] = dataRows.map((row, i) => ({
      id: nanoid(),
      name: row[nameColIdx]?.trim() || 'Unnamed',
      description: descColIdx >= 0 ? (row[descColIdx]?.trim() ?? '') : '',
      imagePath: '',
      fields: Object.fromEntries(
        Object.entries(fieldIdMap).map(([ciStr, fid]) => [fid, row[Number(ciStr)]?.trim() ?? ''])
      ),
      canvas: { x: 80 + (i % 8) * 140, y: 80 + Math.floor(i / 8) * 160 },
    }))

    const finalCol: Collection = {
      ...col,
      schema: { fields, cardVisibleFields: [] },
      items,
    }

    set((s) => ({
      projects: [...s.projects, finalCol],
      activeProjectId: finalCol.meta.id,
      collection: finalCol,
      isDirty: false,
    }))
  },

  createProjectFromImages: (name, images) => {
    const col = emptyCollection(name)
    const items: Item[] = images.map((img, i) => ({
      id: nanoid(),
      name: img.name,
      description: '',
      imagePath: img.dataUrl,
      fields: {},
      canvas: { x: 80 + (i % 8) * 140, y: 80 + Math.floor(i / 8) * 160 },
    }))
    const finalCol = { ...col, items }
    set((s) => ({
      projects: [...s.projects, finalCol],
      activeProjectId: finalCol.meta.id,
      collection: finalCol,
      isDirty: false,
    }))
  },

  loadProjectFile: (json) => {
    const col = JSON.parse(json) as Collection
    // Normalize missing view fields
    if (!col.views.board.sortDir) col.views.board.sortDir = 'asc'
    if (!col.views.board.filters) col.views.board.filters = []
    if (!col.views.canvas.stackPositions) col.views.canvas.stackPositions = {}
    if (col.views.canvas.groupBy === undefined) col.views.canvas.groupBy = null
    set((s) => {
      const existing = s.projects.findIndex((p) => p.meta.id === col.meta.id)
      const projects = existing >= 0
        ? s.projects.map((p) => p.meta.id === col.meta.id ? col : p)
        : [...s.projects, col]
      return { projects, activeProjectId: col.meta.id, collection: col, isDirty: false }
    })
  },

  openProject: (id) => {
    const col = get().projects.find((p) => p.meta.id === id) ?? null
    set({ activeProjectId: id, collection: col, isDirty: false })
  },

  closeProject: () => {
    set({ activeProjectId: null, collection: null, isDirty: false })
  },

  deleteProject: (id) => {
    set((s) => {
      const projects = s.projects.filter((p) => p.meta.id !== id)
      const isActive = s.activeProjectId === id
      return {
        projects,
        ...(isActive ? { activeProjectId: null, collection: null, isDirty: false } : {}),
      }
    })
  },

  duplicateProject: (id) => {
    const project = get().projects.find((p) => p.meta.id === id)
    if (!project) return
    const now = new Date().toISOString()
    const copy: Collection = {
      ...JSON.parse(JSON.stringify(project)),
      meta: { ...project.meta, id: nanoid(), name: project.meta.name + ' (copy)', createdAt: now, updatedAt: now },
    }
    set((s) => ({ projects: [...s.projects, copy] }))
  },

  saveProject: () => {
    const { collection } = get()
    if (!collection) return null
    const updated = touch(collection)
    set((s) => ({
      ...sync(s, updated),
      isDirty: false,
    }))
    return JSON.stringify(updated, null, 2)
  },

  addItem: (item) =>
    set((s) => {
      if (!s.collection) return s
      const newItem: Item = { ...item, id: nanoid() }
      const updated = touch({ ...s.collection, items: [newItem, ...s.collection.items] })
      return sync(s, updated)
    }),

  updateItem: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({
        ...s.collection,
        items: s.collection.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })
      return sync(s, updated)
    }),

  deleteItem: (id) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, items: s.collection.items.filter((it) => it.id !== id) })
      return sync(s, updated)
    }),

  moveItem: (id, pos) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({
        ...s.collection,
        items: s.collection.items.map((it) => it.id === id ? { ...it, canvas: pos } : it),
      })
      return sync(s, updated)
    }),

  reorderItems: (orderedIds) =>
    set((s) => {
      if (!s.collection) return s
      const map = new Map(s.collection.items.map((it) => [it.id, it]))
      const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as typeof s.collection.items
      const missed = s.collection.items.filter((it) => !new Set(orderedIds).has(it.id))
      const updated = touch({ ...s.collection, items: [...reordered, ...missed] })
      return sync(s, updated)
    }),

  addField: (field) =>
    set((s) => {
      if (!s.collection) return s
      const newField: Field = { ...field, id: nanoid() }
      const updated = touch({
        ...s.collection,
        schema: {
          fields: [...s.collection.schema.fields, newField],
          cardVisibleFields: [...s.collection.schema.cardVisibleFields, newField.id],
        },
      })
      return sync(s, updated)
    }),

  updateField: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({
        ...s.collection,
        schema: {
          ...s.collection.schema,
          fields: s.collection.schema.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        },
      })
      return sync(s, updated)
    }),

  deleteField: (id) =>
    set((s) => {
      if (!s.collection) return s
      const items = s.collection.items.map((it) => {
        const fields = { ...it.fields }
        delete fields[id]
        return { ...it, fields }
      })
      const updated = touch({
        ...s.collection,
        schema: {
          fields: s.collection.schema.fields.filter((f) => f.id !== id),
          cardVisibleFields: s.collection.schema.cardVisibleFields.filter((fid) => fid !== id),
        },
        items,
      })
      return sync(s, updated)
    }),

  addFrame: (frame) =>
    set((s) => {
      if (!s.collection) return s
      const newFrame: Frame = { ...frame, id: nanoid() }
      const updated = touch({ ...s.collection, canvas: { frames: [...s.collection.canvas.frames, newFrame] } })
      return sync(s, updated)
    }),

  updateFrame: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({
        ...s.collection,
        canvas: { frames: s.collection.canvas.frames.map((fr) => fr.id === id ? { ...fr, ...patch } : fr) },
      })
      return sync(s, updated)
    }),

  deleteFrame: (id) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, canvas: { frames: s.collection.canvas.frames.filter((fr) => fr.id !== id) } })
      return sync(s, updated)
    }),

  setViewport: (zoom, panX, panY) =>
    set((s) => {
      if (!s.collection) return s
      const updated = { ...s.collection, views: { ...s.collection.views, canvas: { ...s.collection.views.canvas, zoom, panX, panY } } }
      return { collection: updated, projects: s.projects.map((p) => p.meta.id === updated.meta.id ? updated : p) }
    }),

  setTableState: (patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, views: { ...s.collection.views, table: { ...s.collection.views.table, ...patch } } })
      return sync(s, updated)
    }),

  setBoardState: (patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, views: { ...s.collection.views, board: { ...s.collection.views.board, ...patch } } })
      return sync(s, updated)
    }),

  setCanvasState: (patch) =>
    set((s) => {
      if (!s.collection) return s
      const updated = touch({ ...s.collection, views: { ...s.collection.views, canvas: { ...s.collection.views.canvas, ...patch } } })
      return sync(s, updated)
    }),

  loadSample: () => {
    const col = createSampleCollection()
    set((s) => {
      const projects = [...s.projects.filter((p) => p.meta.id !== col.meta.id), col]
      return { projects, activeProjectId: col.meta.id, collection: col, isDirty: false }
    })
  },
    }),
    {
      name: 'collectible-organiser-v1',
      storage: idbStorage,
      // Don't persist isDirty — it should always start false after a reload
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        collection: s.collection,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isDirty = false
      },
    }
  )
)
