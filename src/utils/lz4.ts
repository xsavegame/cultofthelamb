import * as lz4 from "lz4js";

export function lz4DecompressBlock(
  src: Uint8Array,
  uncompressedSize: number,
): Uint8Array<ArrayBuffer> {
  const dst = new Uint8Array(uncompressedSize);
  lz4.decompressBlock(src, dst, 0, src.length, 0);
  return dst;
}

export function lz4CompressBlock(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const bound = lz4.compressBound(src.length);
  const dst = new Uint8Array(bound);
  const hashTable = new Uint32Array(65536);
  const compressedSize = lz4.compressBlock(src, dst, 0, src.length, hashTable);
  return dst.subarray(0, compressedSize);
}
