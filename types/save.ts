import { Type, type Static } from '@sinclair/typebox';

// export interface CultTrait extends Array<number> {}

// export interface Thought {}

// export enum FollowerTrait {
//   Ascetic = 49,
// }

// export interface Follower {
//   ID: number;
//   XPLevel: number;
//   Age: number;
//   LifeExpectancy: number;
//   DayJoined: number;
//   TaxEnforcer: boolean;
//   FaithEnforcer: boolean;
//   MemberDuration: number;
//   SacrificialValue: number;
//   Outfit: number;
//   SkinCharacter: number;
//   Necklace: number;
//   IsStarving: boolean;
//   MarriedToLeader: boolean;
//   Name: string;
//   CursedState: number;
//   WorkerBeenGivenOrders: boolean;
//   Thoughts: Thought[];
//   Traits: FollowerTrait[];
//   SkinVariation: number;
//   Adoration: number;
//   Faith: number;
//   Happiness: number;
//   Illness: number;
//   Reeducation: number;
//   Exhaustion: number;
//   Rest: number;
//   Starvation: number;
//   Satiation: number;
// }

// export interface Item {
//   type: number;
//   quantity: number;
//   QuantityReserved: number;
//   UnreservedQuantity: number;
// }

// export interface JsonSaveFile {
//   AllowSaving: boolean;
//   PauseGameTime: boolean;
//   GameOverEnabled: boolean;
//   DisplayGameOverWarning: boolean;
//   InGameOver: boolean;
//   GameOver: boolean;
//   DifficultyChosen: boolean;
//   DifficultyReminded: boolean;
//   playerDeaths: number;
//   playerDeathsInARow: number;
//   playerDeathsInARowFightingLeader: number;
//   dungeonRun: number;
//   // float
//   dungeonRunDuration: number;
//   dungeonVisitedRooms: number[];
//   FollowersRecruitedInNodes: number[];
//   FollowersRecruitedThisNode: number;
//   // float
//   TimeInGame: number;
//   KillsInGame: number;
//   Followers: Follower[];
//   Followers_Dead: Follower[];
//   Followers_Recruit: Follower[];
//   PlayerFoundTrinkets: number[];
//   items: Item[];
//   CultName: string;
//   RecipesDiscovered: number[];
//   PLAYER_BLUE_HEARTS: number;
//   PLAYER_BLACK_HEARTS: number;
//   PLAYER_SPIRIT_HEARTS: number;
//   PLAYER_HEALTH: number;
//   RatauKilled: boolean;
//   DeathCatBeaten: boolean;
//   CurrentDayIndex: number;
//   UnlockedDungeonDoor: number[];
// }

export enum FollowerTrait {
  Ascetic = 49,
}

export const ThoughtSchema = Type.Object({
  ID: Type.Number(),
  Text: Type.String(),
  IsPositive: Type.Boolean(),
});

export const FollowerSchema = Type.Object({
  ID: Type.Integer({ minimum: 1 }),
  XPLevel: Type.Integer({ minimum: 0 }),
  Age: Type.Integer({ minimum: 0 }),
  LifeExpectancy: Type.Integer({ minimum: 0 }),
  DayJoined: Type.Integer({ minimum: 0 }),
  TaxEnforcer: Type.Boolean(),
  FaithEnforcer: Type.Boolean(),
  MemberDuration: Type.Number(),
  SacrificialValue: Type.Number(),
  Outfit: Type.Number(),
  SkinCharacter: Type.Number(),
  Necklace: Type.Number(),
  IsStarving: Type.Boolean(),
  MarriedToLeader: Type.Boolean(),
  Name: Type.String(),
  CursedState: Type.Number(),
  WorkerBeenGivenOrders: Type.Boolean(),
  Thoughts: Type.Array(ThoughtSchema),
  Traits: Type.Array(Type.Enum(FollowerTrait)),
  SkinVariation: Type.Number(),
  Adoration: Type.Number(),
  Faith: Type.Number(),
  Happiness: Type.Number(),
  Illness: Type.Number(),
  Reeducation: Type.Number(),
  Exhaustion: Type.Number(),
  Rest: Type.Number(),
  Starvation: Type.Number(),
  Satiation: Type.Number(),
});

export const ItemSchema = Type.Object({
  type: Type.Number(),
  quantity: Type.Number(),
  QuantityReserved: Type.Number(),
  UnreservedQuantity: Type.Number(),
});

export const SaveFileSchema = Type.Object({
  AllowSaving: Type.Boolean(),
  PauseGameTime: Type.Boolean(),
  GameOverEnabled: Type.Boolean(),
  DisplayGameOverWarning: Type.Boolean(),
  InGameOver: Type.Boolean(),
  GameOver: Type.Boolean(),
  DifficultyChosen: Type.Boolean(),
  DifficultyReminded: Type.Boolean(),
  playerDeaths: Type.Number(),
  playerDeathsInARow: Type.Number(),
  playerDeathsInARowFightingLeader: Type.Number(),
  dungeonRun: Type.Number(),
  dungeonRunDuration: Type.Number(),
  dungeonVisitedRooms: Type.Array(Type.Number()),
  FollowersRecruitedInNodes: Type.Array(Type.Number()),
  FollowersRecruitedThisNode: Type.Number(),
  TimeInGame: Type.Number(),
  KillsInGame: Type.Number(),
  Followers: Type.Array(FollowerSchema),
  Followers_Dead: Type.Array(FollowerSchema),
  Followers_Recruit: Type.Array(FollowerSchema),
  PlayerFoundTrinkets: Type.Array(Type.Number()),
  items: Type.Array(ItemSchema),
  CultName: Type.String(),
  RecipesDiscovered: Type.Array(Type.Number()),
  PLAYER_BLUE_HEARTS: Type.Number(),
  PLAYER_BLACK_HEARTS: Type.Number(),
  PLAYER_SPIRIT_HEARTS: Type.Number(),
  PLAYER_HEALTH: Type.Number(),
  RatauKilled: Type.Boolean(),
  DeathCatBeaten: Type.Boolean(),
  CurrentDayIndex: Type.Number(),
  UnlockedDungeonDoor: Type.Array(Type.Number()),
  CultTraits: Type.Array(Type.Number()),
});

export interface JsonSaveFile extends Static<typeof SaveFileSchema> {

}

export type Follower = Static<typeof FollowerSchema>;
export type Item = Static<typeof ItemSchema>;
export type Thought = Static<typeof ThoughtSchema>;
export type SaveFile = Static<typeof SaveFileSchema>;

