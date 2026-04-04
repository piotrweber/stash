import { useCollectionStore } from '../../store/collectionStore'
import type { Item } from '../../types/collection'

interface ComparePanelProps {
  itemIds: [string, string]
  onClose: () => void
}

export function ComparePanel({ itemIds, onClose }: ComparePanelProps) {
  const { collection, updateItem } = useCollectionStore()

  if (!collection) return null

  const item1 = collection.items.find((it) => it.id === itemIds[0])
  const item2 = collection.items.find((it) => it.id === itemIds[1])

  if (!item1 || !item2) return null

  const swap = <T,>(
    get: (item: Item) => T,
    set: (item: Item, val: T) => Partial<Item>,
  ) => {
    const v1 = get(item1)
    const v2 = get(item2)
    updateItem(item1.id, set(item1, v2))
    updateItem(item2.id, set(item2, v1))
  }

  return (
    <div className="w-[560px] border-l border-gray-200 bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <span className="text-sm font-semibold text-gray-700">Compare & swap</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image row */}
        <SwapRow
          label="Image"
          left={
            item1.imagePath
              ? <img src={item1.imagePath} alt={item1.name} className="w-16 h-16 object-contain rounded bg-gray-100" />
              : <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xl text-gray-400">{item1.name.charAt(0).toUpperCase()}</div>
          }
          right={
            item2.imagePath
              ? <img src={item2.imagePath} alt={item2.name} className="w-16 h-16 object-contain rounded bg-gray-100" />
              : <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xl text-gray-400">{item2.name.charAt(0).toUpperCase()}</div>
          }
          onSwap={() => swap(
            (it) => it.imagePath,
            (_, v) => ({ imagePath: v }),
          )}
        />

        {/* Name row */}
        <SwapRow
          label="Name"
          left={<span className="text-sm font-medium text-gray-800">{item1.name}</span>}
          right={<span className="text-sm font-medium text-gray-800">{item2.name}</span>}
          onSwap={() => swap(
            (it) => it.name,
            (_, v) => ({ name: v }),
          )}
        />

        {/* Description row */}
        <SwapRow
          label="Description"
          left={<span className="text-xs text-gray-500 line-clamp-2">{item1.description || <em className="text-gray-300">empty</em>}</span>}
          right={<span className="text-xs text-gray-500 line-clamp-2">{item2.description || <em className="text-gray-300">empty</em>}</span>}
          onSwap={() => swap(
            (it) => it.description,
            (_, v) => ({ description: v }),
          )}
        />

        {/* Schema fields */}
        {collection.schema.fields.map((field) => {
          const fmt = (val: Item['fields'][string]) => {
            if (val == null || val === '') return <em className="text-gray-300">—</em>
            if (Array.isArray(val)) return (
              <div className="flex flex-wrap gap-1">
                {val.map((v) => (
                  <span key={v} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full">{v}</span>
                ))}
              </div>
            )
            return <span className="text-xs text-gray-700">{String(val)}</span>
          }

          return (
            <SwapRow
              key={field.id}
              label={field.name}
              left={fmt(item1.fields[field.id] ?? null)}
              right={fmt(item2.fields[field.id] ?? null)}
              onSwap={() => swap(
                (it) => it.fields[field.id] ?? null,
                (it, v) => ({ fields: { ...it.fields, [field.id]: v } }),
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

function SwapRow({
  label,
  left,
  right,
  onSwap,
}: {
  label: string
  left: React.ReactNode
  right: React.ReactNode
  onSwap: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-50">
      <div className="flex-1 min-w-0 p-2 rounded-lg bg-gray-50">{left}</div>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        <button
          onClick={onSwap}
          className="px-2 py-1 text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          title={`Swap ${label}`}
        >
          ⇄
        </button>
      </div>
      <div className="flex-1 min-w-0 p-2 rounded-lg bg-gray-50">{right}</div>
    </div>
  )
}
