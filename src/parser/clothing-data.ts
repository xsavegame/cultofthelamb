export interface UnityPPtr {
  fileId: number;
  pathId: bigint;
}

export interface UnityColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ClothingSlotAndColor {
  Slot: string;
  color: UnityColor;
}

export interface ClothingSlotsAndColours {
  SlotAndColours: ClothingSlotAndColor[];
  AllColor: UnityColor;
}

export interface ClothingMealEffect {
  MealEffectType: number;
  Chance: number;
}

export interface ClothingMonoBehaviourHeader {
  m_GameObject: UnityPPtr;
  m_Enabled: boolean;
  m_Script: UnityPPtr;
  m_Name: string;
}

export interface ClothingDataFile {
  header: ClothingMonoBehaviourHeader;
  SkeletonData: UnityPPtr;
  ClothingType: number;
  ProtectionType: number;
  ForSale: boolean;
  SpecialClothing: boolean;
  IsSecret: boolean;
  IsDLC: boolean;
  IsMajorDLC: boolean;
  IsHeretic: boolean;
  IsCultist: boolean;
  IsSinful: boolean;
  IsPilgrim: boolean;
  HideOnTailorMenu: boolean;
  CanBeCrafted: boolean;
  Effects: ClothingMealEffect[];
  Variants: string[];
  SlotAndColours: ClothingSlotsAndColours[];
}

class BinaryReader {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly decoder = new TextDecoder();
  private _offset = 0;

  constructor(input: ArrayBuffer | Uint8Array) {
    this.bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    this.view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength,
    );
  }

  get offset(): number {
    return this._offset;
  }

  get length(): number {
    return this.bytes.length;
  }

  readUint8(): number {
    this.ensure(1);
    const value = this.view.getUint8(this._offset);
    this._offset += 1;
    return value;
  }

  readInt32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return value;
  }

  readBigInt64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this._offset, true);
    this._offset += 8;
    return value;
  }

  readFloat32(): number {
    this.ensure(4);
    const value = this.view.getFloat32(this._offset, true);
    this._offset += 4;
    return value;
  }

  align4(): void {
    this._offset = (this._offset + 3) & ~3;
    if (this._offset > this.length) {
      throw new Error(`Invalid 4-byte alignment at offset ${this._offset}`);
    }
  }

  readUnityString(): string {
    const length = this.readInt32();
    if (length < 0) {
      throw new Error(
        `Invalid Unity string length ${length} at offset ${this._offset - 4}`,
      );
    }

    this.ensure(length);
    const value = this.decoder.decode(
      this.bytes.subarray(this._offset, this._offset + length),
    );
    this._offset += length;
    this.align4();
    return value;
  }

  readUnityBool(): boolean {
    const value = this.readUint8() !== 0;
    this.align4();
    return value;
  }

  readPPtr(): UnityPPtr {
    return {
      fileId: this.readInt32(),
      pathId: this.readBigInt64(),
    };
  }

  private ensure(size: number): void {
    if (this._offset + size > this.length) {
      throw new Error(
        `Unexpected EOF at offset ${this._offset}: need ${size} bytes, length=${this.length}`,
      );
    }
  }
}

function readColor(reader: BinaryReader): UnityColor {
  return {
    r: reader.readFloat32(),
    g: reader.readFloat32(),
    b: reader.readFloat32(),
    a: reader.readFloat32(),
  };
}

function readSlotAndColor(reader: BinaryReader): ClothingSlotAndColor {
  return {
    Slot: reader.readUnityString(),
    color: readColor(reader),
  };
}

function readSlotsAndColours(reader: BinaryReader): ClothingSlotsAndColours {
  const count = reader.readInt32();
  if (count < 0) {
    throw new Error(
      `Invalid SlotAndColours count ${count} at offset ${reader.offset - 4}`,
    );
  }

  const slots: ClothingSlotAndColor[] = [];
  for (let i = 0; i < count; i += 1) {
    slots.push(readSlotAndColor(reader));
  }

  return {
    SlotAndColours: slots,
    AllColor: readColor(reader),
  };
}

function readMealEffect(reader: BinaryReader): ClothingMealEffect {
  return {
    MealEffectType: reader.readInt32(),
    Chance: reader.readInt32(),
  };
}

function readStringArray(reader: BinaryReader, label: string): string[] {
  const count = reader.readInt32();
  if (count < 0) {
    throw new Error(
      `Invalid ${label} count ${count} at offset ${reader.offset - 4}`,
    );
  }

  const values: string[] = [];
  for (let i = 0; i < count; i += 1) {
    values.push(reader.readUnityString());
  }
  return values;
}

export function parseClothingDataBinary(
  input: ArrayBuffer | Uint8Array,
): ClothingDataFile {
  const reader = new BinaryReader(input);

  const header: ClothingMonoBehaviourHeader = {
    m_GameObject: reader.readPPtr(),
    m_Enabled: reader.readUnityBool(),
    m_Script: reader.readPPtr(),
    m_Name: reader.readUnityString(),
  };

  const skeletonData = reader.readPPtr();
  const clothingType = reader.readInt32();
  const protectionType = reader.readInt32();

  const forSale = reader.readUnityBool();
  const specialClothing = reader.readUnityBool();
  const isSecret = reader.readUnityBool();
  const isDLC = reader.readUnityBool();
  const isMajorDLC = reader.readUnityBool();
  const isHeretic = reader.readUnityBool();
  const isCultist = reader.readUnityBool();
  const isSinful = reader.readUnityBool();
  const isPilgrim = reader.readUnityBool();
  const hideOnTailorMenu = reader.readUnityBool();
  const canBeCrafted = reader.readUnityBool();

  const effectsCount = reader.readInt32();
  if (effectsCount < 0) {
    throw new Error(
      `Invalid Effects count ${effectsCount} at offset ${reader.offset - 4}`,
    );
  }
  const effects: ClothingMealEffect[] = [];
  for (let i = 0; i < effectsCount; i += 1) {
    effects.push(readMealEffect(reader));
  }

  const variants = readStringArray(reader, "Variants");

  const slotAndColoursCount = reader.readInt32();
  if (slotAndColoursCount < 0) {
    throw new Error(
      `Invalid SlotAndColours count ${slotAndColoursCount} at offset ${reader.offset - 4}`,
    );
  }
  const slotAndColours: ClothingSlotsAndColours[] = [];
  for (let i = 0; i < slotAndColoursCount; i += 1) {
    slotAndColours.push(readSlotsAndColours(reader));
  }

  if (reader.offset !== reader.length) {
    throw new Error(
      `Unexpected trailing bytes while parsing clothing data: offset=${reader.offset}, length=${reader.length}`,
    );
  }

  return {
    header,
    SkeletonData: skeletonData,
    ClothingType: clothingType,
    ProtectionType: protectionType,
    ForSale: forSale,
    SpecialClothing: specialClothing,
    IsSecret: isSecret,
    IsDLC: isDLC,
    IsMajorDLC: isMajorDLC,
    IsHeretic: isHeretic,
    IsCultist: isCultist,
    IsSinful: isSinful,
    IsPilgrim: isPilgrim,
    HideOnTailorMenu: hideOnTailorMenu,
    CanBeCrafted: canBeCrafted,
    Effects: effects,
    Variants: variants,
    SlotAndColours: slotAndColours,
  };
}

const clothingDataUrlLoaders = import.meta.glob(
  "./../generated/data/clothing/*.dat",
  {
    query: "?url&no-inline",
    import: "default",
  },
) as Record<string, () => Promise<string>>;

function modulePathToEntryName(modulePath: string): string {
  const normalized = modulePath.replaceAll("\\", "/");
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return filename.replace(/\.dat$/i, "");
}

let urlMapCachePromise: Promise<Record<string, string>> | null = null;
let binaryMapCachePromise: Promise<Record<string, ArrayBuffer>> | null = null;
let parsedMapCachePromise: Promise<Record<string, ClothingDataFile>> | null =
  null;

export async function getClothingDataUrls(): Promise<Record<string, string>> {
  if (urlMapCachePromise) {
    return urlMapCachePromise;
  }

  urlMapCachePromise = Promise.all(
    Object.entries(clothingDataUrlLoaders).map(async ([modulePath, importer]) => {
      const name = modulePathToEntryName(modulePath);
      const url = await importer();
      return [name, url] as const;
    }),
  ).then((pairs) => {
    pairs.sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(pairs);
  });

  return urlMapCachePromise;
}

export async function loadClothingDataBinaryMap(): Promise<
  Record<string, ArrayBuffer>
> {
  if (binaryMapCachePromise) {
    return binaryMapCachePromise;
  }

  binaryMapCachePromise = getClothingDataUrls().then(async (urlMap) => {
    const entries = await Promise.all(
      Object.entries(urlMap).map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to load clothing data ${name}.dat (${response.status} ${response.statusText})`,
          );
        }
        return [name, await response.arrayBuffer()] as const;
      }),
    );
    return Object.fromEntries(entries);
  });

  return binaryMapCachePromise;
}

export async function loadClothingDataMap(): Promise<
  Record<string, ClothingDataFile>
> {
  if (parsedMapCachePromise) {
    return parsedMapCachePromise;
  }

  parsedMapCachePromise = loadClothingDataBinaryMap().then((binaryMap) => {
    const parsedEntries = Object.entries(binaryMap).map(([name, buffer]) => [
      name,
      parseClothingDataBinary(buffer),
    ] as const);
    parsedEntries.sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(parsedEntries);
  });

  return parsedMapCachePromise;
}

export async function loadClothingData(name: string): Promise<ClothingDataFile> {
  const map = await loadClothingDataMap();
  const entry = map[name];
  if (!entry) {
    const availableNames = Object.keys(map).sort().join(", ");
    throw new Error(
      `Clothing data \"${name}\" not found. Available entries: ${availableNames}`,
    );
  }
  return entry;
}
