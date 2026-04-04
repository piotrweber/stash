import type { Item, Filter } from '../../types/collection'

function getItemValue(item: Item, fieldId: string): string | string[] | number | null {
  if (fieldId === 'name') return item.name
  if (fieldId === 'description') return item.description
  return item.fields[fieldId] ?? null
}

export function matchesFilter(item: Item, filter: Filter): boolean {
  const val = getItemValue(item, filter.fieldId)
  const str = Array.isArray(val) ? val.join(', ') : String(val ?? '')

  switch (filter.op) {
    case 'is':
      return str.toLowerCase() === String(filter.value).toLowerCase()
    case 'is_not':
      return str.toLowerCase() !== String(filter.value).toLowerCase()
    case 'contains':
      return str.toLowerCase().includes(String(filter.value).toLowerCase())
    case 'is_any_of': {
      const targets = Array.isArray(filter.value) ? filter.value : [filter.value as string]
      if (Array.isArray(val)) return targets.some((t) => val.includes(t))
      return targets.includes(str)
    }
  }
}

export function applyFilters(items: Item[], filters: Filter[]): Item[] {
  if (!filters.length) return items
  return items.filter((item) => filters.every((f) => matchesFilter(item, f)))
}

export function applySort(items: Item[], sortBy: string | null, sortDir: 'asc' | 'desc'): Item[] {
  if (!sortBy) return items
  return [...items].sort((a, b) => {
    const av = getItemValue(a, sortBy)
    const bv = getItemValue(b, sortBy)
    const as = Array.isArray(av) ? av.join(', ') : String(av ?? '')
    const bs = Array.isArray(bv) ? bv.join(', ') : String(bv ?? '')
    const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  })
}
