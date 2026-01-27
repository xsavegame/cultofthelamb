import { defineStore } from 'pinia';
import type { Follower, JsonSaveFile } from '~/types/save';
import { decodeMpSave, encodeMpSave, isDecryptedMp } from '~/utils/mp-codec';

export type SaveFormat = 'json' | 'mp';

export const useSaveData = defineStore('saveData', () => {
  const saveData = useState<JsonSaveFile>();
  const fileData = useState<{ name: string; encrypted: boolean; format: SaveFormat }>();
  // Preserved raw MP array for round-trip fidelity (only set for .mp files)
  const mpRawArray = useState<any[] | null>();

  const setSaveData = (newSaveData: any) => {
    saveData.value = newSaveData;
  };

  const setFileData = (newFileData: { name: string; encrypted: boolean; format: SaveFormat }) => {
    fileData.value = newFileData;
  };

  async function decryptData(data: Uint8Array): Promise<Uint8Array> {
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      data.subarray(1, 17),
      { name: 'AES-CBC', length: 128 },
      false,
      ['decrypt']
    );
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: data.subarray(17, 33) },
      aesKey,
      data.subarray(33)
    );
    return new Uint8Array(decrypted);
  }

  async function encryptData(data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await window.crypto.subtle.generateKey(
      { name: 'AES-CBC', length: 128 },
      true,
      ['encrypt']
    );
    const key = await window.crypto.subtle.exportKey('raw', cryptoKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      data
    );
    const result = new Uint8Array(1 + key.byteLength + iv.byteLength + encrypted.byteLength);
    result.set([69]); // 'E'
    result.set(new Uint8Array(key), 1);
    result.set(iv, 1 + key.byteLength);
    result.set(new Uint8Array(encrypted), 1 + key.byteLength + iv.byteLength);
    return result;
  }

  const importSave = async (data: Uint8Array) => {
    const isEncrypted = data[0] === 69;
    const decrypted = isEncrypted ? await decryptData(data) : data;

    if (isDecryptedMp(decrypted)) {
      const result = decodeMpSave(decrypted);
      mpRawArray.value = result.rawArray;
      setSaveData(result.data);
    } else {
      mpRawArray.value = null;
      setSaveData(JSON.parse(new TextDecoder().decode(decrypted)));
    }
  };

  const exportSave = async (encrypt = true): Promise<Uint8Array> => {
    if (!saveData.value) return new Uint8Array();

    const format = fileData.value?.format ?? 'json';
    let payload: Uint8Array;

    if (format === 'mp') {
      payload = encodeMpSave(saveData.value as any, mpRawArray.value ?? undefined);
    } else {
      payload = new TextEncoder().encode(JSON.stringify(saveData.value));
    }

    if (encrypt) {
      return encryptData(payload);
    }
    return payload;
  };

  const setByPath = function (path: string, value: any): void {
    const paths = path.split('.');
    let obj: any = saveData.value;

    for (const key of paths.slice(0, -1)) {
      obj = getPropertyCaseInsensitive(obj, key);
    }

    setPropertyCaseInsensitive(obj, paths[paths.length - 1], value);
  };

  const checkCultTraits = (
    follower?: JsonSaveFile['Followers'][0]['ID'] | null
  ) => {
    if (!saveData.value) return;

    const cultTraits = getPropertyCaseInsensitive(saveData.value, 'CultTraits');
    if (!cultTraits) return;

    const fullFollowers = getPropertyCaseInsensitive(
      saveData.value,
      'Followers'
    );

    if (!fullFollowers) return;

    let followerObjects = fullFollowers;

    if (follower) {
      followerObjects = followerObjects.filter(
        (f: any) => getPropertyCaseInsensitive(f, 'ID') === follower
      );
    }

    for (const follower of followerObjects) {
      const followerTraits = getPropertyCaseInsensitive(follower, 'Traits');
      if (!followerTraits) {
        continue;
      }

      cultTraits.forEach((trait: any) => {
        const index = followerTraits.indexOf(trait);
        if (index !== -1) {
          followerTraits.splice(index, 1);
          console.log(
            'Removed trait %d from follower %d due to cult traits',
            trait,
            follower.ID
          );
        }
      });
    }
  };

  return {
    saveData,
    fileData,
    mpRawArray,
    importSave,
    exportSave,
    setSaveData,
    setFileData,
    setByPath,
    checkCultTraits,
  };
});
