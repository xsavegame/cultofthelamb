<template>
  <v-card class="mx-auto px-6">
    <v-card-title class="d-flex align-center px-0 pt-6">
      <span>{{ activeFollowerCollection.title }}</span>
      <v-spacer />
      <v-btn
        color="primary"
        size="small"
        variant="outlined"
        @click="createFollower"
      >
        Create Follower
      </v-btn>
    </v-card-title>
    <v-card-text class="px-0">
      <v-tabs
        v-model="followerCollection"
        class="mb-4"
        color="primary"
      >
        <v-tab
          v-for="collection in followerCollections"
          :key="collection.key"
          :value="collection.key"
        >
          {{ collection.tabLabel }}
        </v-tab>
      </v-tabs>

      <v-text-field
        v-model="search"
        class="mb-4"
        hide-details
        label="Search by ID or name"
        prepend-inner-icon="mdi-magnify"
        single-line
        variant="outlined"
      />

      <v-alert
        v-if="!hasFollowers"
        :text="activeFollowerCollection.emptyText"
        type="info"
        variant="tonal"
      />

      <v-row v-else>
        <v-col
          v-for="follower in filteredFollowers"
          :key="follower.ID"
          cols="12"
          lg="4"
          sm="6"
          xl="3"
        >
          <v-card
            variant="tonal"
          >
            <v-card-title
              class="cursor-pointer"
              @click="openFollowerDialog(follower.ID)"
            >
              {{ getFollowerName(follower) }}
            </v-card-title>
            <v-card-subtitle class="d-flex align-center">
              <span>ID: {{ follower.ID }}</span>
              <v-chip
                v-if="isUniqueFollowerId(follower.ID)"
                class="ml-2"
                color="warning"
                size="x-small"
                variant="tonal"
              >
                Unique
              </v-chip>
            </v-card-subtitle>
            <v-card-text>
              <FollowerThumbnailPreview
                :appearance="getFollowerAppearanceDraft(follower)"
                :height="160"
                lazy
              />
              <div class="mt-2">Level: {{ follower.XPLevel }}</div>
            </v-card-text>
            <v-card-actions>
              <v-btn
                color="primary"
                size="small"
                variant="text"
                @click="openFollowerDialog(follower.ID)"
              >
                Edit
              </v-btn>
              <v-spacer />
              <v-btn
                :color="moveActionColor"
                size="small"
                variant="text"
                @click.stop="moveFollowerLifecycle(follower.ID)"
              >
                {{ moveActionLabel }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col v-if="filteredFollowers.length === 0" cols="12">
          <v-alert
            text="No followers match your search."
            type="warning"
            variant="tonal"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <FollowerEditorDialog
    v-model="dialog"
    :cult-traits="dataStore.data?.CultTraits ?? null"
    :follower="selectedSourceFollower"
    :initial-draft="creatingFollowerDraft"
    @save="saveSelectedFollower"
  />
</template>

<script setup lang="ts">
  import type { DataManager } from '@/generated/classes'
  import type { FollowerAppearanceDraft, FollowerDraft } from '@/types/follower'
  import { computed, nextTick, ref, watch } from 'vue'
  import FollowerEditorDialog from '@/components/followers/FollowerEditorDialog.vue'
  import FollowerThumbnailPreview from '@/components/followers/FollowerThumbnailPreview.vue'
  import {
    applyFollowerAppearanceToFollower,
    createDefaultFollowerAppearance,
    getFollowerAppearanceFromFollower,
  } from '@/followers/appearance'
  import { FollowerInfo } from '@/generated/classes/FollowerInfo'
  import { UniqueFollowerIDs } from '@/manual/followers'
  import { useDataStore } from '@/stores/data'

  type FollowerCollectionKey = 'Followers' | 'Followers_Recruit' | 'Followers_Dead'

  type FollowerCollection = {
    key: FollowerCollectionKey
    tabLabel: string
    title: string
    emptyText: string
  }

  const dataStore = useDataStore()
  const uniqueFollowerIdSet = new Set<number>(UniqueFollowerIDs)

  const search = ref('')
  const dialog = ref(false)
  const followerCollection = ref<FollowerCollectionKey>('Followers')
  const selectedFollowerId = ref<number | null>(null)
  const creatingFollowerDraft = ref<FollowerDraft | null>(null)

  const followerCollections: FollowerCollection[] = [
    {
      key: 'Followers',
      tabLabel: 'Followers',
      title: 'Followers',
      emptyText: 'No followers found in this save file.',
    },
    {
      key: 'Followers_Recruit',
      tabLabel: 'Recruiting Followers',
      title: 'Recruiting Followers',
      emptyText: 'No recruiting followers found in this save file.',
    },
    {
      key: 'Followers_Dead',
      tabLabel: 'Dead Followers',
      title: 'Dead Followers',
      emptyText: 'No dead followers found in this save file.',
    },
  ]

  const activeFollowerCollection = computed(() => {
    return followerCollections.find(collection => collection.key === followerCollection.value) ?? followerCollections[0]
  })

  const sourceFollowers = computed(() => {
    const data = dataStore.data as DataManager | null
    if (!data) {
      return []
    }

    return data[followerCollection.value] ?? []
  })

  const hasFollowers = computed(() => sourceFollowers.value.length > 0)

  const isDeadCollection = computed(() => followerCollection.value === 'Followers_Dead')
  const moveActionLabel = computed(() => isDeadCollection.value ? 'Revive' : 'Move to Dead')
  const moveActionColor = computed(() => isDeadCollection.value ? 'success' : 'error')

  const selectedSourceFollower = computed(() => {
    if (creatingFollowerDraft.value) {
      return null
    }

    if (selectedFollowerId.value === null) {
      return null
    }

    return sourceFollowers.value.find(follower => follower.ID === selectedFollowerId.value) ?? null
  })

  const filteredFollowers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) {
      return sourceFollowers.value
    }

    return sourceFollowers.value.filter(follower => {
      const name = (follower._name ?? '').toLowerCase()
      return follower.ID.toString().includes(keyword) || name.includes(keyword)
    })
  })

  watch(followerCollection, () => {
    dialog.value = false
    selectedFollowerId.value = null
    creatingFollowerDraft.value = null
    search.value = ''
  })

  watch(dialog, isOpen => {
    if (!isOpen) {
      selectedFollowerId.value = null
      creatingFollowerDraft.value = null
    }
  })

  function getFollowerName (follower: Pick<FollowerInfo, 'ID' | '_name'>): string {
    const name = (follower._name ?? '').trim()
    return name || `Follower ${follower.ID}`
  }

  function openFollowerDialog (id: number) {
    creatingFollowerDraft.value = null
    selectedFollowerId.value = id
    dialog.value = true
  }

  function saveSelectedFollower (draft: FollowerDraft) {
    if (creatingFollowerDraft.value) {
      saveNewFollower(draft)
      return
    }

    if (!selectedSourceFollower.value) {
      return
    }

    patchFollower(selectedSourceFollower.value, draft)
  }

  function patchFollower (source: FollowerInfo, draft: FollowerDraft) {
    source._name = draft._name.trim() === '' ? null : draft._name.trim()
    source.XPLevel = draft.XPLevel
    source.Age = draft.Age
    source.LifeExpectancy = draft.LifeExpectancy
    source.FollowerRole = draft.FollowerRole
    source.CurrentOverrideTaskType = draft.CurrentOverrideTaskType
    source.Location = draft.Location
    source.Adoration = draft.Adoration
    source._happiness = draft._happiness
    source._faith = draft._faith
    source._satiation = draft._satiation
    source._starvation = draft._starvation
    source.Traits = draft.Traits.length > 0 ? [...draft.Traits] : []
    applyFollowerAppearanceToFollower(source, draft)
  }

  function createFollower () {
    followerCollection.value = 'Followers'
    search.value = ''
    selectedFollowerId.value = null
    creatingFollowerDraft.value = createEmptyFollowerDraft()

    void nextTick(() => {
      dialog.value = true
    })
  }

  function moveFollowerLifecycle (id: number) {
    if (!dataStore.data) {
      return
    }

    if (isDeadCollection.value) {
      moveFollowerBetweenCollections('Followers_Dead', 'Followers', id)
    } else {
      moveFollowerBetweenCollections(followerCollection.value, 'Followers_Dead', id)
    }
  }

  function moveFollowerBetweenCollections (
    fromKey: FollowerCollectionKey,
    toKey: FollowerCollectionKey,
    id: number,
  ) {
    const data = dataStore.data
    if (!data) {
      return
    }

    const fromCollection = ensureFollowerCollection(data, fromKey)
    const followerIndex = fromCollection.findIndex(follower => follower.ID === id)
    if (followerIndex === -1) {
      return
    }

    const [follower] = fromCollection.splice(followerIndex, 1)
    if (!follower) {
      return
    }

    const toCollection = ensureFollowerCollection(data, toKey)
    if (!toCollection.some(item => item.ID === follower.ID)) {
      toCollection.push(follower)
    }

    syncDeadFollowerIds(data)

    if (selectedFollowerId.value === id) {
      dialog.value = false
      selectedFollowerId.value = null
    }
  }

  function ensureFollowerCollection (
    data: DataManager,
    key: FollowerCollectionKey,
  ): FollowerInfo[] {
    const collection = data[key]
    if (!collection) {
      data[key] = []
      return data[key] as FollowerInfo[]
    }

    return collection as FollowerInfo[]
  }

  function syncDeadFollowerIds (data: DataManager) {
    data.Followers_Dead_IDs = (data.Followers_Dead ?? []).map(follower => follower.ID)
  }

  function saveNewFollower (draft: FollowerDraft) {
    const data = dataStore.data
    if (!data) {
      return
    }

    const newFollowerId = generateFollowerId(data)
    const follower = new FollowerInfo()
    follower.ID = newFollowerId
    patchFollower(follower, draft)
    setFollowerAliveState(follower)

    const aliveFollowers = ensureFollowerCollection(data, 'Followers')
    aliveFollowers.push(follower)
    syncDeadFollowerIds(data)

    creatingFollowerDraft.value = null
    selectedFollowerId.value = newFollowerId
    dialog.value = false
  }

  function createEmptyFollowerDraft (): FollowerDraft {
    const defaultAppearance = createDefaultFollowerAppearance()

    return {
      ID: 0,
      _name: '',
      XPLevel: 0,
      Age: 0,
      LifeExpectancy: 0,
      FollowerRole: 0,
      CurrentOverrideTaskType: 0,
      Location: 0,
      Adoration: 0,
      _happiness: 0,
      _faith: 0,
      _satiation: 0,
      _starvation: 0,
      Traits: [],
      ...defaultAppearance,
    }
  }

  function generateFollowerId (data: DataManager): number {
    const uniqueIdSet = new Set<number>(UniqueFollowerIDs)
    const usedIdSet = new Set<number>()

    for (const follower of data.Followers ?? []) {
      usedIdSet.add(follower.ID)
    }
    for (const follower of data.Followers_Recruit ?? []) {
      usedIdSet.add(follower.ID)
    }
    for (const follower of data.Followers_Dead ?? []) {
      usedIdSet.add(follower.ID)
    }

    let nextId = (data.FollowerID ?? 0) + 1
    while (uniqueIdSet.has(nextId) || usedIdSet.has(nextId)) {
      nextId += 1
    }

    data.FollowerID = nextId
    return nextId
  }

  function setFollowerAliveState (follower: FollowerInfo) {
    follower.LeavingCult = false
    follower.LeftCultDay = 0
    follower.TimeOfDeath = 0
    follower.HasBeenBuried = false
    follower.DiedOfIllness = false
    follower.DiedOfInjury = false
    follower.DiedOfOldAge = false
    follower.DiedOfStarvation = false
    follower.FrozeToDeath = false
    follower.DiedFromRot = false
    follower.DiedFromTwitchChat = false
    follower.DiedInPrison = false
    follower.DiedFromMurder = false
    follower.DiedFromDeadlyDish = false
    follower.DiedFromMissionary = false
    follower.DiedFromLightning = false
    follower.DiedFromOverheating = false
    follower.BurntToDeath = false
    follower.Traits = follower.Traits ? [...new Set(follower.Traits)] : []
  }

  function isUniqueFollowerId (id: number): boolean {
    return uniqueFollowerIdSet.has(id)
  }

  function getFollowerAppearanceDraft (follower: FollowerInfo): FollowerAppearanceDraft {
    return getFollowerAppearanceFromFollower(follower)
  }
</script>
