declare module 'lz4js' {
  export function compressBound(inputSize: number): number;
  export function decompressBound(inputSize: number): number;
  export function makeBuffer(size: number): Uint8Array;
  export function decompressBlock(
    src: Uint8Array,
    dst: Uint8Array,
    sIndex: number,
    sLength: number,
    dIndex: number
  ): number;
  export function compressBlock(
    src: Uint8Array,
    dst: Uint8Array,
    sIndex: number,
    sLength: number,
    hashTable: Uint32Array
  ): number;
  export function compress(data: Uint8Array | number[], maxSize?: number): Uint8Array;
  export function decompress(data: Uint8Array | number[], maxSize?: number): Uint8Array;
}
