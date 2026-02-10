import { decode, encode, ExtData } from '@msgpack/msgpack';
import {
  DM_KEY_TO_NAME, DM_NAME_TO_KEY, DM_MAX_KEY,
  FI_KEY_TO_NAME, FI_NAME_TO_KEY, FI_MAX_KEY,
  INV_KEY_TO_NAME, INV_NAME_TO_KEY, INV_MAX_KEY,
  TD_KEY_TO_NAME, TD_NAME_TO_KEY, TD_MAX_KEY,
  REL_KEY_TO_NAME, REL_NAME_TO_KEY, REL_MAX_KEY,
  DM_FOLLOWER_LIST_KEYS, DM_ITEM_LIST_KEYS,
  FI_THOUGHT_LIST_KEYS, FI_ITEM_LIST_KEYS, FI_REL_LIST_KEYS,
  DM_FLOAT32_KEYS, FI_FLOAT32_KEYS,
} from './mp-field-map';

// @ts-ignore - lz4js has no types
import * as lz4 from 'lz4js';

// --- Custom MsgPack Decoder ---
// Preserves float32 vs float64 distinction for round-trip fidelity

class MpDecoder {
  private data: Uint8Array;
  private pos: number;
  private view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  private u8(): number {
    return this.data[this.pos++];
  }

  private read(n: number): Uint8Array {
    const slice = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  decode(): any {
    const b = this.u8();

    // Positive fixint (0x00-0x7f)
    if (b <= 0x7f) return b;
    // Fixmap (0x80-0x8f)
    if (b >= 0x80 && b <= 0x8f) return this.decodeMap(b - 0x80);
    // Fixarray (0x90-0x9f)
    if (b >= 0x90 && b <= 0x9f) return this.decodeArray(b - 0x90);
    // Fixstr (0xa0-0xbf)
    if (b >= 0xa0 && b <= 0xbf) return this.decodeStr(b - 0xa0);
    // Negative fixint (0xe0-0xff)
    if (b >= 0xe0) return b - 256;

    switch (b) {
      case 0xc0: return null;
      case 0xc1: return null; // "never used" byte, treat as nil
      case 0xc2: return false;
      case 0xc3: return true;

      // bin 8/16/32
      case 0xc4: return this.read(this.u8());
      case 0xc5: return this.read(this.readU16());
      case 0xc6: return this.read(this.readU32());

      // ext 8/16/32
      case 0xc7: { const n = this.u8(); const t = this.u8(); return { _ext: t, _data: this.read(n) }; }
      case 0xc8: { const n = this.readU16(); const t = this.u8(); return { _ext: t, _data: this.read(n) }; }
      case 0xc9: { const n = this.readU32(); const t = this.u8(); return { _ext: t, _data: this.read(n) }; }

      // float 32/64
      case 0xca: {
        const v = this.view.getFloat32(this.pos);
        this.pos += 4;
        return v;
      }
      case 0xcb: {
        const v = this.view.getFloat64(this.pos);
        this.pos += 8;
        return v;
      }

      // uint 8/16/32/64
      case 0xcc: return this.u8();
      case 0xcd: return this.readU16();
      case 0xce: return this.readU32();
      case 0xcf: return this.readU64();

      // int 8/16/32/64
      case 0xd0: return this.readI8();
      case 0xd1: return this.readI16();
      case 0xd2: return this.readI32();
      case 0xd3: return this.readI64();

      // fixext 1/2/4/8/16
      case 0xd4: { const t = this.u8(); return { _ext: t, _data: this.read(1) }; }
      case 0xd5: { const t = this.u8(); return { _ext: t, _data: this.read(2) }; }
      case 0xd6: { const t = this.u8(); return { _ext: t, _data: this.read(4) }; }
      case 0xd7: { const t = this.u8(); return { _ext: t, _data: this.read(8) }; }
      case 0xd8: { const t = this.u8(); return { _ext: t, _data: this.read(16) }; }

      // str 8/16/32
      case 0xd9: return this.decodeStr(this.u8());
      case 0xda: return this.decodeStr(this.readU16());
      case 0xdb: return this.decodeStr(this.readU32());

      // array 16/32
      case 0xdc: return this.decodeArray(this.readU16());
      case 0xdd: return this.decodeArray(this.readU32());

      // map 16/32
      case 0xde: return this.decodeMap(this.readU16());
      case 0xdf: return this.decodeMap(this.readU32());

      default:
        throw new Error(`Unknown msgpack byte 0x${b.toString(16)} at ${this.pos - 1}`);
    }
  }

  private decodeArray(n: number): any[] {
    const arr: any[] = new Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = this.decode();
    }
    return arr;
  }

  private decodeMap(n: number): Record<string, any> {
    const map: Record<string, any> = {};
    for (let i = 0; i < n; i++) {
      const key = this.decode();
      const val = this.decode();
      map[String(key)] = val;
    }
    return map;
  }

  private decodeStr(n: number): string {
    const bytes = this.read(n);
    return new TextDecoder().decode(bytes);
  }

  private readU16(): number {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  private readU32(): number {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  private readU64(): number {
    const hi = this.view.getUint32(this.pos);
    const lo = this.view.getUint32(this.pos + 4);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  private readI8(): number {
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  private readI16(): number {
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  private readI32(): number {
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  private readI64(): number {
    const hi = this.view.getInt32(this.pos);
    const lo = this.view.getUint32(this.pos + 4);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  get position(): number {
    return this.pos;
  }
}

// --- Custom MsgPack Encoder ---

class MpEncoder {
  private buf: number[] = [];

  private writeByte(b: number) {
    this.buf.push(b & 0xff);
  }

  private writeBytes(data: Uint8Array | number[]) {
    for (let i = 0; i < data.length; i++) {
      this.buf.push(data[i]);
    }
  }

  private writeU16(v: number) {
    this.buf.push((v >> 8) & 0xff, v & 0xff);
  }

  private writeU32(v: number) {
    this.buf.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  }

  private writeI32(v: number) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, v);
    const bytes = new Uint8Array(buf);
    this.writeBytes(bytes);
  }

  private writeF32(v: number) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, v);
    const bytes = new Uint8Array(buf);
    this.writeBytes(bytes);
  }

  private writeF64(v: number) {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v);
    const bytes = new Uint8Array(buf);
    this.writeBytes(bytes);
  }

  encodeNil() {
    this.writeByte(0xc0);
  }

  encodeBool(v: boolean) {
    this.writeByte(v ? 0xc3 : 0xc2);
  }

  encodeInt(v: number) {
    if (v >= 0 && v <= 0x7f) {
      this.writeByte(v);
    } else if (v >= -32 && v < 0) {
      this.writeByte(v + 256);
    } else if (v >= 0 && v <= 0xff) {
      this.writeByte(0xcc);
      this.writeByte(v);
    } else if (v >= 0 && v <= 0xffff) {
      this.writeByte(0xcd);
      this.writeU16(v);
    } else if (v >= 0 && v <= 0xffffffff) {
      this.writeByte(0xce);
      this.writeU32(v);
    } else if (v >= -128 && v < 0) {
      this.writeByte(0xd0);
      this.writeByte(v + 256);
    } else if (v >= -32768 && v < 0) {
      this.writeByte(0xd1);
      const buf = new ArrayBuffer(2);
      new DataView(buf).setInt16(0, v);
      this.writeBytes(new Uint8Array(buf));
    } else if (v >= -2147483648 && v < 0) {
      this.writeByte(0xd2);
      this.writeI32(v);
    } else {
      // int64
      this.writeByte(0xd3);
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      // JavaScript can't natively handle 64-bit ints precisely
      // but for game save values this should be fine
      const hi = Math.floor(v / 0x100000000);
      const lo = v >>> 0;
      view.setInt32(0, hi);
      view.setUint32(4, lo);
      this.writeBytes(new Uint8Array(buf));
    }
  }

  encodeFloat32(v: number) {
    this.writeByte(0xca);
    this.writeF32(v);
  }

  encodeFloat64(v: number) {
    this.writeByte(0xcb);
    this.writeF64(v);
  }

  encodeStr(v: string) {
    const encoded = new TextEncoder().encode(v);
    const n = encoded.length;
    if (n <= 31) {
      this.writeByte(0xa0 + n);
    } else if (n <= 0xff) {
      this.writeByte(0xd9);
      this.writeByte(n);
    } else if (n <= 0xffff) {
      this.writeByte(0xda);
      this.writeU16(n);
    } else {
      this.writeByte(0xdb);
      this.writeU32(n);
    }
    this.writeBytes(encoded);
  }

  encodeArrayHeader(n: number) {
    if (n <= 15) {
      this.writeByte(0x90 + n);
    } else if (n <= 0xffff) {
      this.writeByte(0xdc);
      this.writeU16(n);
    } else {
      this.writeByte(0xdd);
      this.writeU32(n);
    }
  }

  encodeMapHeader(n: number) {
    if (n <= 15) {
      this.writeByte(0x80 + n);
    } else if (n <= 0xffff) {
      this.writeByte(0xde);
      this.writeU16(n);
    } else {
      this.writeByte(0xdf);
      this.writeU32(n);
    }
  }

  encodeBin(data: Uint8Array) {
    const n = data.length;
    if (n <= 0xff) {
      this.writeByte(0xc4);
      this.writeByte(n);
    } else if (n <= 0xffff) {
      this.writeByte(0xc5);
      this.writeU16(n);
    } else {
      this.writeByte(0xc6);
      this.writeU32(n);
    }
    this.writeBytes(data);
  }

  encodeExt(type: number, data: Uint8Array) {
    const n = data.length;
    if (n === 1) { this.writeByte(0xd4); }
    else if (n === 2) { this.writeByte(0xd5); }
    else if (n === 4) { this.writeByte(0xd6); }
    else if (n === 8) { this.writeByte(0xd7); }
    else if (n === 16) { this.writeByte(0xd8); }
    else if (n <= 0xff) { this.writeByte(0xc7); this.writeByte(n); }
    else if (n <= 0xffff) { this.writeByte(0xc8); this.writeU16(n); }
    else { this.writeByte(0xc9); this.writeU32(n); }
    this.writeByte(type & 0xff);
    this.writeBytes(data);
  }

  // Encode a value that should be stored as msgpack int or float
  encodeNumber(v: number, useFloat32: boolean) {
    if (useFloat32) {
      this.encodeFloat32(v);
    } else if (Number.isInteger(v) && Number.isSafeInteger(v)) {
      this.encodeInt(v);
    } else {
      this.encodeFloat64(v);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

// --- Array <-> Object Conversion ---

function arrayToObject(
  arr: any[],
  keyToName: Record<number, string>,
): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < arr.length; i++) {
    const name = keyToName[i];
    if (name !== undefined) {
      obj[name] = arr[i];
    }
  }
  return obj;
}

function objectToArray(
  obj: Record<string, any>,
  nameToKey: Record<string, number>,
  maxKey: number,
  originalArray?: any[],
): any[] {
  // Start with original array (preserving unknown fields) or null-filled
  const arr: any[] = originalArray
    ? [...originalArray]
    : new Array(maxKey + 1).fill(null);

  for (const [name, key] of Object.entries(nameToKey)) {
    if (name in obj) {
      arr[key] = obj[name];
    }
  }
  return arr;
}

// Convert a follower from MP array to JSON-like object
function followerArrayToObject(arr: any[]): Record<string, any> {
  const obj = arrayToObject(arr, FI_KEY_TO_NAME);

  // Convert nested Thoughts from arrays to objects
  if (Array.isArray(obj.Thoughts)) {
    obj.Thoughts = obj.Thoughts.map((t: any) =>
      Array.isArray(t) ? arrayToObject(t, TD_KEY_TO_NAME) : t
    );
  }

  // Convert nested Inventory items
  if (Array.isArray(obj.Inventory)) {
    obj.Inventory = obj.Inventory.map((item: any) =>
      Array.isArray(item) ? arrayToObject(item, INV_KEY_TO_NAME) : item
    );
  }

  // Convert nested MissionaryRewards
  if (Array.isArray(obj.MissionaryRewards)) {
    obj.MissionaryRewards = obj.MissionaryRewards.map((item: any) =>
      Array.isArray(item) ? arrayToObject(item, INV_KEY_TO_NAME) : item
    );
  }

  // Convert Relationships
  if (Array.isArray(obj.Relationships)) {
    obj.Relationships = obj.Relationships.map((r: any) =>
      Array.isArray(r) ? arrayToObject(r, REL_KEY_TO_NAME) : r
    );
  }

  return obj;
}

// Convert a follower from JSON-like object back to MP array
function followerObjectToArray(obj: Record<string, any>, original?: any[]): any[] {
  const converted = { ...obj };

  // Helper: get original nested array for a follower field index
  const getOrigNested = (fieldKey: number, idx: number): any[] | undefined => {
    if (!original) return undefined;
    const list = original[fieldKey];
    return Array.isArray(list) && Array.isArray(list[idx]) ? list[idx] : undefined;
  };

  const thoughtsKey = FI_NAME_TO_KEY['Thoughts']; // 70
  const inventoryKey = FI_NAME_TO_KEY['Inventory'];
  const missionaryKey = FI_NAME_TO_KEY['MissionaryRewards'];
  const relKey = FI_NAME_TO_KEY['Relationships'];

  if (Array.isArray(converted.Thoughts)) {
    const origThoughts = original ? original[thoughtsKey] : undefined;
    converted.Thoughts = converted.Thoughts.map((t: any, i: number) => {
      if (!Array.isArray(t) && typeof t === 'object' && t !== null) {
        const origT = Array.isArray(origThoughts) ? origThoughts[i] : undefined;
        return objectToArray(t, TD_NAME_TO_KEY, TD_MAX_KEY, origT);
      }
      return t;
    });
  }

  if (Array.isArray(converted.Inventory)) {
    const origInv = original ? original[inventoryKey] : undefined;
    converted.Inventory = converted.Inventory.map((item: any, i: number) => {
      if (!Array.isArray(item) && typeof item === 'object' && item !== null) {
        const origItem = Array.isArray(origInv) ? origInv[i] : undefined;
        return objectToArray(item, INV_NAME_TO_KEY, INV_MAX_KEY, origItem);
      }
      return item;
    });
  }

  if (Array.isArray(converted.MissionaryRewards)) {
    const origMR = original ? original[missionaryKey] : undefined;
    converted.MissionaryRewards = converted.MissionaryRewards.map((item: any, i: number) => {
      if (!Array.isArray(item) && typeof item === 'object' && item !== null) {
        const origItem = Array.isArray(origMR) ? origMR[i] : undefined;
        return objectToArray(item, INV_NAME_TO_KEY, INV_MAX_KEY, origItem);
      }
      return item;
    });
  }

  if (Array.isArray(converted.Relationships)) {
    const origRels = original ? original[relKey] : undefined;
    converted.Relationships = converted.Relationships.map((r: any, i: number) => {
      if (!Array.isArray(r) && typeof r === 'object' && r !== null) {
        const origR = Array.isArray(origRels) ? origRels[i] : undefined;
        return objectToArray(r, REL_NAME_TO_KEY, REL_MAX_KEY, origR);
      }
      return r;
    });
  }

  return objectToArray(converted, FI_NAME_TO_KEY, FI_MAX_KEY, original);
}

// --- LZ4 Block Compression ---

function lz4DecompressBlock(src: Uint8Array, uncompressedSize: number): Uint8Array {
  const dst = new Uint8Array(uncompressedSize);
  lz4.decompressBlock(src, dst, 0, src.length, 0);
  return dst;
}

function lz4CompressBlock(src: Uint8Array): Uint8Array {
  const bound = lz4.compressBound(src.length);
  const dst = new Uint8Array(bound);
  const hashTable = new Uint32Array(65536);
  const compressedSize = lz4.compressBlock(src, dst, 0, src.length, hashTable);
  return dst.subarray(0, compressedSize);
}

// --- Main Decode/Encode Functions ---

// The MP save structure after decryption:
// - Outer: standard msgpack array [ext(98), blob1, blob2, ...]
// - ext(98) header contains uncompressed sizes for each LZ4 block
// - Each blob is LZ4-compressed msgpack data
// - Concatenated decompressed data = single array16(1395) = DataManager state

export function decodeMpSave(decrypted: Uint8Array): { data: Record<string, any>; rawArray: any[]; outerStructure: any } {
  // Step 1: Outer msgpack unpack
  const outer = decode(decrypted) as any[];

  // Step 2: Parse ext(98) header for uncompressed sizes
  const extHeader = outer[0] as ExtData;
  const headerData = typeof extHeader.data === 'function'
    ? extHeader.data(0)
    : extHeader.data instanceof Uint8Array
      ? extHeader.data
      : new Uint8Array(extHeader.data as any);
  const headerDecoder = new MpDecoder(headerData);
  const sizes: number[] = [];
  while (headerDecoder.position < headerData.length) {
    sizes.push(headerDecoder.decode());
  }

  // Step 3: LZ4 decompress each block
  const blobs: Uint8Array[] = [];
  for (let i = 1; i < outer.length; i++) {
    blobs.push(outer[i] instanceof Uint8Array ? outer[i] : new Uint8Array(outer[i]));
  }

  const decompressed: Uint8Array[] = [];
  for (let i = 0; i < sizes.length; i++) {
    decompressed.push(lz4DecompressBlock(blobs[i], sizes[i]));
  }

  // Step 4: Concatenate
  const totalSize = decompressed.reduce((sum, b) => sum + b.length, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const block of decompressed) {
    combined.set(block, offset);
    offset += block.length;
  }

  // Step 5: Decode inner msgpack (the DataManager array)
  const innerDecoder = new MpDecoder(combined);
  const rawArray = innerDecoder.decode() as any[];

  // Step 6: Convert array to JSON-like object
  const data = mpArrayToJsonObject(rawArray);

  return { data, rawArray, outerStructure: { sizes, blockCount: blobs.length } };
}

export function encodeMpSave(data: Record<string, any>, originalRawArray?: any[]): Uint8Array {
  // Step 1: Convert JSON-like object back to array
  const rawArray = jsonObjectToMpArray(data, originalRawArray);

  // Step 2: Encode inner msgpack
  const innerBytes = encodeDataManagerArray(rawArray);

  // Step 3: Split into LZ4 blocks
  // MessagePack-CSharp uses ~32KB blocks (MaxBlockSize = 32 * 1024 = 32768)
  const MAX_BLOCK_SIZE = 32768;
  const blocks: Uint8Array[] = [];
  const sizes: number[] = [];
  let pos = 0;

  while (pos < innerBytes.length) {
    const blockSize = Math.min(MAX_BLOCK_SIZE, innerBytes.length - pos);
    const block = innerBytes.subarray(pos, pos + blockSize);
    blocks.push(block);
    sizes.push(blockSize);
    pos += blockSize;
  }

  // Step 4: LZ4 compress each block
  const compressedBlocks: Uint8Array[] = [];
  for (const block of blocks) {
    compressedBlocks.push(lz4CompressBlock(block));
  }

  // Step 5: Encode ext(98) header with uncompressed sizes
  const headerEncoder = new MpEncoder();
  for (const size of sizes) {
    headerEncoder.encodeInt(size);
  }
  const headerBytes = headerEncoder.toUint8Array();
  const extHeader = new ExtData(98, headerBytes);

  // Step 6: Pack outer structure
  const outerArray: any[] = [extHeader, ...compressedBlocks];
  return encode(outerArray) as Uint8Array;
}

// Convert MP raw array (1395 elements) to JSON-like object with field names
function mpArrayToJsonObject(rawArray: any[]): Record<string, any> {
  const obj = arrayToObject(rawArray, DM_KEY_TO_NAME);

  // Convert follower lists from arrays-of-arrays to arrays-of-objects
  for (const key of DM_FOLLOWER_LIST_KEYS) {
    const name = DM_KEY_TO_NAME[key];
    if (name && Array.isArray(obj[name])) {
      obj[name] = obj[name].map((f: any) =>
        Array.isArray(f) ? followerArrayToObject(f) : f
      );
    }
  }

  // Convert single FollowerInfo fields (like FollowerForSale, MidasFollowerInfo)
  const singleFollowerKeys = [493, 1199]; // MidasFollowerInfo, FollowerForSale
  for (const key of singleFollowerKeys) {
    const name = DM_KEY_TO_NAME[key];
    if (name && Array.isArray(obj[name])) {
      obj[name] = followerArrayToObject(obj[name]);
    }
  }

  // Convert item lists from arrays-of-arrays to arrays-of-objects
  for (const key of DM_ITEM_LIST_KEYS) {
    const name = DM_KEY_TO_NAME[key];
    if (name && Array.isArray(obj[name])) {
      obj[name] = obj[name].map((item: any) =>
        Array.isArray(item) ? arrayToObject(item, INV_KEY_TO_NAME) : item
      );
    }
  }

  return obj;
}

// Convert JSON-like object back to MP array (1395 elements)
function jsonObjectToMpArray(obj: Record<string, any>, originalArray?: any[]): any[] {
  const converted = { ...obj };

  // Convert follower lists back
  for (const key of DM_FOLLOWER_LIST_KEYS) {
    const name = DM_KEY_TO_NAME[key];
    if (name && Array.isArray(converted[name])) {
      const origFollowers = originalArray ? originalArray[key] : undefined;
      converted[name] = converted[name].map((f: any, i: number) => {
        if (Array.isArray(f)) return f; // already an array
        if (typeof f === 'object' && f !== null) {
          const origFollower = Array.isArray(origFollowers) ? origFollowers[i] : undefined;
          return followerObjectToArray(f, origFollower);
        }
        return f;
      });
    }
  }

  // Convert single FollowerInfo fields back
  const singleFollowerKeys = [493, 1199];
  for (const key of singleFollowerKeys) {
    const name = DM_KEY_TO_NAME[key];
    if (name && converted[name] && typeof converted[name] === 'object' && !Array.isArray(converted[name])) {
      const orig = originalArray ? originalArray[key] : undefined;
      converted[name] = followerObjectToArray(converted[name], orig);
    }
  }

  // Convert item lists back
  for (const key of DM_ITEM_LIST_KEYS) {
    const name = DM_KEY_TO_NAME[key];
    if (name && Array.isArray(converted[name])) {
      converted[name] = converted[name].map((item: any) => {
        if (Array.isArray(item)) return item;
        if (typeof item === 'object' && item !== null) {
          return objectToArray(item, INV_NAME_TO_KEY, INV_MAX_KEY);
        }
        return item;
      });
    }
  }

  return objectToArray(converted, DM_NAME_TO_KEY, DM_MAX_KEY, originalArray);
}

// Encode a DataManager array to msgpack bytes
// Uses float32 for fields that are C# float, float64 for double
function encodeDataManagerArray(arr: any[]): Uint8Array {
  const enc = new MpEncoder();
  enc.encodeArrayHeader(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (DM_FOLLOWER_LIST_KEYS.has(i) && Array.isArray(arr[i])) {
      encodeFollowerList(enc, arr[i]);
    } else if (DM_ITEM_LIST_KEYS.has(i) && Array.isArray(arr[i])) {
      encodeItemList(enc, arr[i]);
    } else if ((i === 493 || i === 1199) && Array.isArray(arr[i])) {
      // Single FollowerInfo fields (MidasFollowerInfo, FollowerForSale)
      encodeFollowerArray(enc, arr[i]);
    } else {
      encodeValue(enc, arr[i], DM_FLOAT32_KEYS.has(i));
    }
  }
  return enc.toUint8Array();
}

function encodeFollowerList(enc: MpEncoder, list: any[]): void {
  enc.encodeArrayHeader(list.length);
  for (const follower of list) {
    if (Array.isArray(follower)) {
      encodeFollowerArray(enc, follower);
    } else {
      encodeValue(enc, follower);
    }
  }
}

function encodeFollowerArray(enc: MpEncoder, arr: any[]): void {
  enc.encodeArrayHeader(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (FI_THOUGHT_LIST_KEYS.has(i) && Array.isArray(arr[i])) {
      enc.encodeArrayHeader(arr[i].length);
      for (const t of arr[i]) {
        if (Array.isArray(t)) {
          encodeGenericArray(enc, t);
        } else {
          encodeValue(enc, t);
        }
      }
    } else if ((FI_ITEM_LIST_KEYS.has(i)) && Array.isArray(arr[i])) {
      encodeItemList(enc, arr[i]);
    } else if (FI_REL_LIST_KEYS.has(i) && Array.isArray(arr[i])) {
      enc.encodeArrayHeader(arr[i].length);
      for (const r of arr[i]) {
        if (Array.isArray(r)) {
          encodeGenericArray(enc, r);
        } else {
          encodeValue(enc, r);
        }
      }
    } else {
      encodeValue(enc, arr[i], FI_FLOAT32_KEYS.has(i));
    }
  }
}

function encodeItemList(enc: MpEncoder, list: any[]): void {
  enc.encodeArrayHeader(list.length);
  for (const item of list) {
    if (Array.isArray(item)) {
      encodeGenericArray(enc, item);
    } else {
      encodeValue(enc, item);
    }
  }
}

function encodeGenericArray(enc: MpEncoder, arr: any[]): void {
  enc.encodeArrayHeader(arr.length);
  for (const v of arr) {
    encodeValue(enc, v);
  }
}

function encodeValue(enc: MpEncoder, v: any, useFloat32 = false): void {
  if (v === null || v === undefined) {
    enc.encodeNil();
  } else if (typeof v === 'boolean') {
    enc.encodeBool(v);
  } else if (typeof v === 'number') {
    enc.encodeNumber(v, useFloat32);
  } else if (typeof v === 'string') {
    enc.encodeStr(v);
  } else if (v instanceof Uint8Array) {
    enc.encodeBin(v);
  } else if (Array.isArray(v)) {
    enc.encodeArrayHeader(v.length);
    for (const item of v) {
      encodeValue(enc, item);
    }
  } else if (typeof v === 'object') {
    if ('_ext' in v && '_data' in v) {
      const data = v._data instanceof Uint8Array ? v._data : new Uint8Array(v._data);
      enc.encodeExt(v._ext, data);
    } else {
      const keys = Object.keys(v);
      enc.encodeMapHeader(keys.length);
      for (const key of keys) {
        enc.encodeStr(key);
        encodeValue(enc, v[key]);
      }
    }
  } else {
    enc.encodeNil();
  }
}

// --- Detection ---

export function isMpFormat(data: Uint8Array): boolean {
  // After decryption, MP saves start with a msgpack array containing ext(98)
  // JSON saves start with '{' (0x7b)
  // Check the first non-encryption byte
  let start = 0;
  if (data[0] === 0x45) {
    // Encrypted - can't easily check without decrypting
    // Use file extension instead (handled by caller)
    return false;
  }

  const firstByte = data[start];
  // JSON starts with '{' (0x7b) or whitespace
  if (firstByte === 0x7b || firstByte === 0x20 || firstByte === 0x0a || firstByte === 0x0d) {
    return false;
  }

  // MP format: outer msgpack should start with an array header
  // fixarray: 0x90-0x9f, array16: 0xdc, array32: 0xdd
  return (firstByte >= 0x90 && firstByte <= 0x9f) || firstByte === 0xdc || firstByte === 0xdd;
}

// Check if decrypted data is MP (not JSON)
export function isDecryptedMp(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  const firstByte = data[0];
  // JSON starts with '{' (0x7b)
  if (firstByte === 0x7b) return false;
  // MP outer structure is a msgpack array
  return (firstByte >= 0x90 && firstByte <= 0x9f) || firstByte === 0xdc || firstByte === 0xdd;
}
