export const necklaceMap = new Map([
  [45, 1],
  [46, 2],
  [47, 3],
  [48, 4],
  [49, 5],
]);
/*
  Rags,
  Sherpa,
  Warrior,
  Follower,
  Custom,
  Worshipper,
  Worker,
  Old,
  Holiday,
  HorseTown,
  Ghost,
*/
export const outfitMap = new Map([
  [0, 'Clothes/Rags'],
  [1, 'Clothes/Sherpa'],
  [2, null],
  [3, null],
  [4, null],
  [5, null],
  [6, null],
  [7, 'Other/Old'],
  [8, 'Clothes/Holiday'],
  [9, 'Other/Ghost'],
]);

/**
 * https://stackoverflow.com/questions/12484386/access-javascript-property-case-insensitively
 * @param object - the object
 * @param key - the key
 * @return value
 */
export const getPropertyCaseInsensitive = <
  T extends any = any,
  TKey extends string = string,
  TDefault extends any = undefined
>(
  object: T,
  key: TKey,
  defaultValue?: TDefault
): TKey extends keyof T ? T[TKey] : TDefault => {
  if (!object) {
    return defaultValue as TDefault as any;
  }

  if (Object.prototype.hasOwnProperty.call(object, key)) {
    return Reflect.get(object, key) as any;
  }

  const asLowercase = key.toLowerCase();
  const keyFound =
    Object.keys(object).find((k: string) => k.toLowerCase() === asLowercase) ??
    key;

  return Reflect.get(object, keyFound) ?? (defaultValue as TDefault as any);
};

/**
 * https://stackoverflow.com/questions/12484386/access-javascript-property-case-insensitively
 * @param object - the object
 * @param key - the key
 * @param value - the value
 */
export const setPropertyCaseInsensitive = <
  T extends object,
  TKey extends string
>(
  object: T,
  key: TKey,
  value: TKey extends keyof T ? T[TKey] : any
): void => {
  if (!object) return undefined;

  let keyFound: string = key;

  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    const asLowercase = key.toLowerCase();
    keyFound =
      Object.keys(object).find(
        (k: string) => k.toLowerCase() === asLowercase
      ) ?? key;
  }

  Reflect.set(object, keyFound, value);
};

export const generateObjectInsensitiveComputed = <
  T extends object = any,
  TKey extends keyof T & string = any
>(
  objFunc: () => T,
  property: TKey
) =>
  computed<T[TKey]>({
    get() {
      return getPropertyCaseInsensitive(objFunc(), property) as T[TKey];
    },
    set(value) {
      setPropertyCaseInsensitive(objFunc(), property as TKey, value as any);
    },
  });

export const constructFollowerPreviewUrl = (
  follower: any,
  headOnly = false,
  isDead = false
): string => {
  const url = new URL(
    `https://cotl.xl0.org/v1/follower/${getPropertyCaseInsensitive(
      follower,
      'SkinName'
    )}`
  );

  url.searchParams.append(
    'colour_set',
    getPropertyCaseInsensitive(follower, 'SkinColour')
  );

  let illnessThreshold = 50;
  if (follower.Traits.includes(16)) illnessThreshold = 75;
  else if (follower.Traits.includes(15)) illnessThreshold = 25;

  const isIll = follower.Illness >= illnessThreshold;
  const isStraving = getPropertyCaseInsensitive(follower, 'Starvation') >= 30;
  const isTired = getPropertyCaseInsensitive(follower, 'Exhaustion') >= 20;
  const isDissenting =
    getPropertyCaseInsensitive(follower, 'DissentDuration') > 0 ||
    getPropertyCaseInsensitive(follower, 'Dissent') >= 80;
  const isAngry = 25 > getPropertyCaseInsensitive(follower, 'Happiness');
  const isVeryAngry = 10 > getPropertyCaseInsensitive(follower, 'Happiness');
  const isBrainwashed =
    getPropertyCaseInsensitive(follower, 'BrainwashDuration') > 0;
  const isOld =
    getPropertyCaseInsensitive(follower, 'OldAge') ||
    getPropertyCaseInsensitive(follower, 'Outfit') === 7;
  const isGhost = getPropertyCaseInsensitive(follower, 'Outfit') === 9;

  if (!isDead) {
    if (isOld) url.searchParams.append('add_skin', 'Other/Old');

    if (isBrainwashed) url.searchParams.append('add_skin', 'Other/Brainwashed');
    else if (isDissenting)
      url.searchParams.append('add_skin', 'Other/Dissenter');
  }

  let animation = '';
  if (headOnly) {
    if (isDead) animation = 'Avatars/avatar-dead';
    else if (isIll) animation = 'Avatars/avatar-sick';
    else if (isStraving) animation = 'Avatars/avatar-sad';
    else if (isTired) animation = 'Avatars/avatar-tired';
    else if (isAngry) animation = 'Avatars/avatar-unhappy';
    else if (isVeryAngry) animation = 'Avatars/avatar-angry';
    else animation = 'Avatars/avatar-normal';
  } else {
    if (isDead) animation = 'dead';
    else if (isGhost) animation = 'Ghost/idle-ghost';
    else if (isIll) animation = 'Sick/idle-sick';
    else if (isStraving) animation = 'Hungry/idle-hungry';
    else if (isTired) animation = 'Fatigued/idle-fatigued';
    else animation = 'idle';
  }
  url.searchParams.append('animation', animation);

  if (headOnly || isDead) {
    url.searchParams.append('start_time', '0');
    url.searchParams.append('format', 'png');
    if (headOnly) url.searchParams.append('only_head', 'true');
  } else {
    url.searchParams.append('format', 'apng');
    url.searchParams.append('fps', '60');
  }

  if (!headOnly) {
    if (
      getPropertyCaseInsensitive(follower, 'Outfit') !== 7 &&
      outfitMap.get(getPropertyCaseInsensitive(follower, 'Outfit')) != null
    )
      url.searchParams.append(
        'add_skin',
        outfitMap.get(getPropertyCaseInsensitive(follower, 'Outfit'))!
      );

    if (getPropertyCaseInsensitive(follower, 'Necklace') > 0)
      url.searchParams.append(
        'add_skin',
        `Necklaces/Necklace_${
          necklaceMap.get(getPropertyCaseInsensitive(follower, 'Necklace')) ?? 0
        }`
      );

    if (getPropertyCaseInsensitive(follower, 'TaxEnforcer'))
      url.searchParams.append('add_skin', 'Hats/Enforcer');

    if (getPropertyCaseInsensitive(follower, 'FaithEnforcer'))
      url.searchParams.append('add_skin', 'Hats/FaithEnforcer');
  }

  return url.toString();
};

type CaseInsensitiveType = object | Array<CaseInsensitiveType>;

function getMapKeyInsensitive(
  map: Map<string, string | null>,
  prop: string,
  obj: any
) {
  const lowerProp = prop.toLowerCase();

  if (!map.has(prop)) {
    map.set(
      lowerProp,
      Object.keys(obj).find((k) => k.toLowerCase() === lowerProp) ?? null
    );
  }

  return map.get(lowerProp) ?? prop;
}

export function makeCaseInsensitiveObject<T extends CaseInsensitiveType>(
  object: T
): T {
  if (Array.isArray(object)) {
    return object.map((item) => makeCaseInsensitiveObject(item)) as T;
  }

  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      if (typeof object[key] === 'object' && object[key] !== null) {
        object[key] = makeCaseInsensitiveObject(object[key]);
      }
    }
  }

  const map = new Map<string, string | null>();

  return new Proxy(object, {
    get(target, prop, _) {
      if (typeof prop === 'string') {
        prop = getMapKeyInsensitive(map, prop, target);
      }

      return Reflect.get(target, prop);
    },
    set(target, prop, value, _) {
      if (typeof prop === 'string') {
        prop = getMapKeyInsensitive(map, prop, target);
      }

      if (typeof value === 'object' && value !== null) {
        value = makeCaseInsensitiveObject(value);
      }

      return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
      return Reflect.deleteProperty(
        target,
        typeof prop === 'symbol'
          ? prop
          : getMapKeyInsensitive(map, prop, target)
      );
    },
    has(target, prop) {
      return Reflect.has(
        target,
        typeof prop === 'symbol'
          ? prop
          : getMapKeyInsensitive(map, prop, target)
      );
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).map((key) =>
        typeof key === 'symbol' ? key : getMapKeyInsensitive(map, key, target)
      );
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(
        target,
        typeof prop === 'symbol'
          ? prop
          : getMapKeyInsensitive(map, prop, target)
      );
    },
  });
}
