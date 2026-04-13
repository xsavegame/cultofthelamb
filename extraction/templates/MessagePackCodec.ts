import * as lz4 from "lz4js";

export type NumericWireKind =
  | "fixpos"
  | "fixneg"
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "f32"
  | "f64";

export type MsgPackWidthMode = "compact" | "preserve";
export type MsgPackTypeMismatchPolicy =
  | "throw"
  | "useDecodedType"
  | "useDeclaredDefault";

export interface MsgPackCodecOptions {
  readonly widthMode?: MsgPackWidthMode;
  readonly typeMismatchPolicy?: MsgPackTypeMismatchPolicy;
}

export interface ResolvedMsgPackCodecOptions {
  readonly widthMode: MsgPackWidthMode;
  readonly typeMismatchPolicy: MsgPackTypeMismatchPolicy;
}

type StrictIntKind = Exclude<NumericWireKind, "f32" | "f64">;
type NumericKindMap = Map<string | number, NumericWireKind>;

const NUMERIC_KIND_META = Symbol("msgpack:numeric-kind");
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

const NUMERIC_LIMITS: Record<StrictIntKind, { min: bigint; max: bigint }> = {
  fixpos: { min: 0n, max: 127n },
  fixneg: { min: -32n, max: -1n },
  u8: { min: 0n, max: 0xffn },
  u16: { min: 0n, max: 0xffffn },
  u32: { min: 0n, max: 0xffff_ffffn },
  u64: { min: 0n, max: 0xffff_ffff_ffff_ffffn },
  i8: { min: -0x80n, max: 0x7fn },
  i16: { min: -0x8000n, max: 0x7fffn },
  i32: { min: -0x8000_0000n, max: 0x7fff_ffffn },
  i64: { min: -0x8000_0000_0000_0000n, max: 0x7fff_ffff_ffff_ffffn },
};

const DEFAULT_CODEC_OPTIONS: ResolvedMsgPackCodecOptions = {
  widthMode: "compact",
  typeMismatchPolicy: "throw",
};

export function resolveMsgPackCodecOptions(
  options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
): ResolvedMsgPackCodecOptions {
  return {
    widthMode: options?.widthMode ?? DEFAULT_CODEC_OPTIONS.widthMode,
    typeMismatchPolicy:
      options?.typeMismatchPolicy ?? DEFAULT_CODEC_OPTIONS.typeMismatchPolicy,
  };
}

function isObjectLike(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function normalizeMetaKey(container: unknown, key: string | number): string | number {
  if (Array.isArray(container)) {
    if (typeof key === "number") {
      return key;
    }

    const n = Number(key);
    if (Number.isInteger(n) && `${n}` === key) {
      return n;
    }
  }

  return typeof key === "number" ? `${key}` : key;
}

function ensureNumericKindMap(container: object): NumericKindMap {
  const existing = (container as any)[NUMERIC_KIND_META] as NumericKindMap | undefined;
  if (existing instanceof Map) {
    return existing;
  }

  const created: NumericKindMap = new Map();
  Object.defineProperty(container, NUMERIC_KIND_META, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: created,
  });
  return created;
}

function getNumericKindMap(container: unknown): NumericKindMap | undefined {
  if (!isObjectLike(container)) {
    return undefined;
  }

  const map = (container as any)[NUMERIC_KIND_META];
  return map instanceof Map ? map : undefined;
}

export function setNumericKind(
  container: unknown,
  key: string | number,
  kind: NumericWireKind,
): void {
  if (!isObjectLike(container)) {
    return;
  }

  ensureNumericKindMap(container).set(normalizeMetaKey(container, key), kind);
}

export function getNumericKind(
  container: unknown,
  key: string | number,
): NumericWireKind | undefined {
  const map = getNumericKindMap(container);
  if (!map) {
    return undefined;
  }

  return map.get(normalizeMetaKey(container, key));
}

export function cloneNumericKinds(source: unknown, target: object): void {
  const src = getNumericKindMap(source);
  if (!src || src.size === 0) {
    return;
  }

  const out = ensureNumericKindMap(target);
  for (const [key, kind] of src.entries()) {
    out.set(normalizeMetaKey(target, key), kind);
  }
}

function assertIntegerNumber(value: number, path: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`Expected integer at ${path}, got ${value}`);
  }
}

function toBigIntFromNumber(value: number, path: string): bigint {
  assertIntegerNumber(value, path);
  if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
    throw new Error(`Unsafe integer at ${path}: ${value}. Use bigint.`);
  }
  return BigInt(value);
}

function assertInRange(value: bigint, kind: StrictIntKind, path: string): void {
  const range = NUMERIC_LIMITS[kind];
  if (value < range.min || value > range.max) {
    throw new Error(`Value ${value.toString()} at ${path} is out of range for ${kind}`);
  }
}

function inferIntegerKind(value: bigint): StrictIntKind {
  if (value >= 0n && value <= 127n) return "fixpos";
  if (value >= -32n && value <= -1n) return "fixneg";

  if (value >= 0n) {
    if (value <= NUMERIC_LIMITS.u8.max) return "u8";
    if (value <= NUMERIC_LIMITS.u16.max) return "u16";
    if (value <= NUMERIC_LIMITS.u32.max) return "u32";
    return "u64";
  }

  if (value >= NUMERIC_LIMITS.i8.min && value <= NUMERIC_LIMITS.i8.max) return "i8";
  if (value >= NUMERIC_LIMITS.i16.min && value <= NUMERIC_LIMITS.i16.max) return "i16";
  if (value >= NUMERIC_LIMITS.i32.min && value <= NUMERIC_LIMITS.i32.max) return "i32";
  return "i64";
}

class Writer {
  private readonly bytes: number[] = [];

  pushU8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  pushU16(v: number): void {
    this.pushU8((v >>> 8) & 0xff);
    this.pushU8(v & 0xff);
  }

  pushU32(v: number): void {
    this.pushU8((v >>> 24) & 0xff);
    this.pushU8((v >>> 16) & 0xff);
    this.pushU8((v >>> 8) & 0xff);
    this.pushU8(v & 0xff);
  }

  pushI8(v: number): void {
    this.pushU8(v);
  }

  pushI16(v: number): void {
    this.pushU16(v & 0xffff);
  }

  pushI32(v: number): void {
    this.pushU32(v >>> 0);
  }

  pushF32(v: number): void {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, v, false);
    this.pushBytes(new Uint8Array(buf));
  }

  pushF64(v: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, false);
    this.pushBytes(new Uint8Array(buf));
  }

  pushU64(v: bigint): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, v, false);
    this.pushBytes(new Uint8Array(buf));
  }

  pushI64(v: bigint): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, v, false);
    this.pushBytes(new Uint8Array(buf));
  }

  pushBytes(bytes: Uint8Array): void {
    for (const b of bytes) {
      this.bytes.push(b);
    }
  }

  finish(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.bytes) as Uint8Array<ArrayBuffer>;
  }
}

class Reader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  eof(): boolean {
    return this.offset >= this.data.length;
  }

  pos(): number {
    return this.offset;
  }

  private need(size: number): void {
    if (this.offset + size > this.data.length) {
      throw new Error(`Unexpected end of buffer at offset ${this.offset}`);
    }
  }

  u8(): number {
    this.need(1);
    return this.data[this.offset++]!;
  }

  i8(): number {
    const v = this.u8();
    return v & 0x80 ? v - 0x100 : v;
  }

  u16(): number {
    this.need(2);
    const v = (this.data[this.offset]! << 8) | this.data[this.offset + 1]!;
    this.offset += 2;
    return v >>> 0;
  }

  i16(): number {
    const v = this.u16();
    return v & 0x8000 ? v - 0x1_0000 : v;
  }

  u32(): number {
    this.need(4);
    const v =
      (this.data[this.offset]! * 0x1_0000_00) +
      ((this.data[this.offset + 1]! << 16) |
        (this.data[this.offset + 2]! << 8) |
        this.data[this.offset + 3]!);
    this.offset += 4;
    return v >>> 0;
  }

  i32(): number {
    const v = this.u32();
    return v > 0x7fff_ffff ? v - 0x1_0000_0000 : v;
  }

  f32(): number {
    this.need(4);
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4).getFloat32(0, false);
    this.offset += 4;
    return v;
  }

  f64(): number {
    this.need(8);
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8).getFloat64(0, false);
    this.offset += 8;
    return v;
  }

  u64(): bigint {
    this.need(8);
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8).getBigUint64(0, false);
    this.offset += 8;
    return v;
  }

  i64(): bigint {
    this.need(8);
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8).getBigInt64(0, false);
    this.offset += 8;
    return v;
  }

  bytes(size: number): Uint8Array {
    this.need(size);
    const out = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return out;
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class MsgPackExtData {
  constructor(
    public readonly type: number,
    public readonly data: Uint8Array,
  ) {}
}

export class CustomMsgPack {
  public static encode(
    value: any,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): Uint8Array<ArrayBuffer> {
    const writer = new Writer();
    const codecOptions = resolveMsgPackCodecOptions(options);
    this.writeValue(writer, value, "$", undefined, codecOptions);
    return writer.finish();
  }

  public static decode(data: Uint8Array): any {
    const reader = new Reader(data);
    const value = this.readValue(reader, undefined, undefined, "$");
    if (!reader.eof()) {
      throw new Error(`Trailing bytes at offset ${reader.pos()}`);
    }
    return value;
  }

  public static decodeMulti(data: Uint8Array): any[] {
    const reader = new Reader(data);
    const values: any[] = [];
    while (!reader.eof()) {
      values.push(
        this.readValue(
          reader,
          undefined,
          undefined,
          `$[${values.length}]`,
        ),
      );
    }
    return values;
  }

  private static writeValue(
    writer: Writer,
    value: any,
    path: string,
    preferredKind: NumericWireKind | undefined,
    codecOptions: ResolvedMsgPackCodecOptions,
  ): void {
    if (value === null || value === undefined) {
      writer.pushU8(0xc0);
      return;
    }

    if (typeof value === "boolean") {
      writer.pushU8(value ? 0xc3 : 0xc2);
      return;
    }

    if (typeof value === "string") {
      this.writeString(writer, value);
      return;
    }

    if (typeof value === "number") {
      this.writeNumber(writer, value, path, preferredKind, codecOptions);
      return;
    }

    if (typeof value === "bigint") {
      this.writeBigInt(writer, value, path, preferredKind, codecOptions);
      return;
    }

    if (value instanceof Uint8Array) {
      this.writeBinary(writer, value);
      return;
    }

    if (value instanceof ArrayBuffer) {
      this.writeBinary(writer, new Uint8Array(value));
      return;
    }

    if (value instanceof MsgPackExtData) {
      this.writeExt(writer, value);
      return;
    }

    if (Array.isArray(value)) {
      this.writeArrayHeader(writer, value.length);
      for (let i = 0; i < value.length; i++) {
        this.writeValue(
          writer,
          value[i],
          `${path}[${i}]`,
          getNumericKind(value, i),
          codecOptions,
        );
      }
      return;
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      this.writeMapHeader(writer, keys.length);
      for (const key of keys) {
        this.writeString(writer, key);
        this.writeValue(
          writer,
          value[key],
          `${path}.${key}`,
          getNumericKind(value, key),
          codecOptions,
        );
      }
      return;
    }

    throw new Error(`Unsupported value at ${path}: ${typeof value}`);
  }

  private static writeNumber(
    writer: Writer,
    value: number,
    path: string,
    preferredKind: NumericWireKind | undefined,
    codecOptions: ResolvedMsgPackCodecOptions,
  ): void {
    const resolvedPreferredKind = this.resolvePreferredNumericKind(
      preferredKind,
      codecOptions,
    );

    if (resolvedPreferredKind === "f32") {
      writer.pushU8(0xca);
      writer.pushF32(Math.fround(value));
      return;
    }

    if (resolvedPreferredKind === "f64") {
      writer.pushU8(0xcb);
      writer.pushF64(value);
      return;
    }

    if (resolvedPreferredKind) {
      try {
        this.writeBigIntWithKind(
          writer,
          toBigIntFromNumber(value, path),
          resolvedPreferredKind as StrictIntKind,
          path,
        );
        return;
      } catch (error) {
        if (codecOptions.typeMismatchPolicy === "throw") {
          throw error;
        }
      }
    }

    if (Number.isFinite(value) && Number.isInteger(value)) {
      this.writeBigIntWithKind(writer, toBigIntFromNumber(value, path), inferIntegerKind(BigInt(value)), path);
      return;
    }

    writer.pushU8(0xcb);
    writer.pushF64(value);
  }

  private static writeBigInt(
    writer: Writer,
    value: bigint,
    path: string,
    preferredKind: NumericWireKind | undefined,
    codecOptions: ResolvedMsgPackCodecOptions,
  ): void {
    const resolvedPreferredKind = this.resolvePreferredNumericKind(
      preferredKind,
      codecOptions,
    );
    if (resolvedPreferredKind === "f32" || resolvedPreferredKind === "f64") {
      if (codecOptions.typeMismatchPolicy === "throw") {
        throw new Error(`Cannot encode bigint as ${resolvedPreferredKind} at ${path}`);
      }
      this.writeBigIntWithKind(writer, value, inferIntegerKind(value), path);
      return;
    }

    if (resolvedPreferredKind) {
      try {
        this.writeBigIntWithKind(
          writer,
          value,
          resolvedPreferredKind as StrictIntKind,
          path,
        );
        return;
      } catch (error) {
        if (codecOptions.typeMismatchPolicy === "throw") {
          throw error;
        }
      }
    }

    this.writeBigIntWithKind(writer, value, inferIntegerKind(value), path);
  }

  private static resolvePreferredNumericKind(
    preferredKind: NumericWireKind | undefined,
    codecOptions: ResolvedMsgPackCodecOptions,
  ): NumericWireKind | undefined {
    if (!preferredKind) {
      return undefined;
    }

    if (preferredKind === "f32" || preferredKind === "f64") {
      return preferredKind;
    }

    if (codecOptions.widthMode === "preserve") {
      return preferredKind;
    }

    return undefined;
  }

  private static writeBigIntWithKind(
    writer: Writer,
    value: bigint,
    kind: StrictIntKind,
    path: string,
  ): void {
    assertInRange(value, kind, path);
    switch (kind) {
      case "fixpos": writer.pushU8(Number(value)); return;
      case "fixneg": writer.pushU8(Number(0x100n + value)); return;
      case "u8": writer.pushU8(0xcc); writer.pushU8(Number(value)); return;
      case "u16": writer.pushU8(0xcd); writer.pushU16(Number(value)); return;
      case "u32": writer.pushU8(0xce); writer.pushU32(Number(value)); return;
      case "u64": writer.pushU8(0xcf); writer.pushU64(value); return;
      case "i8": writer.pushU8(0xd0); writer.pushI8(Number(value)); return;
      case "i16": writer.pushU8(0xd1); writer.pushI16(Number(value)); return;
      case "i32": writer.pushU8(0xd2); writer.pushI32(Number(value)); return;
      case "i64": writer.pushU8(0xd3); writer.pushI64(value); return;
      default: throw new Error(`Unsupported integer kind ${kind} at ${path}`);
    }
  }

  private static writeString(writer: Writer, value: string): void {
    const bytes = textEncoder.encode(value);
    const len = bytes.length;
    if (len <= 31) {
      writer.pushU8(0xa0 | len);
    } else if (len <= 0xff) {
      writer.pushU8(0xd9); writer.pushU8(len);
    } else if (len <= 0xffff) {
      writer.pushU8(0xda); writer.pushU16(len);
    } else {
      writer.pushU8(0xdb); writer.pushU32(len);
    }
    writer.pushBytes(bytes);
  }

  private static writeBinary(writer: Writer, value: Uint8Array): void {
    const len = value.length;
    if (len <= 0xff) {
      writer.pushU8(0xc4); writer.pushU8(len);
    } else if (len <= 0xffff) {
      writer.pushU8(0xc5); writer.pushU16(len);
    } else {
      writer.pushU8(0xc6); writer.pushU32(len);
    }
    writer.pushBytes(value);
  }

  private static writeExt(writer: Writer, value: MsgPackExtData): void {
    const len = value.data.length;
    if (!Number.isInteger(value.type) || value.type < -128 || value.type > 127) {
      throw new Error(`Invalid ext type: ${value.type}`);
    }

    switch (len) {
      case 1: writer.pushU8(0xd4); writer.pushI8(value.type); writer.pushBytes(value.data); return;
      case 2: writer.pushU8(0xd5); writer.pushI8(value.type); writer.pushBytes(value.data); return;
      case 4: writer.pushU8(0xd6); writer.pushI8(value.type); writer.pushBytes(value.data); return;
      case 8: writer.pushU8(0xd7); writer.pushI8(value.type); writer.pushBytes(value.data); return;
      case 16: writer.pushU8(0xd8); writer.pushI8(value.type); writer.pushBytes(value.data); return;
      default:
        if (len <= 0xff) {
          writer.pushU8(0xc7);
          writer.pushU8(len);
        } else if (len <= 0xffff) {
          writer.pushU8(0xc8);
          writer.pushU16(len);
        } else {
          writer.pushU8(0xc9);
          writer.pushU32(len);
        }
        writer.pushI8(value.type);
        writer.pushBytes(value.data);
    }
  }

  private static writeArrayHeader(writer: Writer, size: number): void {
    if (size <= 0x0f) writer.pushU8(0x90 | size);
    else if (size <= 0xffff) { writer.pushU8(0xdc); writer.pushU16(size); }
    else { writer.pushU8(0xdd); writer.pushU32(size); }
  }

  private static writeMapHeader(writer: Writer, size: number): void {
    if (size <= 0x0f) writer.pushU8(0x80 | size);
    else if (size <= 0xffff) { writer.pushU8(0xde); writer.pushU16(size); }
    else { writer.pushU8(0xdf); writer.pushU32(size); }
  }

  private static readValue(
    reader: Reader,
    parent: unknown,
    key: string | number | undefined,
    path: string,
  ): any {
    const marker = reader.u8();
    if (marker <= 0x7f) { this.recordKind(parent, key, "fixpos"); return marker; }
    if (marker >= 0xe0) { this.recordKind(parent, key, "fixneg"); return marker - 0x100; }
    if (marker >= 0xa0 && marker <= 0xbf) return textDecoder.decode(reader.bytes(marker & 0x1f));
    if (marker >= 0x90 && marker <= 0x9f) return this.readArray(reader, marker & 0x0f, path);
    if (marker >= 0x80 && marker <= 0x8f) return this.readMap(reader, marker & 0x0f, path);

    switch (marker) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: return reader.bytes(reader.u8());
      case 0xc5: return reader.bytes(reader.u16());
      case 0xc6: return reader.bytes(reader.u32());
      case 0xc7: return this.readExt(reader, reader.u8());
      case 0xc8: return this.readExt(reader, reader.u16());
      case 0xc9: return this.readExt(reader, reader.u32());
      case 0xca: this.recordKind(parent, key, "f32"); return reader.f32();
      case 0xcb: this.recordKind(parent, key, "f64"); return reader.f64();
      case 0xcc: this.recordKind(parent, key, "u8"); return reader.u8();
      case 0xcd: this.recordKind(parent, key, "u16"); return reader.u16();
      case 0xce: this.recordKind(parent, key, "u32"); return reader.u32();
      case 0xcf: this.recordKind(parent, key, "u64"); return reader.u64();
      case 0xd0: this.recordKind(parent, key, "i8"); return reader.i8();
      case 0xd1: this.recordKind(parent, key, "i16"); return reader.i16();
      case 0xd2: this.recordKind(parent, key, "i32"); return reader.i32();
      case 0xd3: this.recordKind(parent, key, "i64"); return reader.i64();
      case 0xd4: return this.readExt(reader, 1);
      case 0xd5: return this.readExt(reader, 2);
      case 0xd6: return this.readExt(reader, 4);
      case 0xd7: return this.readExt(reader, 8);
      case 0xd8: return this.readExt(reader, 16);
      case 0xd9: return textDecoder.decode(reader.bytes(reader.u8()));
      case 0xda: return textDecoder.decode(reader.bytes(reader.u16()));
      case 0xdb: return textDecoder.decode(reader.bytes(reader.u32()));
      case 0xdc: return this.readArray(reader, reader.u16(), path);
      case 0xdd: return this.readArray(reader, reader.u32(), path);
      case 0xde: return this.readMap(reader, reader.u16(), path);
      case 0xdf: return this.readMap(reader, reader.u32(), path);
      default:
        throw new Error(
          `Unsupported MessagePack marker 0x${marker.toString(16)} at ${path} (offset ${reader.pos() - 1})`,
        );
    }
  }

  private static readExt(reader: Reader, size: number): MsgPackExtData {
    const type = reader.i8();
    const data = reader.bytes(size);
    return new MsgPackExtData(type, data);
  }

  private static readArray(reader: Reader, size: number, path: string): any[] {
    const out = new Array(size);
    for (let i = 0; i < size; i++) out[i] = this.readValue(reader, out, i, `${path}[${i}]`);
    return out;
  }

  private static readMap(reader: Reader, size: number, path: string): Record<string, any> {
    const out: Record<string, any> = {};
    for (let i = 0; i < size; i++) {
      const rawKey = this.readValue(reader, undefined, undefined, `${path}.{key#${i}}`);
      const key = typeof rawKey === "string" ? rawKey : `${rawKey}`;
      out[key] = this.readValue(reader, out, key, `${path}.${key}`);
    }
    return out;
  }

  private static recordKind(parent: unknown, key: string | number | undefined, kind: NumericWireKind): void {
    if (key === undefined) return;
    setNumericKind(parent, key, kind);
  }
}

export function tryDecodeLz4BlockArrayPayload(
  value: unknown,
  extType = 98,
): any | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const header = value[0];
  if (!(header instanceof MsgPackExtData) || header.type !== extType) {
    return null;
  }

  const blockSizes = CustomMsgPack.decodeMulti(header.data);
  if (blockSizes.length === 0) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < blockSizes.length; i++) {
    const compressedBlock = value[i + 1];
    if (!(compressedBlock instanceof Uint8Array)) {
      return null;
    }

    const rawSize = blockSizes[i];
    const size =
      typeof rawSize === "bigint"
        ? Number(rawSize)
        : typeof rawSize === "number"
          ? rawSize
          : Number(rawSize);
    if (!Number.isInteger(size) || size < 0) {
      return null;
    }

    const decompressedBlock = new Uint8Array(size);
    lz4.decompressBlock(
      compressedBlock,
      decompressedBlock,
      0,
      compressedBlock.length,
      0,
    );
    chunks.push(decompressedBlock);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return CustomMsgPack.decode(merged);
}

export function coerceKindedNumber(value: any, kind: NumericWireKind, path: string): number | bigint {
  if (kind === "f32") {
    if (typeof value !== "number") throw new Error(`Expected number at ${path}`);
    return Math.fround(value);
  }
  if (kind === "f64") {
    if (typeof value === "bigint") return Number(value);
    if (typeof value !== "number") throw new Error(`Expected number at ${path}`);
    return value;
  }

  const asBigInt =
    typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? toBigIntFromNumber(value, path)
        : typeof value === "string"
          ? BigInt(value)
          : (() => {
              throw new Error(`Expected numeric value at ${path}, got ${typeof value}`);
            })();

  assertInRange(asBigInt, kind, path);
  if (kind === "i64" || kind === "u64") return asBigInt;
  if (asBigInt > MAX_SAFE_BIGINT || asBigInt < MIN_SAFE_BIGINT) {
    throw new Error(`Cannot represent ${asBigInt.toString()} safely as number at ${path}`);
  }
  return Number(asBigInt);
}
