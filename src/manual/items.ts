import { InventoryItem_ITEM_TYPE } from '@/generated/classes/InventoryItem_ITEM_TYPE'

export const InventoryLimitedQuantityMax = 9999

export const InventoryUnlimitedQuantityTypes = [
  InventoryItem_ITEM_TYPE.BLACK_GOLD,
]

export const InventoryWarnOnEditTypes = [
  InventoryItem_ITEM_TYPE.MAGMA_STONE,
  InventoryItem_ITEM_TYPE.LIGHTNING_SHARD,
  InventoryItem_ITEM_TYPE.YEW_CURSED,
]

export const InventoryCreateDisallowedTypes = [
  InventoryItem_ITEM_TYPE.NONE,
]
