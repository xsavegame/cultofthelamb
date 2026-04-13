import { InventoryItem_ITEM_TYPE } from '@/generated/classes/InventoryItem_ITEM_TYPE';

export type InventoryItem = [InventoryItem_ITEM_TYPE, number];

export const RECIPES: Partial<
  Record<InventoryItem_ITEM_TYPE, InventoryItem[]>
> = {
  [InventoryItem_ITEM_TYPE.MEAL_BERRIES]: [[InventoryItem_ITEM_TYPE.BERRY, 6]],
  [InventoryItem_ITEM_TYPE.MEAL]: [[InventoryItem_ITEM_TYPE.PUMPKIN, 4]],
  [InventoryItem_ITEM_TYPE.MEAL_MEDIUM_VEG]: [
    [InventoryItem_ITEM_TYPE.CAULIFLOWER, 4],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_MEAT]: [
    [InventoryItem_ITEM_TYPE.MEAT_MORSEL, 3],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MEAT]: [[InventoryItem_ITEM_TYPE.MEAT, 2]],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_FISH]: [
    [InventoryItem_ITEM_TYPE.FISH_SMALL, 3],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GOOD_FISH]: [[InventoryItem_ITEM_TYPE.FISH, 3]],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_FISH]: [
    [InventoryItem_ITEM_TYPE.FISH_SQUID, 1],
    [InventoryItem_ITEM_TYPE.FISH_OCTOPUS, 1],
    [InventoryItem_ITEM_TYPE.FISH_BLOWFISH, 1],
    [InventoryItem_ITEM_TYPE.FISH_SWORDFISH, 1],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_MEAT]: [
    [InventoryItem_ITEM_TYPE.MEAT, 4],
    [InventoryItem_ITEM_TYPE.FISH_CRAB, 1],
    [InventoryItem_ITEM_TYPE.FISH_LOBSTER, 1],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MILK_BAD]: [[InventoryItem_ITEM_TYPE.MILK, 1]],
  [InventoryItem_ITEM_TYPE.MEAL_MILK_GOOD]: [
    [InventoryItem_ITEM_TYPE.MILK, 1],
    [InventoryItem_ITEM_TYPE.PUMPKIN, 3],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MILK_GREAT]: [
    [InventoryItem_ITEM_TYPE.MILK, 1],
    [InventoryItem_ITEM_TYPE.CAULIFLOWER, 3],
    [InventoryItem_ITEM_TYPE.BEETROOT, 3],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_FOLLOWER_MEAT]: [
    [InventoryItem_ITEM_TYPE.FOLLOWER_MEAT, 3],
    [InventoryItem_ITEM_TYPE.BONE, 5],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_POOP]: [[InventoryItem_ITEM_TYPE.POOP, 3]],
  [InventoryItem_ITEM_TYPE.MEAL_DEADLY]: [
    [InventoryItem_ITEM_TYPE.FOLLOWER_MEAT, 1],
    [InventoryItem_ITEM_TYPE.POOP, 1],
    [InventoryItem_ITEM_TYPE.GRASS, 1],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GRASS]: [[InventoryItem_ITEM_TYPE.GRASS, 5]],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_MIXED]: [
    [InventoryItem_ITEM_TYPE.BERRY, 4],
    [InventoryItem_ITEM_TYPE.FISH_SMALL, 2],
    [InventoryItem_ITEM_TYPE.MEAT_MORSEL, 2],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MEDIUM_MIXED]: [
    [InventoryItem_ITEM_TYPE.PUMPKIN, 4],
    [InventoryItem_ITEM_TYPE.FISH, 2],
    [InventoryItem_ITEM_TYPE.MEAT, 2],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_MIXED]: [
    [InventoryItem_ITEM_TYPE.BEETROOT, 4],
    [InventoryItem_ITEM_TYPE.FISH_BIG, 2],
    [InventoryItem_ITEM_TYPE.MEAT, 2],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_SPICY]: [[InventoryItem_ITEM_TYPE.CHILLI, 5]],
  [InventoryItem_ITEM_TYPE.MEAL_SNOW_FRUIT]: [
    [InventoryItem_ITEM_TYPE.SNOW_FRUIT, 1],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT]: [
    [InventoryItem_ITEM_TYPE.BEETROOT, 6],
    [InventoryItem_ITEM_TYPE.PUMPKIN, 2],
    [InventoryItem_ITEM_TYPE.CAULIFLOWER, 2],
  ],
  [InventoryItem_ITEM_TYPE.MEAL_EGG]: [[InventoryItem_ITEM_TYPE.YOLK, 1]],
  [InventoryItem_ITEM_TYPE.DRINK_BEER]: [[InventoryItem_ITEM_TYPE.HOPS, 3]],
  [InventoryItem_ITEM_TYPE.DRINK_COCKTAIL]: [
    [InventoryItem_ITEM_TYPE.HOPS, 2],
    [InventoryItem_ITEM_TYPE.GRAPES, 4],
    [InventoryItem_ITEM_TYPE.FLOWER_RED, 4],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_GIN]: [
    [InventoryItem_ITEM_TYPE.BERRY, 6],
    [InventoryItem_ITEM_TYPE.GRAPES, 6],
    [InventoryItem_ITEM_TYPE.GRASS, 3],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_WINE]: [[InventoryItem_ITEM_TYPE.GRAPES, 5]],
  [InventoryItem_ITEM_TYPE.DRINK_EGGNOG]: [
    [InventoryItem_ITEM_TYPE.YOLK, 1],
    [InventoryItem_ITEM_TYPE.HOPS, 5],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_POOP_JUICE]: [
    [InventoryItem_ITEM_TYPE.POOP, 10],
    [InventoryItem_ITEM_TYPE.HOPS, 3],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_MUSHROOM_JUICE]: [
    [InventoryItem_ITEM_TYPE.MUSHROOM_SMALL, 5],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_CHILLI]: [
    [InventoryItem_ITEM_TYPE.CHILLI, 1],
    [InventoryItem_ITEM_TYPE.HOPS, 4],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_LIGHTNING]: [
    [InventoryItem_ITEM_TYPE.LIGHTNING_SHARD, 3],
    [InventoryItem_ITEM_TYPE.GRAPES, 4],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_SIN]: [
    [InventoryItem_ITEM_TYPE.PLEASURE_POINT, 3],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_GRASS]: [
    [InventoryItem_ITEM_TYPE.GRASS, 25],
    [InventoryItem_ITEM_TYPE.HOPS, 5],
  ],
  [InventoryItem_ITEM_TYPE.DRINK_MILKSHAKE]: [
    [InventoryItem_ITEM_TYPE.MILK, 2],
    [InventoryItem_ITEM_TYPE.SNOW_FRUIT, 1],
    [InventoryItem_ITEM_TYPE.POOP, 1],
  ],
};

export enum MealEffectType {
  CausesIllPoopy,
  DropLoot,
  InstantlyPoop,
  InstantlyVomit,
  CausesIllness,
  IncreasesLoyalty,
  RemovesIllness,
  RemoveFreezing,
  GivesWarmBloodedTrait,
  CausesExhaustion,
  RemovesDissent,
  InstantlyDie,
  OldFollowerYoung,
  CausesDrunk,
  RemoveMutation,
  RemoveMajorNegativeStates,
  AddRandomTrait,
}

export interface MealEffect {
  type: MealEffectType;
  chance: number;
}

export interface MealEffect {
  type: MealEffectType;
  chance: number;
}

export const MEAL_EFFECTS: Partial<
  Record<InventoryItem_ITEM_TYPE, MealEffect[]>
> = {
  [InventoryItem_ITEM_TYPE.MEAL]: [
    { type: MealEffectType.CausesIllPoopy, chance: 5 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MEAT]: [
    { type: MealEffectType.DropLoot, chance: 25 },
    { type: MealEffectType.InstantlyPoop, chance: 15 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GOOD_FISH]: [
    { type: MealEffectType.DropLoot, chance: 25 },
    { type: MealEffectType.InstantlyVomit, chance: 15 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MEDIUM_VEG]: [
    { type: MealEffectType.DropLoot, chance: 25 },
    { type: MealEffectType.CausesIllness, chance: 5 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MEDIUM_MIXED]: [
    { type: MealEffectType.IncreasesLoyalty, chance: 20 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_BERRIES]: [
    { type: MealEffectType.InstantlyPoop, chance: 15 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT]: [
    { type: MealEffectType.IncreasesLoyalty, chance: 50 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_FISH]: [
    { type: MealEffectType.CausesIllness, chance: 10 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_FISH]: [
    { type: MealEffectType.DropLoot, chance: 25 },
    { type: MealEffectType.RemovesIllness, chance: 30 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_SPICY]: [
    { type: MealEffectType.RemoveFreezing, chance: 75 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_SNOW_FRUIT]: [
    { type: MealEffectType.GivesWarmBloodedTrait, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_MEAT]: [
    { type: MealEffectType.CausesExhaustion, chance: 10 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_MEAT]: [
    { type: MealEffectType.DropLoot, chance: 75 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_BAD_MIXED]: [
    { type: MealEffectType.IncreasesLoyalty, chance: 10 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GREAT_MIXED]: [
    { type: MealEffectType.IncreasesLoyalty, chance: 100 },
    { type: MealEffectType.RemovesDissent, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_FOLLOWER_MEAT]: [
    { type: MealEffectType.CausesIllness, chance: 75 },
    { type: MealEffectType.IncreasesLoyalty, chance: 25 },
    { type: MealEffectType.RemovesDissent, chance: 40 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_GRASS]: [
    { type: MealEffectType.CausesIllness, chance: 25 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_POOP]: [
    { type: MealEffectType.CausesIllPoopy, chance: 50 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_DEADLY]: [
    { type: MealEffectType.InstantlyDie, chance: 75 },
    { type: MealEffectType.DropLoot, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_EGG]: [
    { type: MealEffectType.OldFollowerYoung, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MILK_BAD]: [
    { type: MealEffectType.CausesIllness, chance: 30 },
  ],
  [InventoryItem_ITEM_TYPE.MEAL_MILK_GOOD]: [
    { type: MealEffectType.CausesIllness, chance: 10 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_BEER]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_COCKTAIL]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_GIN]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.DropLoot, chance: 25 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_WINE]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.IncreasesLoyalty, chance: 25 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_EGGNOG]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.DropLoot, chance: 100 },
    { type: MealEffectType.IncreasesLoyalty, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_POOP_JUICE]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.CausesIllPoopy, chance: 75 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_MUSHROOM_JUICE]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.RemovesDissent, chance: 50 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_CHILLI]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.RemoveFreezing, chance: 50 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_LIGHTNING]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.RemoveMutation, chance: 25 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_SIN]: [
    { type: MealEffectType.CausesDrunk, chance: 100 },
    { type: MealEffectType.RemoveMajorNegativeStates, chance: 100 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_GRASS]: [
    { type: MealEffectType.CausesDrunk, chance: 75 },
    { type: MealEffectType.AddRandomTrait, chance: 30 },
  ],
  [InventoryItem_ITEM_TYPE.DRINK_MILKSHAKE]: [
    { type: MealEffectType.CausesIllPoopy, chance: 10 },
    { type: MealEffectType.GivesWarmBloodedTrait, chance: 75 },
    { type: MealEffectType.IncreasesLoyalty, chance: 100 },
  ],
};

export const DLC_RECIPES: InventoryItem_ITEM_TYPE[] = [
  InventoryItem_ITEM_TYPE.MEAL_SPICY,
  InventoryItem_ITEM_TYPE.MEAL_SNOW_FRUIT,
  InventoryItem_ITEM_TYPE.DRINK_CHILLI,
  InventoryItem_ITEM_TYPE.MEAL_MILK_BAD,
  InventoryItem_ITEM_TYPE.MEAL_MILK_GOOD,
  InventoryItem_ITEM_TYPE.MEAL_MILK_GREAT,
  InventoryItem_ITEM_TYPE.DRINK_MILKSHAKE,
];
