import { DataManager } from '@/generated/classes';
import { defineStore, type StoreDefinition } from 'pinia';
import { computed, ref, type ComputedRef, type Ref } from 'vue';

type Store = StoreDefinition<
  'data',
  {
    data: Ref<DataManager | null>;
    isWoolHavenUnlocked: ComputedRef<boolean>;
  },
  {},
  {}
>;

// export const generateComputed = <TVal = any>(
//   reactiveData: any,
//   key: string,
// ) => {
//   const keys = key.split(".");

//   if (keys.some((k) => k.length === 0)) {
//     throw new Error(`Invalid key: ${key}`);
//   }

//   return computed<TVal, TVal>({
//     get() {
//       let returnValue: any = reactiveData;
//       for (const k of keys) {
//         if (returnValue instanceof MessagePackObject) {
//           returnValue = returnValue.getOrDefault(k as any);
//         } else {
//           returnValue = returnValue?.[k] ?? null;
//         }
//       }

//       return returnValue;
//     },
//     set(value: TVal) {
//       let currentData: any = reactiveData;
//       for (const k of keys.slice(0, -1)) {
//         if (currentData instanceof MessagePackObject) {
//           currentData = currentData.getOrDefault(k as any);
//         } else {
//           currentData = currentData?.[k] ?? null;
//         }
//       }

//       currentData[keys.slice(-1)[0]!] = value;
//     },
//   });
// };

export const useDataStore: Store = defineStore('data', function () {
  const data = ref<DataManager | null>(null);
  const isWoolHavenUnlocked = computed(() => {
    return data.value?.MAJOR_DLC ?? false;
  });

  return {
    data,
    isWoolHavenUnlocked,
  };
}) as Store;
