import worshipperDataUrl from './../generated/data/Worshipper_Data.dat?url&no-inline';

export enum WorshipperDropLocation {
  Dungeon1 = 0,
  Dungeon2 = 1,
  Dungeon3 = 2,
  Dungeon4 = 3,
  Other = 4,
  DLC = 5,
  SpecialEvents = 6,
  Major_DLC = 7,
  Dungeon5 = 8,
  Dungeon6 = 9,
}

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

export interface WorshipperSlotAndColor {
  Slot: string;
  color: UnityColor;
}

export interface WorshipperSlotsAndColours {
  SlotAndColours: WorshipperSlotAndColor[];
  AllColor: UnityColor;
}

export interface WorshipperCharacterSkin {
  Skin: string;
}

export interface WorshipperSkinAndData {
  Title: string;
  DropLocation: WorshipperDropLocation;
  Hidden: boolean;
  Invariant: boolean;
  LockColor: boolean;
  TwitchPremium: boolean;
  Skin: WorshipperCharacterSkin[];
  SlotAndColours: WorshipperSlotsAndColours[];
}

export interface WorshipperMonoBehaviourHeader {
  m_GameObject: UnityPPtr;
  m_Enabled: boolean;
  m_Script: UnityPPtr;
  m_Name: string;
}

export interface WorshipperDataFile {
  header: WorshipperMonoBehaviourHeader;
  SkeletonData: UnityPPtr;
  GlobalColourList: WorshipperSlotsAndColours[];
  Characters: WorshipperSkinAndData[];
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

function readSlotAndColor(reader: BinaryReader): WorshipperSlotAndColor {
  return {
    Slot: reader.readUnityString(),
    color: readColor(reader),
  };
}

function readSlotsAndColours(reader: BinaryReader): WorshipperSlotsAndColours {
  const count = reader.readInt32();
  if (count < 0) {
    throw new Error(
      `Invalid SlotAndColours count ${count} at offset ${reader.offset - 4}`,
    );
  }

  const slots: WorshipperSlotAndColor[] = [];
  for (let i = 0; i < count; i += 1) {
    slots.push(readSlotAndColor(reader));
  }

  return {
    SlotAndColours: slots,
    AllColor: readColor(reader),
  };
}

function readCharacterSkin(reader: BinaryReader): WorshipperCharacterSkin {
  return {
    Skin: reader.readUnityString(),
  };
}

function readSkinAndData(reader: BinaryReader): WorshipperSkinAndData {
  const title = reader.readUnityString();
  const dropLocation = reader.readInt32();
  const hidden = reader.readUnityBool();
  const invariant = reader.readUnityBool();
  const lockColor = reader.readUnityBool();
  const twitchPremium = reader.readUnityBool();

  const skinCount = reader.readInt32();
  if (skinCount < 0) {
    throw new Error(
      `Invalid Skin count ${skinCount} at offset ${reader.offset - 4}`,
    );
  }

  const skins: WorshipperCharacterSkin[] = [];
  for (let i = 0; i < skinCount; i += 1) {
    skins.push(readCharacterSkin(reader));
  }

  const variantCount = reader.readInt32();
  if (variantCount < 0) {
    throw new Error(
      `Invalid SlotAndColours count ${variantCount} at offset ${reader.offset - 4}`,
    );
  }

  const slotAndColours: WorshipperSlotsAndColours[] = [];
  for (let i = 0; i < variantCount; i += 1) {
    slotAndColours.push(readSlotsAndColours(reader));
  }

  return {
    Title: title,
    DropLocation: dropLocation as WorshipperDropLocation,
    Hidden: hidden,
    Invariant: invariant,
    LockColor: lockColor,
    TwitchPremium: twitchPremium,
    Skin: skins,
    SlotAndColours: slotAndColours,
  };
}

export function parseWorshipperDataBinary(
  input: ArrayBuffer | Uint8Array,
): WorshipperDataFile {
  const reader = new BinaryReader(input);

  const header: WorshipperMonoBehaviourHeader = {
    m_GameObject: reader.readPPtr(),
    m_Enabled: reader.readUnityBool(),
    m_Script: reader.readPPtr(),
    m_Name: reader.readUnityString(),
  };

  const skeletonData = reader.readPPtr();

  const globalCount = reader.readInt32();
  if (globalCount < 0) {
    throw new Error(
      `Invalid GlobalColourList count ${globalCount} at offset ${reader.offset - 4}`,
    );
  }
  const globalColourList: WorshipperSlotsAndColours[] = [];
  for (let i = 0; i < globalCount; i += 1) {
    globalColourList.push(readSlotsAndColours(reader));
  }

  const characterCount = reader.readInt32();
  if (characterCount < 0) {
    throw new Error(
      `Invalid Characters count ${characterCount} at offset ${reader.offset - 4}`,
    );
  }
  const characters: WorshipperSkinAndData[] = [];
  for (let i = 0; i < characterCount; i += 1) {
    characters.push(readSkinAndData(reader));
  }

  if (reader.offset !== reader.length) {
    throw new Error(
      `Unexpected trailing bytes while parsing Worshipper_Data.dat: offset=${reader.offset}, length=${reader.length}`,
    );
  }

  return {
    header,
    SkeletonData: skeletonData,
    GlobalColourList: globalColourList,
    Characters: characters,
  };
}

let binaryCachePromise: Promise<ArrayBuffer> | null = null;
let parsedCachePromise: Promise<WorshipperDataFile> | null = null;

export function getWorshipperDataUrl(): string {
  return worshipperDataUrl;
}

export async function loadWorshipperDataBinary(): Promise<ArrayBuffer> {
  if (binaryCachePromise) {
    return binaryCachePromise;
  }

  binaryCachePromise = fetch(worshipperDataUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Failed to load Worshipper_Data.dat (${response.status} ${response.statusText})`,
      );
    }
    return response.arrayBuffer();
  });

  return binaryCachePromise;
}

export async function loadWorshipperData(): Promise<WorshipperDataFile> {
  if (parsedCachePromise) {
    return parsedCachePromise;
  }

  parsedCachePromise = loadWorshipperDataBinary().then((buffer) =>
    parseWorshipperDataBinary(buffer),
  );
  return parsedCachePromise;
}
