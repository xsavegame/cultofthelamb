import type { FollowerLocation } from '@/generated/classes/FollowerLocation'
import type { FollowerRole } from '@/generated/classes/FollowerRole'
import type { FollowerTaskType } from '@/generated/classes/FollowerTaskType'
import type { FollowerTrait_TraitType } from '@/generated/classes/FollowerTrait_TraitType'

export interface FollowerAppearanceDraft {
  AppearanceSkin: string
  AppearanceClothingType: number
  AppearanceClothingVariantIndex: number
  AppearanceFormColorIndex: number
  AppearanceClothingColorIndex: number
}

export interface FollowerDraft extends FollowerAppearanceDraft {
  ID: number
  _name: string
  XPLevel: number
  Age: number
  LifeExpectancy: number
  FollowerRole: FollowerRole
  CurrentOverrideTaskType: FollowerTaskType
  Location: FollowerLocation
  Adoration: number
  _happiness: number
  _faith: number
  _satiation: number
  _starvation: number
  Traits: FollowerTrait_TraitType[]
}
