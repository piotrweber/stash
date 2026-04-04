import type { Collection } from '../types/collection'

export function createSampleCollection(): Collection {
  const now = new Date().toISOString()
  return {
    meta: {
      id: 'sample-001',
      name: 'Miner Gems',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    schema: {
      fields: [
        { id: 'f1', name: 'Rarity', type: 'select', options: ['Common', 'Rare', 'Epic'] },
        { id: 'f2', name: 'Type', type: 'select', options: ['Gem', 'Ore', 'Tool'] },
      ],
      cardVisibleFields: ['f1'],
    },
    items: [
      {
        id: 'i1', name: 'Ruby', description: 'A rare red gem.',
        imagePath: '', fields: { f1: 'Rare', f2: 'Gem' }, canvas: { x: 160, y: 240 },
      },
      {
        id: 'i2', name: 'Sapphire', description: 'A brilliant blue gem.',
        imagePath: '', fields: { f1: 'Epic', f2: 'Gem' }, canvas: { x: 320, y: 240 },
      },
      {
        id: 'i3', name: 'Coal', description: 'Combustible black rock.',
        imagePath: '', fields: { f1: 'Common', f2: 'Ore' }, canvas: { x: 160, y: 440 },
      },
      {
        id: 'i4', name: 'Iron Ore', description: 'Metallic ore for smelting.',
        imagePath: '', fields: { f1: 'Common', f2: 'Ore' }, canvas: { x: 320, y: 440 },
      },
      {
        id: 'i5', name: 'Diamond', description: 'The hardest gem known.',
        imagePath: '', fields: { f1: 'Epic', f2: 'Gem' }, canvas: { x: 480, y: 240 },
      },
      {
        id: 'i6', name: 'Pickaxe', description: 'Tool for mining ores.',
        imagePath: '', fields: { f1: 'Rare', f2: 'Tool' }, canvas: { x: 480, y: 440 },
      },
    ],
    canvas: {
      frames: [
        { id: 'fr1', label: 'Gems', color: '#e8f0ff', x: 100, y: 180, width: 500, height: 180 },
      ],
    },
    views: {
      table: { sortBy: 'name', sortDir: 'asc', filters: [] },
      board: { groupBy: 'f1', sortBy: null },
      canvas: { zoom: 1, panX: 0, panY: 0, activeFilters: [] },
    },
  }
}
