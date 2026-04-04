import { useCollectionStore } from '../../store/collectionStore'
import type { Item } from '../../types/collection'

interface CompareOverlayProps {
  itemIds: [string, string]
}

export function CompareOverlay({ itemIds }: CompareOverlayProps) {
  const { collection, updateItem } = useCollectionStore()
  if (!collection) return null

  const item1 = collection.items.find((it) => it.id === itemIds[0])
  const item2 = collection.items.find((it) => it.id === itemIds[1])
  if (!item1 || !item2) return null

  const swap = <T,>(get: (it: Item) => T, set: (it: Item, v: T) => Partial<Item>) => {
    const v1 = get(item1)
    const v2 = get(item2)
    updateItem(item1.id, set(item1, v2))
    updateItem(item2.id, set(item2, v1))
  }

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 select-none">
      <span className="text-[10px] text-gray-400 font-medium mr-1">Swap</span>

      <SwapBtn label="Image" onSwap={() => swap(it => it.imagePath, (_, v) => ({ imagePath: v }))} />
      <SwapBtn label="Name" onSwap={() => swap(it => it.name, (_, v) => ({ name: v }))} />
      <SwapBtn label="Description" onSwap={() => swap(it => it.description, (_, v) => ({ description: v }))} />

      {collection.schema.fields.map((field) => (
        <SwapBtn
          key={field.id}
          label={field.name}
          onSwap={() => swap(
            it => it.fields[field.id] ?? null,
            (it, v) => ({ fields: { ...it.fields, [field.id]: v } }),
          )}
        />
      ))}
    </div>
  )
}

function SwapBtn({ label, onSwap }: { label: string; onSwap: () => void }) {
  return (
    <button
      onClick={onSwap}
      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
    >
      <span>⇄</span>
      <span>{label}</span>
    </button>
  )
}
