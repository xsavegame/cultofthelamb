import { DataManager, type MsgPackCodecOptions } from '@/generated/classes';
import * as msgpack from '@msgpack/msgpack';
import { lz4DecompressBlock, lz4CompressBlock } from './lz4';

export enum FileType {
  Json,
  MsgPack,
}

function encodeMulti(items: any[]): Uint8Array<ArrayBuffer> {
  return items.reduce((acc, item) => {
    const encoded = msgpack.encode(item);
    const merged = new Uint8Array(acc.length + encoded.length);
    merged.set(acc);
    merged.set(encoded, acc.length);
    return merged;
  }, new Uint8Array(0));
}

export function chunk<T extends Uint8Array>(data: T, size: number): T[] {
  const chunks: T[] = [];
  let pos = 0;
  while (pos < data.length) {
    const blockSize = Math.min(size, data.length - pos);
    const block = data.subarray(pos, pos + blockSize);
    chunks.push(block as T);
    pos += blockSize;
  }
  return chunks;
}

// export async function readSaveFile(file: File) {
//   const data = await file.arrayBuffer();
//   return readSaveBuffer(
//     new Uint8Array(data),
//     file.name.endsWith(".json") ? FileType.Json : FileType.MsgPack,
//   );
// }

// async function readEncryptedSave(
//   data: Uint8Array<ArrayBuffer>,
//   _fileType: FileType,
// ) {
//   const aesKey = await window.crypto.subtle.importKey(
//     "raw",
//     data.subarray(1, 17),
//     {
//       name: "AES-CBC",
//       length: 128,
//     },
//     false,
//     ["decrypt"],
//   );

//   const decrpytedData = await window.crypto.subtle.decrypt(
//     {
//       name: "AES-CBC",
//       iv: data.subarray(17, 33),
//     },
//     aesKey,
//     data.subarray(33),
//   );

//   return new Uint8Array(decrpytedData);
// }

// async function readAsJson(data: Uint8Array<ArrayBuffer>) {
//   const json = JSON.parse(new TextDecoder().decode(data));
//   return DataManager.createFromJSON(json);
// }

// async function readAsMsgPack(data: Uint8Array<ArrayBuffer>) {
//   // try to decode
//   const decoded = msgpack.decode(data);

//   if (Array.isArray(decoded) && decoded[0] instanceof msgpack.ExtData) {
//     const extData = decoded[0] as msgpack.ExtData;
//     const headerGenerator = msgpack.decodeMulti(extData.data as Uint8Array);
//     const headers = Array.from(headerGenerator) as number[];

//     const compressedBody = decoded.slice(1) as Uint8Array[];
//     const decompressedBody: Uint8Array[] = [];
//     for (let i = 0; i < compressedBody.length; i++) {
//       const compressedData = compressedBody[i];
//       const decompressedLength = headers[i];
//       const decompressedData = lz4DecompressBlock(
//         compressedData,
//         decompressedLength,
//       )) as Uint8Array;
//       decompressedBody.push(decompressedData);
//     }

//     // Combine all decompressed blocks into a single Uint8Array
//     const decompressedMessage = decompressedBody.reduce((acc, curr) => {
//       const combined = new Uint8Array(acc.length + curr.length);
//       combined.set(acc);
//       combined.set(curr, acc.length);
//       return combined;
//     }, new Uint8Array());

//     return DataManager.decodeMsgPack(decompressedMessage);
//   }

//   return DataManager.createFromMsgPackObject(decoded);
// }

// export async function readSaveBuffer(
//   data: Uint8Array<ArrayBuffer>,
//   fileType: FileType,
// ): Promise<DataManager | null> {
//   if (data[0] === 69) {
//     data = await readEncryptedSave(data, fileType);
//   }

//   if (fileType === FileType.Json) {
//     return readAsJson(data);
//   }

//   return readAsMsgPack(data);
// }

export type CryptoOption = {
  key: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
};

export abstract class FileEncoder<T = DataManager> {
  constructor(
    protected data: T,
    protected shouldEncrypt = true,
    protected cryptoOption?: CryptoOption,
    protected codecOptions?: MsgPackCodecOptions,
  ) {}

  abstract encode(): Promise<Uint8Array<ArrayBuffer>>;

  async toFile(): Promise<Uint8Array<ArrayBuffer>> {
    const data = await this.encode();
    if (this.shouldEncrypt) {
      const result = await this.encrypt(data);

      // 69 + key + iv + encryptedData
      const fileData = new Uint8Array(1 + 16 + 16 + result.data.length);
      fileData.set([69]);
      fileData.set(result.cryptoOption.key, 1);
      fileData.set(result.cryptoOption.iv, 17);
      fileData.set(result.data, 33);
      return fileData;
    }
    return data;
  }

  protected static async generateCryptoOption(): Promise<CryptoOption> {
    const cryptoKey = await window.crypto.subtle.generateKey(
      { name: 'AES-CBC', length: 128 },
      true,
      ['encrypt'],
    );
    const key = await window.crypto.subtle.exportKey('raw', cryptoKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    return {
      key: new Uint8Array(key),
      iv,
    };
  }

  protected async encrypt(
    data: Uint8Array<ArrayBuffer>,
  ): Promise<{ data: Uint8Array<ArrayBuffer>; cryptoOption: CryptoOption }> {
    const cryptoOption =
      this.cryptoOption ??
      (await (this.constructor as any).generateCryptoOption());

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      cryptoOption.key,
      {
        name: 'AES-CBC',
        length: 128,
      },
      false,
      ['encrypt'],
    );

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv: cryptoOption.iv,
      },
      cryptoKey,
      data,
    );

    return { data: new Uint8Array(encryptedData), cryptoOption };
  }
}

export abstract class FileDecoder<T = DataManager> {
  protected isDataEncrypted = false;
  protected fileType: FileType = FileType.MsgPack;

  constructor(
    protected data: Uint8Array<ArrayBuffer>,
    protected cryptoOption?: CryptoOption,
    protected codecOptions?: MsgPackCodecOptions,
  ) {
    this.init();
  }

  public isEncrypted(): boolean {
    return this.isDataEncrypted;
  }

  public getFileType(): FileType {
    return this.fileType;
  }

  protected init() {
    this.isDataEncrypted = this.data[0] === 69;

    if (!this.cryptoOption && this.isDataEncrypted) {
      this.cryptoOption = {
        key: this.data.subarray(1, 17),
        iv: this.data.subarray(17, 33),
      };

      this.data = this.data.subarray(33);
    }
  }

  protected async decrypt(): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.cryptoOption) {
      return this.data;
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      this.cryptoOption!.key,
      {
        name: 'AES-CBC',
        length: 128,
      },
      false,
      ['decrypt'],
    );

    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: this.cryptoOption.iv,
      },
      cryptoKey,
      this.data,
    );

    return new Uint8Array(decryptedData);
  }

  public async toObject(): Promise<T | null> {
    if (this.cryptoOption) {
      return this.decode(await this.decrypt());
    }

    return this.decode(this.data);
  }

  abstract decode(data: Uint8Array<ArrayBuffer>): Promise<T | null>;

  static async fromFile<T extends FileDecoder>(
    this: new (
      data: Uint8Array<ArrayBuffer>,
      cryptoOption?: CryptoOption,
      codecOptions?: MsgPackCodecOptions,
    ) => T,
    data: Uint8Array<ArrayBuffer>,
    cryptoOption?: CryptoOption,
    codecOptions?: MsgPackCodecOptions,
  ): Promise<T> {
    if (data[0] === 69) {
      return new this(data.subarray(33), {
        key: data.subarray(1, 17),
        iv: data.subarray(17, 33),
      }, codecOptions);
    }

    return new this(data, cryptoOption, codecOptions);
  }
}

export class JsonFileEncoder extends FileEncoder<DataManager> {
  protected fileType = FileType.Json;

  async encode(): Promise<Uint8Array<ArrayBuffer>> {
    return new TextEncoder().encode(JSON.stringify(this.data));
  }
}

export class JsonFileDecoder extends FileDecoder<DataManager> {
  async decode(data: Uint8Array<ArrayBuffer>): Promise<DataManager | null> {
    const json = JSON.parse(new TextDecoder().decode(data));
    return DataManager.createFromJSON(json);
  }
}

export class MsgPackFileEncoder extends FileEncoder<DataManager> {
  protected fileType = FileType.MsgPack;
  protected static MAX_BLOCK_SIZE = 32768;
  protected static EXT_TYPE = 98;

  async encode(): Promise<Uint8Array<ArrayBuffer>> {
    const innerBytes = await this.data.encodeMsgPack(this.codecOptions);

    const blocks: Uint8Array[] = [];
    const sizes: number[] = [];
    let pos = 0;

    while (pos < innerBytes.length) {
      const blockSize = Math.min(
        MsgPackFileEncoder.MAX_BLOCK_SIZE,
        innerBytes.length - pos,
      );
      const block = innerBytes.subarray(pos, pos + blockSize);
      blocks.push(block);
      sizes.push(blockSize);
      pos += blockSize;
    }

    const compressedBlocks: Uint8Array[] = [];
    for (const block of blocks) {
      compressedBlocks.push(lz4CompressBlock(block));
    }

    const headerBytes = encodeMulti(sizes);

    const extHeader = new msgpack.ExtData(
      MsgPackFileEncoder.EXT_TYPE,
      headerBytes,
    );

    const outerArray: any[] = [extHeader, ...compressedBlocks];
    return msgpack.encode(outerArray);
  }
}

export class MsgPackFileDecoder extends FileDecoder<DataManager> {
  async decode(data: Uint8Array<ArrayBuffer>): Promise<DataManager | null> {
    const decoded = msgpack.decode(data);

    if (Array.isArray(decoded) && decoded[0] instanceof msgpack.ExtData) {
      if (decoded[0].type !== 98) {
        throw new Error('Invalid file format');
      }

      const extData = decoded[0] as msgpack.ExtData;
      const headerData =
        extData.data instanceof Uint8Array ? extData.data : extData.data(0);
      const headerInfo = msgpack.decodeMulti(headerData) as Generator<number>;

      const decompressedBody: Uint8Array[] = [];
      for (const compressedData of decoded.slice(1) as Uint8Array[]) {
        const decompressedData = lz4DecompressBlock(
          compressedData,
          headerInfo.next().value!,
        );
        decompressedBody.push(decompressedData);
      }

      const decompressedMessage = decompressedBody.reduce((acc, curr) => {
        const combined = new Uint8Array(acc.length + curr.length);
        combined.set(acc);
        combined.set(curr, acc.length);
        return combined;
      }, new Uint8Array());

      return DataManager.decodeMsgPack(decompressedMessage, this.codecOptions);
    }

    return DataManager.decodeMsgPack(data, this.codecOptions);
  }
}

export async function createDecoder(
  file: ArrayBuffer | Uint8Array,
  fileType: FileType,
  codecOptions?: MsgPackCodecOptions,
): Promise<FileDecoder>;
export async function createDecoder(
  file: File,
  fileType?: FileType,
  codecOptions?: MsgPackCodecOptions,
): Promise<FileDecoder>;

export async function createDecoder(
  file: File | ArrayBuffer | Uint8Array,
  fileType?: FileType,
  codecOptions?: MsgPackCodecOptions,
): Promise<FileDecoder> {
  let data: Uint8Array;
  if (file instanceof File) {
    data = new Uint8Array(await file.arrayBuffer());
    if (!fileType) {
      fileType = file.name.endsWith('.json') ? FileType.Json : FileType.MsgPack;
    }
  } else if (file instanceof ArrayBuffer) {
    data = new Uint8Array(file);
  } else {
    data = file;
  }

  if (fileType === undefined || fileType === null) {
    throw new Error('File type not specified');
  }

  const dataView = new Uint8Array(data);

  if (fileType === FileType.Json) {
    return new JsonFileDecoder(dataView, undefined, codecOptions);
  }

  return new MsgPackFileDecoder(dataView, undefined, codecOptions);
}

export async function createEncoder(
  fileOrFileName: File | string,
  data: DataManager,
  shouldEncrypt = true,
  codecOptions?: MsgPackCodecOptions,
): Promise<FileEncoder> {
  const fileName =
    typeof fileOrFileName === 'string' ? fileOrFileName : fileOrFileName.name;

  if (fileName.endsWith('.json')) {
    return new JsonFileEncoder(data, shouldEncrypt, undefined, codecOptions);
  }

  return new MsgPackFileEncoder(data, shouldEncrypt, undefined, codecOptions);
}
