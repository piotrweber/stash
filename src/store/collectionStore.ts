import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  Collection, Item, Field, Frame,
  CanvasPosition, ViewStateTable, ViewStateBoard,
} from '../types/collection'
import { createSampleCollection } from '../data/sampleCollection'

interface CollectionStore {
  collection: Collection | null
  filePath: string | null
  isDirty: boolean

  // File actions
  newCollection: (name: string) => void
  openCollection: (json: string, path: string) => void
  saveCollection: () => string | null   // returns JSON string (caller handles write)
  loadSample: () => void

  // Item actions
  addItem: (item: Omit<Item, 'id'>) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  moveItem: (id: string, pos: CanvasPosition) => void

  // Schema actions
  addField: (field: Omit<Field, 'id'>) => void
  updateField: (id: string, patch: Partial<Field>) => void
  deleteField: (id: string) => void

  // Canvas actions
  addFrame: (frame: Omit<Frame, 'id'>) => void
  updateFrame: (id: string, patch: Partial<Frame>) => void
  deleteFrame: (id: string) => void
  setViewport: (zoom: number, panX: number, panY: number) => void

  // View state actions
  setTableState: (patch: Partial<ViewStateTable>) => void
  setBoardState: (patch: Partial<ViewStateBoard>) => void
}

const emptyCollection = (name: string): Collection => {
  const now = new Date().toISOString()
  return {
    meta: { id: nanoid(), name, version: 1, createdAt: now, updatedAt: now },
    schema: { fields: [], cardVisibleFields: [] },
    items: [],
    canvas: { frames: [] },
    views: {
      table: { sortBy: 'name', sortDir: 'asc', filters: [] },
      board: { groupBy: null, sortBy: null, sortDir: 'asc', filters: [] },
      canvas: { zoom: 1, panX: 0, panY: 0, activeFilters: [] },
    },
  }
}

const touch = (col: Collection): Collection => ({
  ...col,
  meta: { ...col.meta, updatedAt: new Date().toISOString() },
})

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collection: null,
  filePath: null,
  isDirty: false,

  newCollection: (name) =>
    set({ collection: emptyCollection(name), filePath: null, isDirty: false }),

  openCollection: (json, path) => {
    const collection = JSON.parse(json) as Collection
    set({ collection, filePath: path, isDirty: false })
  },

  saveCollection: () => {
    const { collection } = get()
    if (!collection) return null
    const updated = touch(collection)
    set({ collection: updated, isDirty: false })
    return JSON.stringify(updated, null, 2)
  },

  loadSample: () =>
    set({ collection: createSampleCollection(), filePath: null, isDirty: false }),

  addItem: (item) =>
    set((s) => {
      if (!s.collection) return s
      const newItem: Item = { ...item, id: nanoid() }
      return {
        isDirty: true,
        collection: touch({ ...s.collection, items: [...s.collection.items, newItem] }),
      }
    }),

  updateItem: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          items: s.collection.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        }),
      }
    }),

  deleteItem: (id) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          items: s.collection.items.filter((it) => it.id !== id),
        }),
      }
    }),

  moveItem: (id, pos) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          items: s.collection.items.map((it) =>
            it.id === id ? { ...it, canvas: pos } : it,
          ),
        }),
      }
    }),

  addField: (field) =>
    set((s) => {
      if (!s.collection) return s
      const newField: Field = { ...field, id: nanoid() }
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          schema: {
            fields: [...s.collection.schema.fields, newField],
            cardVisibleFields: [...s.collection.schema.cardVisibleFields, newField.id],
          },
        }),
      }
    }),

  updateField: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          schema: {
            ...s.collection.schema,
            fields: s.collection.schema.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
          },
        }),
      }
    }),

  deleteField: (id) =>
    set((s) => {
      if (!s.collection) return s
      const items = s.collection.items.map((it) => {
        const fields = { ...it.fields }
        delete fields[id]
        return { ...it, fields }
      })
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          schema: {
            fields: s.collection.schema.fields.filter((f) => f.id !== id),
            cardVisibleFields: s.collection.schema.cardVisibleFields.filter((fid) => fid !== id),
          },
          items,
        }),
      }
    }),

  addFrame: (frame) =>
    set((s) => {
      if (!s.collection) return s
      const newFrame: Frame = { ...frame, id: nanoid() }
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          canvas: { frames: [...s.collection.canvas.frames, newFrame] },
        }),
      }
    }),

  updateFrame: (id, patch) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          canvas: {
            frames: s.collection.canvas.frames.map((fr) =>
              fr.id === id ? { ...fr, ...patch } : fr,
            ),
          },
        }),
      }
    }),

  deleteFrame: (id) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: touch({
          ...s.collection,
          canvas: {
            frames: s.collection.canvas.frames.filter((fr) => fr.id !== id),
          },
        }),
      }
    }),

  setViewport: (zoom, panX, panY) =>
    set((s) => {
      if (!s.collection) return s
      return {
        collection: {
          ...s.collection,
          views: {
            ...s.collection.views,
            canvas: { ...s.collection.views.canvas, zoom, panX, panY },
          },
        },
      }
    }),

  setTableState: (patch) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: {
          ...s.collection,
          views: { ...s.collection.views, table: { ...s.collection.views.table, ...patch } },
        },
      }
    }),

  setBoardState: (patch) =>
    set((s) => {
      if (!s.collection) return s
      return {
        isDirty: true,
        collection: {
          ...s.collection,
          views: { ...s.collection.views, board: { ...s.collection.views.board, ...patch } },
        },
      }
    }),
}))
