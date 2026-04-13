import 'reflect-metadata';
import {
  cloneNumericKinds,
  coerceKindedNumber,
  CustomMsgPack,
  getNumericKind,
  resolveMsgPackCodecOptions,
  setNumericKind,
  tryDecodeLz4BlockArrayPayload,
} from './MessagePackCodec';
import type {
  MsgPackCodecOptions,
  MsgPackTypeMismatchPolicy,
  NumericWireKind,
  ResolvedMsgPackCodecOptions,
} from './MessagePackCodec';
import { ExportedClass } from './ExportedClass';

const KEY_META = Symbol('msgpack:keys');
const UNION_INSTANCE_TAG = Symbol('msgpack:union:instanceTag');
const UNION_REGISTRY = Symbol('msgpack:union:registry');
const UNION_TAG = Symbol('msgpack:union:tag');

// --- Types ---
export type Constructor<T = any> = new (...args: any[]) => T;
export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;
export type TypeInfo =
  | Constructor
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor;
export type TypeInfoRef = TypeInfo | (() => TypeInfo);

export interface KeyOptions {
  /** Explicit type for custom classes or overrides */
  readonly type?: TypeInfoRef;
  /** For Arrays/Lists/Dictionaries: The inner types. e.g. List<T> -> [T] */
  readonly generic?: TypeInfoRef[];
  /** Explicit number type for encoding safety */
  readonly intType?:
    | 'u8'
    | 'u16'
    | 'u32'
    | 'u64'
    | 'i8'
    | 'i16'
    | 'i32'
    | 'f32'
    | 'f64'
    | 'i64';
  /** Is the value nullable? */
  readonly nullable?: boolean;
}

interface MsgPackKeyInfo {
  readonly index: number | string;
  readonly propertyKey: string;
  readonly designType: TypeInfo;
  readonly info: KeyOptions;
  readonly owner?: Function;
}

type MsgPackKeyMap = Map<string | number, MsgPackKeyInfo>;
type UnionTypeFactory = () => AbstractConstructor<MessagePackObject>;
type UnionMap = Map<number, UnionTypeFactory>;

function hasOwnProperty(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isFactoryFn(value: unknown): value is (...args: any[]) => any {
  return (
    typeof value === 'function' && !hasOwnProperty(value as object, 'prototype')
  );
}

function toNumericIndex(value: string | number): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && `${asNumber}` === value) {
      return asNumber;
    }
  }

  return null;
}

function lookupKeyInfo(
  keys: MsgPackKeyMap,
  key: string | number,
): MsgPackKeyInfo | undefined {
  const direct = keys.get(key);
  if (direct) {
    return direct;
  }

  if (typeof key === 'string') {
    const maybeNumber = toNumericIndex(key);
    if (maybeNumber !== null) {
      return keys.get(maybeNumber);
    }
  }

  return undefined;
}

function toJsonSafeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof MessagePackObject) {
    return value.toJSON();
  }

  const out: any = {};
  for (const key of Object.keys(value)) {
    out[key] = toJsonSafeValue(value[key]);
  }
  return out;
}

function isNonFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isFinite(value);
}

function resolveCodecOptions(
  options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
): ResolvedMsgPackCodecOptions {
  return resolveMsgPackCodecOptions(options);
}

function getDeclaredDefaultNumericValue(kind: NumericWireKind): number | bigint {
  if (kind === 'i64' || kind === 'u64') {
    return 0n;
  }

  if (kind === 'f32') {
    return Math.fround(0);
  }

  return 0;
}

function coerceNumericWithPolicy(
  value: any,
  declaredKind: NumericWireKind,
  decodedKind: NumericWireKind | undefined,
  path: string,
  policy: MsgPackTypeMismatchPolicy,
): number | bigint {
  try {
    return coerceKindedNumber(value, declaredKind, path);
  } catch (error) {
    if (policy === 'throw') {
      throw error;
    }

    if (policy === 'useDeclaredDefault') {
      return getDeclaredDefaultNumericValue(declaredKind);
    }

    if (decodedKind) {
      try {
        return coerceKindedNumber(value, decodedKind, path);
      } catch {
        // Fall through to raw value fallback.
      }
    }

    return value;
  }
}

function selectPreferredNumericKind(
  declaredKind: NumericWireKind | undefined,
  decodedKind: NumericWireKind | undefined,
  codecOptions: ResolvedMsgPackCodecOptions,
): NumericWireKind | undefined {
  if (decodedKind === 'f32' || decodedKind === 'f64') {
    return decodedKind;
  }

  if (codecOptions.widthMode === 'preserve' && decodedKind) {
    return decodedKind;
  }

  if (declaredKind === 'f32' || declaredKind === 'f64') {
    return declaredKind;
  }

  return undefined;
}

// --- Decorator ---
function getOrCreateMsgPackKeyMap(constructor: Function): MsgPackKeyMap {
  const keys = getOwnMsgPackKeyMap(constructor);

  if (!keys) {
    // check if parent has keys
    const parentKeys: MsgPackKeyMap | undefined = Reflect.getMetadata(
      KEY_META,
      constructor,
    );

    if (parentKeys) {
      const newKeys = new Map(parentKeys);
      return newKeys;
    }

    return new Map();
  }

  return keys;
}

function getOwnMsgPackKeyMap(constructor: Function): MsgPackKeyMap | undefined {
  const keys: MsgPackKeyMap = Reflect.getOwnMetadata(KEY_META, constructor);
  return keys;
}

function getMsgPackKeyMap(constructor: Function): MsgPackKeyMap | undefined {
  const own = getOwnMsgPackKeyMap(constructor);
  if (own) {
    return own;
  }

  const inherited: MsgPackKeyMap | undefined = Reflect.getMetadata(
    KEY_META,
    constructor,
  );
  return inherited;
}

function getOwnUnionMap(constructor: Function): UnionMap | undefined {
  if (!hasOwnProperty(constructor, UNION_REGISTRY)) {
    return undefined;
  }

  return (constructor as any)[UNION_REGISTRY] as UnionMap | undefined;
}

function getOrCreateOwnUnionMap(constructor: Function): UnionMap {
  const existing = getOwnUnionMap(constructor);
  if (existing) {
    return existing;
  }

  const created: UnionMap = new Map();
  Object.defineProperty(constructor, UNION_REGISTRY, {
    value: created,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return created;
}

function getOwnUnionTag(constructor: Function): number | undefined {
  const tag = (constructor as any)[UNION_TAG];
  return typeof tag === 'number' ? tag : undefined;
}

function setOwnUnionTag(constructor: Function, tag: number): void {
  Object.defineProperty(constructor, UNION_TAG, {
    value: tag,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

function resolveTypeInfo(
  typeRef: TypeInfoRef | undefined,
): TypeInfo | undefined {
  if (!typeRef) {
    return undefined;
  }

  if (isFactoryFn(typeRef)) {
    return (typeRef as () => TypeInfo)();
  }

  return typeRef;
}

function toUnionTypeFactory(
  subtype:
    | AbstractConstructor<MessagePackObject>
    | (() => AbstractConstructor<MessagePackObject>),
): UnionTypeFactory {
  if (isFactoryFn(subtype)) {
    return subtype as UnionTypeFactory;
  }

  return () => subtype as AbstractConstructor<MessagePackObject>;
}

function findUnionTagForSubtype(constructor: Function): number | undefined {
  let current = Object.getPrototypeOf(constructor);
  while (current && current !== Function.prototype) {
    const unions = getOwnUnionMap(current);
    if (unions) {
      for (const [tag, subtypeFactory] of unions.entries()) {
        try {
          const mapped = subtypeFactory();
          if (mapped === constructor) {
            setOwnUnionTag(constructor, tag);
            return tag;
          }
        } catch {
          // Ignore resolution failure and continue scanning other entries.
        }
      }
    }
    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

export function Key(index?: number | string, info?: KeyOptions) {
  return function (target: any, propertyKey: any) {
    const constructor = target.constructor;
    const keys: MsgPackKeyMap = getOrCreateMsgPackKeyMap(constructor);
    const designType = Reflect.getMetadata('design:type', target, propertyKey);
    const key = index ?? propertyKey;

    const existing = keys.get(key);
    if (existing) {
      if (existing.owner !== constructor) {
        // Allow child classes to override keys declared in parent classes.
        keys.delete(key);
      } else {
        throw new Error(
          `Duplicate key ${key} for ${constructor.name}.${propertyKey}`,
        );
      }
    }

    keys.set(key, {
      index: key,
      propertyKey,
      designType,
      info: info || {},
      owner: constructor,
    });

    Reflect.defineMetadata(KEY_META, keys, constructor);
  };
}

export function Union(
  tag: number,
  subtype:
    | AbstractConstructor<MessagePackObject>
    | (() => AbstractConstructor<MessagePackObject>),
) {
  return function (target: Function) {
    if (!Number.isInteger(tag)) {
      throw new Error(`Union tag must be an integer, got ${tag}`);
    }

    const baseType = target as typeof MessagePackObject;
    const unions = getOrCreateOwnUnionMap(baseType);
    const subtypeFactory = toUnionTypeFactory(subtype);
    const existing = unions.get(tag);
    if (existing) {
      try {
        const existingType = existing();
        const nextType = subtypeFactory();
        if (existingType !== nextType) {
          throw new Error(
            `Duplicate union tag ${tag} on ${baseType.name}: ${existingType.name} vs ${nextType.name}`,
          );
        }
      } catch {
        // If either side cannot resolve yet due load order/circular refs, keep first registration.
      }
      return;
    }

    unions.set(tag, subtypeFactory);
    if (!isFactoryFn(subtype)) {
      setOwnUnionTag(subtype as Constructor<MessagePackObject>, tag);
    }
  };
}

// --- Base Object ---
export class MessagePackObject extends ExportedClass {
  protected static _isMapMode = false;
  protected unknownKeys: Map<string | number, any> = new Map();

  public encodeMsgPack(
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): Uint8Array<ArrayBuffer> {
    const codecOptions = resolveCodecOptions(options);
    const obj = this.toMsgPackObject(codecOptions);
    return CustomMsgPack.encode(obj, codecOptions);
  }

  public static decodeMsgPack<T extends MessagePackObject>(
    this: Constructor<T> & typeof MessagePackObject,
    buffer: Uint8Array,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): T | null {
    return this.decodeInstance(buffer, options);
  }

  public static decodeInstance<T extends MessagePackObject>(
    this: Constructor<T> & typeof MessagePackObject,
    buffer: Uint8Array,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): T | null {
    const codecOptions = resolveCodecOptions(options);
    const wire = CustomMsgPack.decode(buffer);
    return this.createFromMsgPackObject(wire, codecOptions);
  }

  public toJSON(): any {
    const keys = getMsgPackKeyMap(this.constructor);

    if (!keys) {
      return {};
    }

    const obj: any = {};

    for (const { propertyKey } of keys.values()) {
      obj[propertyKey] = toJsonSafeValue((this as any)[propertyKey]);
    }

    for (const [key, value] of this.unknownKeys.entries()) {
      const newKeyName = `__UNKNOWN_${key}__`;
      obj[newKeyName] = toJsonSafeValue(value);
    }

    return obj;
  }

  public toMsgPackObject(
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): any {
    const codecOptions = resolveCodecOptions(options);
    const constructor = this.constructor as typeof MessagePackObject;
    const keys = getMsgPackKeyMap(constructor);

    if (!keys) {
      throw new Error(
        `Keys not found for ${constructor.name}. Did you forget to add @Key decorator?`,
      );
    }

    const isMapMode = constructor._isMapMode;
    let payload: any;

    if (isMapMode) {
      const res: any = {};
      for (const { index, propertyKey, info } of keys.values()) {
        res[index] = constructor.toMsgPackObject(
          this[propertyKey as keyof this],
          info,
          `${constructor.name}.${propertyKey}`,
          codecOptions,
        );

        const kind = selectPreferredNumericKind(
          info.intType,
          getNumericKind(this, propertyKey),
          codecOptions,
        );
        if (kind) {
          setNumericKind(res, index, kind);
        }
      }

      for (const [key, value] of this.unknownKeys.entries()) {
        res[key] = constructor.toMsgPackObject(
          value,
          undefined,
          `${constructor.name}.__UNKNOWN_${String(key)}__`,
          codecOptions,
        );
        const kind = selectPreferredNumericKind(
          undefined,
          getNumericKind(this.unknownKeys, key),
          codecOptions,
        );
        if (kind) {
          setNumericKind(res, key, kind);
        }
      }

      payload = res;
    } else {
      let max = 0;

      for (const { index } of keys.values()) {
        if (typeof index === 'number' && index > max) {
          max = index;
        }
      }

      for (const key of this.unknownKeys.keys()) {
        const unknownIndex = toNumericIndex(key);
        if (unknownIndex !== null && unknownIndex > max) {
          max = unknownIndex;
        }
      }

      const res = new Array(max + 1).fill(null);

      for (const { index, propertyKey, info } of keys.values()) {
        if (typeof index === 'number') {
          res[index] = constructor.toMsgPackObject(
            this[propertyKey as keyof this],
            info,
            `${constructor.name}.${propertyKey}`,
            codecOptions,
          );
          const kind = selectPreferredNumericKind(
            info.intType,
            getNumericKind(this, propertyKey),
            codecOptions,
          );
          if (kind) {
            setNumericKind(res, index, kind);
          }
        }
      }

      for (const [key, value] of this.unknownKeys.entries()) {
        const unknownIndex = toNumericIndex(key);
        if (unknownIndex === null) {
          continue;
        }

        res[unknownIndex] = constructor.toMsgPackObject(
          value,
          undefined,
          `${constructor.name}.__UNKNOWN_${unknownIndex}__`,
          codecOptions,
        );
        const kind = selectPreferredNumericKind(
          undefined,
          getNumericKind(this.unknownKeys, key),
          codecOptions,
        );
        if (kind) {
          setNumericKind(res, unknownIndex, kind);
        }
      }

      payload = res;
    }

    return MessagePackObject.wrapUnionPayload(this, payload);
  }

  public static createFromMsgPackObject<T extends MessagePackObject>(
    this: Constructor<T> & typeof MessagePackObject,
    obj: any,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): T | null {
    const codecOptions = resolveCodecOptions(options);
    const unions = getOwnUnionMap(this);
    if (unions) {
      return this.fromUnionWire(obj, this, unions, codecOptions);
    }

    return this.fromWire(obj, this, codecOptions);
  }

  public static createFromJSON<T extends MessagePackObject>(
    this: Constructor<T> & typeof MessagePackObject,
    json: any,
  ): T | null {
    if (json === null || json === undefined) {
      return null;
    }

    const unions = getOwnUnionMap(this);
    if (unions) {
      return this.fromUnionJson(json, this, unions);
    }

    return this.fromJsonObject(json, this);
  }

  protected static fromJsonObject<T extends MessagePackObject>(
    json: any,
    Cls: { new (): T } & typeof MessagePackObject,
  ): T | null {
    if (json === null || json === undefined) {
      return null;
    }

    if (Array.isArray(json)) {
      throw new Error('Expected object, got array');
    }

    const instance = new Cls();
    const keys = getMsgPackKeyMap(Cls);

    if (!keys) {
      return instance;
    }

    for (const [key, value] of Object.entries(json)) {
      const keyInfo = lookupKeyInfo(keys, key);

      if (keyInfo) {
        (instance as any)[keyInfo.propertyKey] = (Cls as any).resolveJsonValue(
          value,
          keyInfo.info,
          `${Cls.name}.${keyInfo.propertyKey}`,
          keyInfo.designType,
        );
        continue;
      }

      if (key.startsWith('__UNKNOWN_')) {
        const newKey = key.replace('__UNKNOWN_', '').replace(/__$/, '');
        instance.unknownKeys.set(newKey, value);
        continue;
      }

      (instance as any)[key] = value;
      instance.unknownKeys.set(key, value);
    }

    return instance;
  }

  public getOrDefault<K extends keyof this>(key: K): this[K] | null {
    if (hasOwnProperty(this, key)) {
      return this[key];
    }

    // check types
    const keys = getMsgPackKeyMap(this.constructor);

    if (keys) {
      const keyInfo = lookupKeyInfo(keys, key as any);
      if (!keyInfo || keyInfo.info.nullable) {
        return null;
      }

      const resolvedType = resolveTypeInfo(keyInfo.info.type);
      if (resolvedType && resolvedType.prototype instanceof MessagePackObject) {
        return new resolvedType() as any;
      }

      if (resolvedType === Array) {
        return [] as any;
      }

      if (resolvedType === String) {
        return '' as any;
      }

      if (keyInfo.info.intType === 'i64' || keyInfo.info.intType === 'u64') {
        return 0n as any;
      }

      if (resolvedType === Number) {
        return 0 as any;
      }

      if (resolvedType === Boolean) {
        return false as any;
      }

      if (resolvedType === Date) {
        return new Date() as any;
      }
    }

    return null;
  }

  public fromMsgPackObject(
    obj: any,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): void {
    const codecOptions = resolveCodecOptions(options);
    const constructor = this.constructor as typeof MessagePackObject;
    const keys = getMsgPackKeyMap(constructor);

    if (!keys) {
      throw new Error(
        `Keys not found for ${constructor.name}. Did you forget to add @Key decorator?`,
      );
    }

    const entries = Array.isArray(obj) ? obj.entries() : Object.entries(obj);

    for (const [idx, val] of entries) {
      const keyInfo = lookupKeyInfo(keys, idx as any);
      const decodedKind = getNumericKind(obj, idx as any);
      if (keyInfo) {
        this[keyInfo.propertyKey as keyof this] =
          constructor.resolveMsgPackValue(
            val,
            keyInfo.info,
            `${constructor.name}.${keyInfo.propertyKey}`,
            decodedKind,
            keyInfo.designType,
            codecOptions,
          );
        if (decodedKind) {
          setNumericKind(this, keyInfo.propertyKey, decodedKind);
        }
      } else {
        this.unknownKeys.set(idx as any, val);
        if (decodedKind) {
          setNumericKind(this.unknownKeys, idx as any, decodedKind);
        }
      }
    }
  }

  protected static readKeyedValue(
    source: any,
    index: number,
    name?: string,
  ): unknown {
    if (source === null || source === undefined) {
      return undefined;
    }

    if (Array.isArray(source)) {
      return source[index];
    }

    if (typeof source !== 'object') {
      return undefined;
    }

    if (name && hasOwnProperty(source, name)) {
      return (source as any)[name];
    }

    const numericKey = `${index}`;
    if (hasOwnProperty(source, numericKey)) {
      return (source as any)[numericKey];
    }

    if (hasOwnProperty(source, index)) {
      return (source as any)[index];
    }

    return undefined;
  }

  protected static toNumericIndexValue(value: string | number): number | null {
    return toNumericIndex(value);
  }

  protected static toIntegerValue(
    value: unknown,
    defaultValue = 0,
    allowNonFinite = false,
  ): number {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return Math.trunc(value);
      }

      return allowNonFinite ? value : defaultValue;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        return defaultValue;
      }

      if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
      }

      return allowNonFinite ? parsed : defaultValue;
    }

    return defaultValue;
  }

  protected static toFloatValue(
    value: unknown,
    defaultValue = 0,
    allowNonFinite = true,
  ): number {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return Math.fround(value);
      }

      return allowNonFinite ? value : defaultValue;
    }

    if (typeof value === 'bigint') {
      return Math.fround(Number(value));
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        return defaultValue;
      }

      if (Number.isFinite(parsed)) {
        return Math.fround(parsed);
      }

      return allowNonFinite ? parsed : defaultValue;
    }

    return defaultValue;
  }

  protected static toBooleanValue(
    value: unknown,
    defaultValue = false,
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }

      const asNumber = Number(normalized);
      if (!Number.isNaN(asNumber)) {
        return asNumber !== 0;
      }
    }

    return defaultValue;
  }

  protected static toNullableStringValue(
    value: unknown,
    coerce = true,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!coerce && typeof value !== 'string') {
      return null;
    }

    return String(value);
  }

  protected static decodePossiblyCompressedPayload(value: unknown): any {
    const decoded = tryDecodeLz4BlockArrayPayload(value);
    return decoded ?? value;
  }

  //#region Internals
  protected static wrapUnionPayload(
    instance: MessagePackObject,
    payload: any,
  ): any {
    const ctor = instance.constructor as Function;
    const decodedTag = (instance as any)[UNION_INSTANCE_TAG];
    const declaredTag = getOwnUnionTag(ctor);
    const resolvedTag = findUnionTagForSubtype(ctor);
    const tag = declaredTag ?? resolvedTag ?? decodedTag;

    if (typeof tag === 'number' && Number.isInteger(tag)) {
      return [tag, payload];
    }

    return payload;
  }

  protected static toMsgPackObject(
    instance: any,
    info?: KeyOptions,
    path = '$',
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): any {
    const codecOptions = resolveCodecOptions(options);
    if (instance === null || instance === undefined) {
      return null;
    }

    if (instance instanceof Date) {
      return instance.getTime();
    }

    if (Array.isArray(instance)) {
      const out = instance.map((item, index) =>
        this.toMsgPackObject(item, info, `${path}[${index}]`, codecOptions),
      );

      cloneNumericKinds(instance, out);
      if (info?.intType === 'f32' || info?.intType === 'f64') {
        for (let i = 0; i < out.length; i++) {
          if (!getNumericKind(out, i)) {
            setNumericKind(out, i, info.intType);
          }
        }
      }
      return out;
    }

    if (typeof instance === 'number') {
      if (isNonFiniteNumber(instance)) {
        return instance;
      }

      if (info?.intType === 'f32') {
        return Math.fround(instance);
      }

      if (info?.intType) {
        return coerceNumericWithPolicy(
          instance,
          info.intType,
          undefined,
          path,
          codecOptions.typeMismatchPolicy,
        );
      }

      return instance;
    }

    if (typeof instance === 'bigint') {
      if (info?.intType) {
        return coerceNumericWithPolicy(
          instance,
          info.intType,
          undefined,
          path,
          codecOptions.typeMismatchPolicy,
        );
      }
      return instance;
    }

    if (typeof instance !== 'object') {
      return instance;
    }

    if (
      instance instanceof MessagePackObject ||
      typeof instance.toMsgPackObject === 'function'
    ) {
      return instance.toMsgPackObject(codecOptions);
    }

    const obj: any = {};
    for (const k in instance) {
      if (hasOwnProperty(instance, k)) {
        obj[k] = this.toMsgPackObject(
          instance[k],
          undefined,
          `${path}.${k}`,
          codecOptions,
        );
      }
    }

    cloneNumericKinds(instance, obj);
    return obj;
  }

  protected static fromWire<T extends MessagePackObject>(
    wire: any,
    Cls: { new (): T } & typeof MessagePackObject,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): T | null {
    const codecOptions = resolveCodecOptions(options);
    if (wire === null || wire === undefined) {
      return null;
    }

    if (typeof wire !== 'object') {
      return wire as any;
    }

    const instance = new Cls();

    if (!(instance instanceof MessagePackObject)) {
      throw new Error(
        `Expected instance of MessagePackObject, got ${Cls.name}`,
      );
    }

    instance.fromMsgPackObject(wire, codecOptions);
    return instance;
  }

  protected static fromUnionWire<T extends MessagePackObject>(
    wire: any,
    Cls: { new (): T } & typeof MessagePackObject,
    unions: UnionMap,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): T | null {
    const codecOptions = resolveCodecOptions(options);
    if (wire === null || wire === undefined) {
      return null;
    }

    // MessagePack C# union is represented as [tag, payload].
    // Some saves still contain plain base payloads, so only treat strict 2-item arrays as union tuples.
    if (!Array.isArray(wire) || wire.length !== 2) {
      return this.fromWire(wire, Cls, codecOptions) as T | null;
    }

    const rawTag = wire[0];
    const payload = wire[1];

    if (typeof rawTag !== 'number' && typeof rawTag !== 'bigint') {
      return this.fromWire(wire, Cls, codecOptions) as T | null;
    }

    const tag = typeof rawTag === 'bigint' ? Number(rawTag) : rawTag;
    if (!Number.isInteger(tag)) {
      return this.fromWire(wire, Cls, codecOptions) as T | null;
    }

    const mappedFactory = unions.get(tag);
    if (mappedFactory) {
      const mapped = mappedFactory();
      setOwnUnionTag(mapped, tag);
      return (mapped as typeof MessagePackObject).createFromMsgPackObject(
        payload,
        codecOptions,
      ) as T | null;
    }

    const fallback = this.fromWire(payload, Cls, codecOptions) as T | null;
    if (fallback) {
      (fallback as any)[UNION_INSTANCE_TAG] = tag;
    }
    return fallback;
  }

  protected static fromUnionJson<T extends MessagePackObject>(
    json: any,
    Cls: { new (): T } & typeof MessagePackObject,
    unions: UnionMap,
  ): T | null {
    if (json === null || json === undefined) {
      return null;
    }

    if (Array.isArray(json) && json.length === 2) {
      const rawTag = json[0];
      const payload = json[1];
      if (typeof rawTag === 'number' || typeof rawTag === 'bigint') {
        const tag = typeof rawTag === 'bigint' ? Number(rawTag) : rawTag;
        if (Number.isInteger(tag)) {
          const mappedFactory = unions.get(tag);
          if (mappedFactory) {
            const mapped = mappedFactory();
            setOwnUnionTag(mapped, tag);
            return (mapped as typeof MessagePackObject).createFromJSON(
              payload,
            ) as unknown as T | null;
          }

          const fallback = this.fromJsonObject(payload, Cls) as T | null;
          if (fallback) {
            (fallback as any)[UNION_INSTANCE_TAG] = tag;
          }
          return fallback;
        }
      }
    }

    if (!Array.isArray(json) && typeof json === 'object') {
      const mapped = this.resolveUnionSubtypeByJson(
        unions,
        json as Record<string, unknown>,
      );
      if (mapped) {
        if (mapped === Cls) {
          return this.fromJsonObject(json, Cls) as T | null;
        }

        return (mapped as typeof MessagePackObject).createFromJSON(
          json,
        ) as unknown as T | null;
      }
    }

    return this.fromJsonObject(json, Cls) as T | null;
  }

  protected static resolveUnionSubtypeByJson(
    unions: UnionMap,
    json: Record<string, unknown>,
  ): AbstractConstructor<MessagePackObject> | null {
    const typeValue = json.Type;
    if (typeof typeValue === 'number' && Number.isInteger(typeValue)) {
      const mapped = unions.get(typeValue);
      if (mapped) {
        return mapped();
      }
    }

    let bestMatch: AbstractConstructor<MessagePackObject> | null = null;
    let bestScore = 0;
    let isTie = false;

    for (const subtypeFactory of unions.values()) {
      const subtype = subtypeFactory();
      const keys = getMsgPackKeyMap(subtype);
      if (!keys) {
        continue;
      }

      let score = 0;
      for (const { propertyKey } of keys.values()) {
        if (hasOwnProperty(json, propertyKey)) {
          score++;
        }
      }

      if (score === 0) {
        continue;
      }

      if (score > bestScore) {
        bestMatch = subtype;
        bestScore = score;
        isTie = false;
      } else if (score === bestScore) {
        isTie = true;
      }
    }

    if (isTie) {
      return null;
    }

    return bestMatch;
  }

  protected static resolveMsgPackValue(
    wireValue: any,
    info: KeyOptions,
    path: string,
    decodedKind?: NumericWireKind,
    designType?: TypeInfo,
    options?: MsgPackCodecOptions | ResolvedMsgPackCodecOptions,
  ): any {
    const codecOptions = resolveCodecOptions(options);
    if (wireValue === null || wireValue === undefined) {
      return null;
    }

    if (info.generic && Array.isArray(info.generic)) {
      if (!Array.isArray(wireValue)) {
        return [];
      }

      const InnerType = resolveTypeInfo(info.generic[0]);
      const innerInfo: KeyOptions = {
        type: InnerType as any,
        intType: info.intType,
      };
      return wireValue.map((item, index) =>
        this.resolveMsgPackValue(
          item,
          innerInfo,
          `${path}[${index}]`,
          getNumericKind(wireValue, index),
          undefined,
          codecOptions,
        ),
      );
    }

    const Type = resolveTypeInfo(info.type) ?? designType;
    if (Type && Type.prototype instanceof MessagePackObject) {
      return (Type as typeof MessagePackObject).createFromMsgPackObject(
        wireValue,
      );
    }

    if (Type === Date) {
      return new Date(
        typeof wireValue === 'bigint' ? Number(wireValue) : wireValue,
      );
    }

    if (info.intType) {
      if (isNonFiniteNumber(wireValue)) {
        return wireValue;
      }

      return coerceNumericWithPolicy(
        wireValue,
        info.intType,
        decodedKind,
        path,
        codecOptions.typeMismatchPolicy,
      );
    }

    if (decodedKind) {
      if (isNonFiniteNumber(wireValue)) {
        return wireValue;
      }

      return coerceKindedNumber(wireValue, decodedKind, path);
    }

    return wireValue;
  }

  protected static resolveJsonValue(
    wireValue: any,
    info: KeyOptions,
    path: string,
    designType?: TypeInfo,
  ): any {
    if (wireValue === null || wireValue === undefined) {
      return null;
    }

    if (info.generic && Array.isArray(info.generic)) {
      if (!Array.isArray(wireValue)) {
        return [];
      }

      const InnerType = resolveTypeInfo(info.generic[0]);
      const innerInfo: KeyOptions = {
        type: InnerType as any,
        intType: info.intType,
      };
      return wireValue.map((item, index) =>
        this.resolveJsonValue(item, innerInfo, `${path}[${index}]`),
      );
    }

    const Type = resolveTypeInfo(info.type) ?? designType;
    if (Type && Type.prototype instanceof MessagePackObject) {
      return (Type as typeof MessagePackObject).createFromJSON(wireValue);
    }

    if (Type === Date) {
      return new Date(wireValue);
    }

    if (info.intType) {
      if (isNonFiniteNumber(wireValue)) {
        return wireValue;
      }

      return coerceKindedNumber(wireValue, info.intType, path);
    }

    return wireValue;
  }
  //#endregion Internals
}
