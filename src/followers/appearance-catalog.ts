import type { ClothingDataFile, ClothingSlotsAndColours } from '@/generated/parser/clothing-data'
import type { WorshipperSkinAndData, WorshipperSlotsAndColours } from '@/generated/parser/worshipper-data'
import { loadClothingDataMap } from '@/generated/parser/clothing-data'
import { loadWorshipperData } from '@/generated/parser/worshipper-data'

export type FollowerAppearanceFormOption = {
  title: string
  skin: string
  hidden: boolean
  colorSets: WorshipperSlotsAndColours[]
}

export type FollowerAppearanceClothingOption = {
  id: string
  title: string
  clothingType: number
  variantSkins: string[]
  colorSets: ClothingSlotsAndColours[]
}

export type FollowerAppearanceCatalog = {
  forms: FollowerAppearanceFormOption[]
  formBySkin: Map<string, FollowerAppearanceFormOption>
  clothing: FollowerAppearanceClothingOption[]
  clothingByType: Map<number, FollowerAppearanceClothingOption>
  defaultSkin: string
  defaultClothingType: number
}

let followerAppearanceCatalogPromise: Promise<FollowerAppearanceCatalog> | null = null

function toFormOptions (
  characters: WorshipperSkinAndData[],
): FollowerAppearanceFormOption[] {
  const options: FollowerAppearanceFormOption[] = []
  for (const character of characters) {
    for (const skinEntry of character.Skin) {
      const skinName = skinEntry.Skin.trim()
      if (!skinName) {
        continue
      }

      options.push({
        title: character.Title,
        skin: skinName,
        hidden: character.Hidden,
        colorSets: character.SlotAndColours,
      })
    }
  }

  options.sort((a, b) => {
    if (a.hidden !== b.hidden) {
      return a.hidden ? 1 : -1
    }

    const titleSort = a.title.localeCompare(b.title)
    if (titleSort !== 0) {
      return titleSort
    }

    return a.skin.localeCompare(b.skin)
  })

  return options
}

function toClothingOptions (
  clothingMap: Record<string, ClothingDataFile>,
): FollowerAppearanceClothingOption[] {
  const options: FollowerAppearanceClothingOption[] = []
  for (const [id, entry] of Object.entries(clothingMap)) {
    options.push({
      id,
      title: entry.header.m_Name.trim() || id,
      clothingType: entry.ClothingType,
      variantSkins: entry.Variants,
      colorSets: entry.SlotAndColours,
    })
  }

  options.sort((a, b) => {
    if (a.clothingType === b.clothingType) {
      return a.title.localeCompare(b.title)
    }

    return a.clothingType - b.clothingType
  })

  return options
}

export async function loadFollowerAppearanceCatalog (): Promise<FollowerAppearanceCatalog> {
  if (followerAppearanceCatalogPromise) {
    return followerAppearanceCatalogPromise
  }

  followerAppearanceCatalogPromise = Promise.all([
    loadWorshipperData(),
    loadClothingDataMap(),
  ]).then(([worshipperData, clothingMap]) => {
    const forms = toFormOptions(worshipperData.Characters)
    const formBySkin = new Map<string, FollowerAppearanceFormOption>()
    for (const option of forms) {
      formBySkin.set(option.skin, option)
    }

    const clothing = toClothingOptions(clothingMap)
    const clothingByType = new Map<number, FollowerAppearanceClothingOption>()
    for (const option of clothing) {
      if (!clothingByType.has(option.clothingType)) {
        clothingByType.set(option.clothingType, option)
      }
    }

    const defaultSkin = forms[0]?.skin ?? 'Deer'
    const defaultClothingType = clothingByType.has(0)
      ? 0
      : (clothing[0]?.clothingType ?? 0)

    return {
      forms,
      formBySkin,
      clothing,
      clothingByType,
      defaultSkin,
      defaultClothingType,
    }
  })

  return followerAppearanceCatalogPromise
}
