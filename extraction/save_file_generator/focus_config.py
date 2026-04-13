from typing import Dict, Optional, Set


# Class members we actively edit/use in the app.
# Any other MessagePack keys are still preserved through MessagePackObject.unknownKeys.
FOCUSED_CLASS_MEMBERS: Dict[str, Set[str]] = {
    "DataManager": {
        "CultName",
        "CurrentDayIndex",
        "PLAYER_HEALTH",
        "PLAYER_BLUE_HEARTS",
        "PLAYER_BLACK_HEARTS",
        "PLAYER_FIRE_HEARTS",
        "PLAYER_ICE_HEARTS",
        "PLAYER_SPIRIT_HEARTS",
        "DoctrineUnlockedUpgrades",
        "RecipesDiscovered",
        "MAJOR_DLC",
        "Followers",
        "Followers_Recruit",
        "Followers_Dead",
        "Followers_Dead_IDs",
        "FollowerID",
        "CultTraits",
        "PlayerFoundTrinkets",
        "items",
    },
    "FollowerInfo": {
        "ID",
        "_name",
        "XPLevel",
        "Age",
        "LifeExpectancy",
        "FollowerRole",
        "CurrentOverrideTaskType",
        "Location",
        "Adoration",
        "_happiness",
        "_faith",
        "_satiation",
        "_starvation",
        "Clothing",
        "ClothingVariant",
        "SkinColour",
        "SkinName",
        "Traits",
        "LeavingCult",
        "LeftCultDay",
        "TimeOfDeath",
        "HasBeenBuried",
        "DiedOfIllness",
        "DiedOfInjury",
        "DiedOfOldAge",
        "DiedOfStarvation",
        "FrozeToDeath",
        "DiedFromRot",
        "DiedFromTwitchChat",
        "DiedInPrison",
        "DiedFromMurder",
        "DiedFromDeadlyDish",
        "DiedFromMissionary",
        "DiedFromLightning",
        "DiedFromOverheating",
        "BurntToDeath",
    },
}


# Static list fields we still need when a class is focused.
FOCUSED_CLASS_STATIC_LIST_MEMBERS: Dict[str, Set[str]] = {
    "DataManager": {
        "AllTrinkets",
    },
}

_focus_enabled = True


def set_focus_enabled(enabled: bool) -> None:
    global _focus_enabled
    _focus_enabled = enabled


def get_focused_members(class_name: str) -> Optional[Set[str]]:
    if not _focus_enabled:
        return None
    return FOCUSED_CLASS_MEMBERS.get(class_name)


def should_include_member(class_name: str, member_name: str) -> bool:
    allowed = get_focused_members(class_name)
    if allowed is None:
        return True
    return member_name in allowed


def is_focused_class(class_name: str) -> bool:
    return class_name in FOCUSED_CLASS_MEMBERS


def should_include_static_list_member(class_name: str, member_name: str) -> bool:
    if not _focus_enabled:
        return True
    allowed = FOCUSED_CLASS_STATIC_LIST_MEMBERS.get(class_name)
    if allowed is None:
        return True
    return member_name in allowed
