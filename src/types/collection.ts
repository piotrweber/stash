export type FieldType = 'select' | 'multi-select' | 'text' | 'number'

export interface Field {
  id: string
  name: string
  type: FieldType
  options: string[]
  optionColors?: Record<string, string>   // option value → color key
  optionDescriptions?: Record<string, string>  // option value → description
}

export interface CanvasPosition {
  x: number
  y: number
}

export interface Revision {
  id: string
  createdAt: string
  name: string
  description: string
}

export interface Item {
  id: string
  name: string
  description: string
  imagePath: string
  fields: Record<string, string | string[] | number | null>
  canvas: CanvasPosition
  revisions?: Revision[]
  imageNote?: string
}

export interface Frame {
  id: string
  label: string
  color: string
  x: number
  y: number
  width: number
  height: number
}

export interface Filter {
  fieldId: string
  op: 'is' | 'is_not' | 'contains' | 'is_any_of'
  value: string | string[]
}

export interface ViewStateTable {
  sortBy: string | null
  sortDir: 'asc' | 'desc'
  filters: Filter[]
}

export interface ViewStateBoard {
  groupBy: string | null
  sortBy: string | null
  sortDir: 'asc' | 'desc'
  filters: Filter[]
}

export interface ViewStateCanvas {
  zoom: number
  panX: number
  panY: number
  activeFilters: Filter[]
  groupBy: string | null
  stackPositions: Record<string, CanvasPosition>
}

export interface Schema {
  fields: Field[]
  cardVisibleFields: string[]
}

export interface Collection {
  meta: {
    id: string
    name: string
    version: number
    createdAt: string
    updatedAt: string
  }
  schema: Schema
  items: Item[]
  canvas: {
    frames: Frame[]
  }
  views: {
    table: ViewStateTable
    board: ViewStateBoard
    canvas: ViewStateCanvas
  }
}
