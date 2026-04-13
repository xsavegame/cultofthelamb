import { Key, MessagePackObject } from './MessagePackBase';

export class Vector2 extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'f32' })
  public x!: number;
  @Key(1, { intType: 'f32' })
  public y!: number;
}

export class Vector3 extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'f32' })
  public x!: number;
  @Key(1, { intType: 'f32' })
  public y!: number;
  @Key(2, { intType: 'f32' })
  public z!: number;
}

export class Vector2Int extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'i32' })
  public x!: number;
  @Key(1, { intType: 'i32' })
  public y!: number;
}

export class Vector3Int extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'i32' })
  public x!: number;
  @Key(1, { intType: 'i32' })
  public y!: number;
  @Key(2, { intType: 'i32' })
  public z!: number;
}

export class Bounds extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0)
  public center!: Vector3;
  @Key(1)
  public size!: Vector3;
}

export class Quaternion extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'f32' })
  public x!: number;
  @Key(1, { intType: 'f32' })
  public y!: number;
  @Key(2, { intType: 'f32' })
  public z!: number;
  @Key(3, { intType: 'f32' })
  public w!: number;
}

export class Color extends MessagePackObject {
  protected static _isMapMode = false;
  @Key(0, { intType: 'u8' })
  public r!: number;
  @Key(1, { intType: 'u8' })
  public g!: number;
  @Key(2, { intType: 'u8' })
  public b!: number;
  @Key(3, { intType: 'u8' })
  public a!: number;
}
