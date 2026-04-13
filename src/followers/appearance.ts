import type { FollowerInfo } from '@/generated/classes/FollowerInfo'
import type { FollowerAppearanceDraft } from '@/types/follower'
import { loadFollowerAppearanceCatalog } from '@/followers/appearance-catalog'

const defaultFollowerAppearance: FollowerAppearanceDraft = {
  AppearanceSkin: 'Deer',
  AppearanceClothingType: 0,
  AppearanceClothingVariantIndex: 0,
  AppearanceFormColorIndex: 0,
  AppearanceClothingColorIndex: 0,
}

type ClothingVariantIndexLookup = Map<number, Map<string, number>>
type ClothingVariantNameLookup = Map<number, string[]>

let clothingVariantIndexLookup: ClothingVariantIndexLookup | null = null
let clothingVariantNameLookup: ClothingVariantNameLookup | null = null
let clothingVariantLookupPromise: Promise<void> | null = null

function normalizeVariantSkinName (
  value: string,
): string {
  return value.trim().toLowerCase()
}

function toInteger (value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed)
    }
  }

  return fallback
}

function toSkinName (value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '') {
      return trimmed
    }
  }

  return fallback
}

function ensureClothingVariantLookupsLoaded () {
  if (clothingVariantLookupPromise) {
    return
  }

  clothingVariantLookupPromise = loadFollowerAppearanceCatalog()
    .then(catalog => {
      const nextVariantIndexLookup: ClothingVariantIndexLookup = new Map()
      const nextVariantNameLookup: ClothingVariantNameLookup = new Map()

      for (const clothingOption of catalog.clothing) {
        if (!nextVariantNameLookup.has(clothingOption.clothingType)) {
          nextVariantNameLookup.set(
            clothingOption.clothingType,
            [...clothingOption.variantSkins],
          )
        }

        if (!nextVariantIndexLookup.has(clothingOption.clothingType)) {
          const nameToIndex = new Map<string, number>()
          for (const [index, variantSkin] of clothingOption.variantSkins.entries()) {
            nameToIndex.set(normalizeVariantSkinName(variantSkin), index)
          }
          nextVariantIndexLookup.set(clothingOption.clothingType, nameToIndex)
        }
      }

      clothingVariantIndexLookup = nextVariantIndexLookup
      clothingVariantNameLookup = nextVariantNameLookup
    })
    .catch(() => {
      clothingVariantIndexLookup = new Map()
      clothingVariantNameLookup = new Map()
    })
}

function resolveClothingVariantIndex (
  clothingType: number,
  clothingVariantSkinName: string | null | undefined,
  fallback: number,
): number {
  if (typeof clothingVariantSkinName !== 'string') {
    return fallback
  }

  const normalizedName = normalizeVariantSkinName(clothingVariantSkinName)
  if (normalizedName === '') {
    return fallback
  }

  const perTypeLookup = clothingVariantIndexLookup?.get(clothingType)
  const index = perTypeLookup?.get(normalizedName)
  if (index === undefined) {
    return fallback
  }

  return index
}

function resolveClothingVariantSkinName (
  clothingType: number,
  clothingVariantIndex: number,
  fallback: string | null,
): string | null {
  const variantSkins = clothingVariantNameLookup?.get(clothingType)
  if (!variantSkins || variantSkins.length === 0) {
    return fallback
  }

  const normalizedIndex = Math.max(0, Math.min(Math.trunc(clothingVariantIndex), variantSkins.length - 1))
  return variantSkins[normalizedIndex] ?? fallback
}

void (async () => {
  ensureClothingVariantLookupsLoaded()
})()

export function createDefaultFollowerAppearance (): FollowerAppearanceDraft {
  return {
    ...defaultFollowerAppearance,
  }
}

export function getFollowerAppearanceFromFollower (
  follower: FollowerInfo,
): FollowerAppearanceDraft {
  ensureClothingVariantLookupsLoaded()

  const clothingType = toInteger(
    follower.Clothing,
    defaultFollowerAppearance.AppearanceClothingType,
  )

  return {
    AppearanceSkin: toSkinName(
      follower.SkinName,
      defaultFollowerAppearance.AppearanceSkin,
    ),
    AppearanceClothingType: clothingType,
    AppearanceClothingVariantIndex: resolveClothingVariantIndex(
      clothingType,
      follower.ClothingVariant,
      defaultFollowerAppearance.AppearanceClothingVariantIndex,
    ),
    AppearanceFormColorIndex: toInteger(
      follower.SkinColour,
      defaultFollowerAppearance.AppearanceFormColorIndex,
    ),
    // No explicit typed clothing color index exists in current generated class.
    AppearanceClothingColorIndex: defaultFollowerAppearance.AppearanceClothingColorIndex,
  }
}

export function applyFollowerAppearanceToFollower (
  follower: FollowerInfo,
  appearance: FollowerAppearanceDraft,
) {
  ensureClothingVariantLookupsLoaded()

  follower.SkinName = appearance.AppearanceSkin
  follower.Clothing = toInteger(
    appearance.AppearanceClothingType,
    defaultFollowerAppearance.AppearanceClothingType,
  )
  follower.SkinColour = toInteger(
    appearance.AppearanceFormColorIndex,
    defaultFollowerAppearance.AppearanceFormColorIndex,
  )
  follower.ClothingVariant = resolveClothingVariantSkinName(
    toInteger(
      appearance.AppearanceClothingType,
      defaultFollowerAppearance.AppearanceClothingType,
    ),
    toInteger(
      appearance.AppearanceClothingVariantIndex,
      defaultFollowerAppearance.AppearanceClothingVariantIndex,
    ),
    follower.ClothingVariant ?? null,
  )
}
