import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'
import { useCollectionStore } from '../../store/collectionStore'
import { FilterSortBar } from '../shared/FilterSortBar'
import { applyFilters, applySort } from '../shared/filterSort'
import type { Item } from '../../types/collection'

interface TableViewProps {
  onSelectItem: (id: string) => void
  selectedItemId: string | null
}

const helper = createColumnHelper<Item>()

export function TableView({ onSelectItem, selectedItemId }: TableViewProps) {
  const { collection, addItem, setTableState } = useCollectionStore()
  const [sorting, setSorting] = useState<SortingState>([])

  const tableState = collection?.views.table
  const schema = collection?.schema

  const sortFields = useMemo(() => [
    { id: 'name', name: 'Name' },
    { id: 'description', name: 'Description' },
    ...(schema?.fields ?? []).map((f) => ({ id: f.id, name: f.name })),
  ], [schema])

  const filterFields = useMemo(() => [
    { id: 'name', name: 'Name', type: 'text' as const },
    { id: 'description', name: 'Description', type: 'text' as const },
    ...(schema?.fields ?? []).map((f) => ({ id: f.id, name: f.name, type: f.type })),
  ], [schema])

  const processedItems = useMemo(() => {
    if (!collection) return []
    const filtered = applyFilters(collection.items, tableState?.filters ?? [])
    return applySort(filtered, tableState?.sortBy ?? null, tableState?.sortDir ?? 'asc')
  }, [collection, tableState])

  const columns = useMemo(() => {
    if (!collection) return []
    const base = [
      helper.accessor('imagePath', {
        header: '',
        cell: (info) => {
          const src = info.getValue()
          return src ? (
            <img src={src} alt="" className="w-16 h-16 object-contain rounded" />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded" />
          )
        },
        enableSorting: false,
      }),
      helper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-medium text-gray-800">{info.getValue()}</span>
        ),
      }),
      helper.accessor('description', {
        header: 'Description',
        cell: (info) => (
          <span className="text-gray-500 text-xs">{info.getValue()}</span>
        ),
      }),
    ]

    const fieldCols = collection.schema.fields.map((field) =>
      helper.accessor((row) => row.fields[field.id], {
        id: field.id,
        header: field.name,
        cell: (info) => {
          const val = info.getValue()
          if (val == null) return null
          if (Array.isArray(val)) {
            return (
              <div className="flex flex-wrap gap-1">
                {val.map((v) => (
                  <span key={v} className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full">
                    {v}
                  </span>
                ))}
              </div>
            )
          }
          return <span className="text-xs text-gray-700">{String(val)}</span>
        },
      }),
    )

    return [...base, ...fieldCols]
  }, [collection])

  const table = useReactTable({
    data: processedItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!collection || !tableState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No collection open.
      </div>
    )
  }

  const handleAddRow = () => {
    addItem({ name: 'New item', description: '', imagePath: '', fields: {}, canvas: { x: 0, y: 0 } })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <FilterSortBar
        sortFields={sortFields}
        filterFields={filterFields}
        schemaFields={collection.schema.fields}
        sortBy={tableState.sortBy}
        sortDir={tableState.sortDir}
        onSortChange={(sortBy, sortDir) => setTableState({ sortBy, sortDir })}
        filters={tableState.filters}
        onFiltersChange={(filters) => setTableState({ filters })}
      />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelectItem(row.original.id)}
                className={`border-b border-gray-100 cursor-pointer transition-colors ${
                  row.original.id === selectedItemId
                    ? 'bg-indigo-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleAddRow}
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    </div>
  )
}
