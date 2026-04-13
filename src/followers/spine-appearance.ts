import type {
  FollowerAppearanceCatalog,
  FollowerAppearanceClothingOption,
  FollowerAppearanceFormOption,
} from '@/followers/appearance-catalog';
import type { FollowerAppearanceDraft } from '@/types/follower';
import { type Skeleton, Skin, type Spine } from '@pixi-spine/all-3.8';

export type FollowerSpineFitOptions = {
  targetWidthRatio?: number;
  targetHeightRatio?: number;
  anchorX?: number;
  anchorY?: number;
  fallbackY?: number;
};

type SlotAndColorEntry = {
  Slot: string;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
};

type SlotAndColorSet = {
  SlotAndColours: SlotAndColorEntry[];
};

export const DEFAULT_FOLLOWER_ANIMATION_NAMES = [
  'idle',
  'Idle',
  'worship',
  'Worship',
] as const;

const DEFAULT_FOLLOWER_FIT_OPTIONS: Required<FollowerSpineFitOptions> = {
  targetWidthRatio: 0.84,
  targetHeightRatio: 0.9,
  anchorX: 0.5,
  anchorY: 0.56,
  fallbackY: 0.65,
};

export function clampFollowerIndex(value: number, count: number): number {
  if (!Number.isFinite(value) || count <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(value), 0), count - 1);
}

function getFormOption(
  catalog: FollowerAppearanceCatalog,
  appearance: FollowerAppearanceDraft,
): FollowerAppearanceFormOption | null {
  return (
    catalog.formBySkin.get(appearance.AppearanceSkin) ??
    catalog.formBySkin.get(catalog.defaultSkin) ??
    null
  );
}

function getClothingOption(
  catalog: FollowerAppearanceCatalog,
  appearance: FollowerAppearanceDraft,
): FollowerAppearanceClothingOption | null {
  return (
    catalog.clothingByType.get(appearance.AppearanceClothingType) ??
    catalog.clothingByType.get(catalog.defaultClothingType) ??
    null
  );
}

export function normalizeFollowerAppearance(
  catalog: FollowerAppearanceCatalog,
  appearance: FollowerAppearanceDraft,
): FollowerAppearanceDraft {
  const formOption = getFormOption(catalog, appearance);
  const clothingOption = getClothingOption(catalog, appearance);

  return {
    AppearanceSkin: formOption?.skin ?? catalog.defaultSkin,
    AppearanceClothingType:
      clothingOption?.clothingType ?? catalog.defaultClothingType,
    AppearanceClothingVariantIndex: clampFollowerIndex(
      appearance.AppearanceClothingVariantIndex,
      clothingOption?.variantSkins.length ?? 1,
    ),
    AppearanceFormColorIndex: clampFollowerIndex(
      appearance.AppearanceFormColorIndex,
      formOption?.colorSets.length ?? 1,
    ),
    AppearanceClothingColorIndex: clampFollowerIndex(
      appearance.AppearanceClothingColorIndex,
      clothingOption?.colorSets.length ?? 1,
    ),
  };
}

function getClothingSkinVariant(
  catalog: FollowerAppearanceCatalog,
  appearance: FollowerAppearanceDraft,
): string | null {
  const clothingOption = getClothingOption(catalog, appearance);
  if (!clothingOption || clothingOption.variantSkins.length === 0) {
    return null;
  }

  return (
    clothingOption.variantSkins[
      clampFollowerIndex(
        appearance.AppearanceClothingVariantIndex,
        clothingOption.variantSkins.length,
      )
    ] ?? null
  );
}

function applyColorSet(skeleton: Skeleton, slotAndColors: SlotAndColorEntry[]) {
  for (const slotAndColor of slotAndColors) {
    const slot = skeleton.findSlot(slotAndColor.Slot);
    if (!slot) {
      continue;
    }

    slot.color.set(
      slotAndColor.color.r,
      slotAndColor.color.g,
      slotAndColor.color.b,
      slotAndColor.color.a,
    );
  }
}

export function resolveFollowerAnimationName(
  skeleton: Skeleton,
  preferredAnimation: string | null | undefined,
  fallbackAnimations: readonly string[] = DEFAULT_FOLLOWER_ANIMATION_NAMES,
): string | null {
  const availableAnimationNames = skeleton.data.animations.map(
    (animation) => animation.name,
  );
  const preferredAnimationNames = [
    preferredAnimation,
    ...fallbackAnimations,
  ].filter((name): name is string => !!name && name.trim() !== '');

  if (preferredAnimationNames.length === 0) {
    return null;
  }

  return (
    preferredAnimationNames.find((name) =>
      availableAnimationNames.includes(name),
    ) ??
    availableAnimationNames[0] ??
    null
  );
}

export function applyFollowerAppearanceToSpine(
  spine: Spine,
  catalog: FollowerAppearanceCatalog,
  appearance: FollowerAppearanceDraft,
  options?: {
    animation?: string | null;
    fallbackAnimations?: readonly string[];
    loop?: boolean;
  },
): {
  normalizedAppearance: FollowerAppearanceDraft;
  animationName: string | null;
} {
  const normalizedAppearance = normalizeFollowerAppearance(catalog, appearance);
  const skeleton = spine.skeleton;

  const combinedSkin = new Skin('__preview_skin__');
  const formSkin = skeleton.data.findSkin(normalizedAppearance.AppearanceSkin);
  if (formSkin) {
    combinedSkin.addSkin(formSkin);
  }

  const clothingSkinName = getClothingSkinVariant(
    catalog,
    normalizedAppearance,
  );
  if (clothingSkinName) {
    const clothingSkin = skeleton.data.findSkin(clothingSkinName);
    if (clothingSkin) {
      combinedSkin.addSkin(clothingSkin);
    }
  }

  if (combinedSkin.getAttachments().length > 0) {
    skeleton.setSkin(combinedSkin);
  } else if (formSkin) {
    skeleton.setSkin(formSkin);
  } else if (skeleton.data.defaultSkin) {
    skeleton.setSkin(skeleton.data.defaultSkin);
  }

  skeleton.setSlotsToSetupPose();

  const formOption = getFormOption(catalog, normalizedAppearance);
  const formColorSet = formOption?.colorSets[
    clampFollowerIndex(
      normalizedAppearance.AppearanceFormColorIndex,
      formOption?.colorSets.length ?? 1,
    )
  ] as SlotAndColorSet | undefined;
  if (formColorSet) {
    applyColorSet(skeleton, formColorSet.SlotAndColours);
  }

  const clothingOption = getClothingOption(catalog, normalizedAppearance);
  const clothingColorSet = clothingOption?.colorSets[
    clampFollowerIndex(
      normalizedAppearance.AppearanceClothingColorIndex,
      clothingOption?.colorSets.length ?? 1,
    )
  ] as SlotAndColorSet | undefined;
  if (clothingColorSet) {
    applyColorSet(skeleton, clothingColorSet.SlotAndColours);
  }

  const animationName = resolveFollowerAnimationName(
    skeleton,
    options?.animation,
    options?.fallbackAnimations,
  );
  if (animationName) {
    spine.state.setAnimation(0, animationName, options?.loop ?? true);
  } else {
    spine.state.clearTracks();
  }

  spine.state.apply(skeleton);
  skeleton.updateWorldTransform();

  return {
    normalizedAppearance,
    animationName,
  };
}

export function fitFollowerSpineToRenderer(
  spine: Spine,
  width: number,
  height: number,
  options?: FollowerSpineFitOptions,
) {
  if (width <= 0 || height <= 0) {
    return;
  }

  const fitOptions = {
    ...DEFAULT_FOLLOWER_FIT_OPTIONS,
    ...options,
  };

  spine.scale.set(1);
  spine.position.set(0, 0);
  spine.update(0);

  const bounds = spine.getLocalBounds();
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    spine.position.set(
      width * fitOptions.anchorX,
      height * fitOptions.fallbackY,
    );
    return;
  }

  const targetWidth = width * fitOptions.targetWidthRatio;
  const targetHeight = height * fitOptions.targetHeightRatio;
  const scale = Math.max(
    0.001,
    Math.min(targetWidth / bounds.width, targetHeight / bounds.height),
  );
  const centerX = bounds.x + bounds.width * 0.5;
  const centerY = bounds.y + bounds.height * 0.5;

  spine.scale.set(scale);
  spine.position.set(
    width * fitOptions.anchorX - centerX * scale,
    height * fitOptions.anchorY - centerY * scale,
  );
}
