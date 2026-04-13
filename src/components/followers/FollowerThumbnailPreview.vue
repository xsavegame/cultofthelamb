<template>
  <div
    ref="rootElement"
    class="follower-thumbnail-preview"
    :style="hostStyle"
  >
    <img
      v-if="imageUrl && !errorMessage && !missingAssetsMessage"
      alt="Follower thumbnail"
      class="follower-thumbnail-preview__image"
      :src="imageUrl"
    >
    <div
      v-if="(isLoading || !imageUrl) && !errorMessage && !missingAssetsMessage"
      class="follower-thumbnail-preview__loading"
    >
      <v-skeleton-loader
        class="follower-thumbnail-preview__skeleton"
        type="image"
      />
    </div>
    <div
      v-if="missingAssetsMessage"
      class="follower-thumbnail-preview__placeholder"
    >
      <v-icon
        icon="mdi-folder-alert-outline"
        size="20"
      />
      <div class="follower-thumbnail-preview__placeholder-title">
        Missing Generated Assets
      </div>
      <div class="follower-thumbnail-preview__placeholder-text">
        {{ missingAssetsMessage }}
      </div>
    </div>
    <div
      v-else-if="errorMessage"
      class="follower-thumbnail-preview__error"
    >
      <v-icon
        icon="mdi-alert-circle-outline"
        size="18"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { FollowerAppearanceDraft } from '@/types/follower'
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    getMissingFollowerAssetsMessage,
    isMissingFollowerAssetsError,
  } from '@/followers/spine-resource'
  import { getFollowerThumbnail } from '@/followers/thumbnail-renderer'

  const props = withDefaults(defineProps<{
    appearance: FollowerAppearanceDraft
    height?: number
    lazy?: boolean
    cacheKeyExtra?: string | number | null
  }>(), {
    height: 160,
    lazy: true,
    cacheKeyExtra: null,
  })

  const rootElement = ref<HTMLElement | null>(null)
  const isVisible = ref(!props.lazy)
  const targetWidth = ref(0)
  const imageUrl = ref<string | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)
  const missingAssetsMessage = ref<string | null>(null)

  const hostStyle = computed(() => {
    return {
      height: `${props.height}px`,
    }
  })

  const appearanceSignature = computed(() => {
    return [
      props.appearance.AppearanceSkin,
      props.appearance.AppearanceClothingType,
      props.appearance.AppearanceClothingVariantIndex,
      props.appearance.AppearanceFormColorIndex,
      props.appearance.AppearanceClothingColorIndex,
      targetWidth.value,
      props.height,
      props.cacheKeyExtra ?? '',
    ].join('|')
  })

  let visibilityObserver: IntersectionObserver | null = null
  let resizeObserver: ResizeObserver | null = null
  let requestToken = 0

  function updateTargetWidth () {
    const width = Math.max(1, Math.round(rootElement.value?.clientWidth ?? 0))
    if (width !== targetWidth.value) {
      targetWidth.value = width
    }
  }

  async function requestThumbnailIfNeeded () {
    if (!isVisible.value) {
      return
    }

    updateTargetWidth()
    if (targetWidth.value <= 0) {
      return
    }

    const missingMessage = getMissingFollowerAssetsMessage()
    if (missingMessage) {
      missingAssetsMessage.value = missingMessage
      errorMessage.value = null
      isLoading.value = false
      return
    }

    const token = ++requestToken
    isLoading.value = true
    errorMessage.value = null
    missingAssetsMessage.value = null

    try {
      const thumbnailUrl = await getFollowerThumbnail({
        appearance: props.appearance,
        width: targetWidth.value,
        height: props.height,
        fitMode: 'list',
        pose: 'setup',
        cacheKeyExtra: props.cacheKeyExtra,
      })

      if (token !== requestToken) {
        return
      }

      imageUrl.value = thumbnailUrl
      missingAssetsMessage.value = null
    } catch (error) {
      if (token !== requestToken) {
        return
      }

      if (isMissingFollowerAssetsError(error)) {
        missingAssetsMessage.value = error.message
        errorMessage.value = null
        return
      }

      missingAssetsMessage.value = null
      errorMessage.value = error instanceof Error ? error.message : `${error}`
    } finally {
      if (token === requestToken) {
        isLoading.value = false
      }
    }
  }

  function setupVisibilityObserver () {
    if (!props.lazy || !rootElement.value || visibilityObserver) {
      return
    }

    visibilityObserver = new IntersectionObserver(entries => {
      const isIntersecting = entries.some(entry => entry.isIntersecting)
      isVisible.value = isIntersecting
    }, {
      threshold: 0.1,
    })

    visibilityObserver.observe(rootElement.value)
  }

  function setupResizeObserver () {
    if (!rootElement.value || resizeObserver) {
      return
    }

    resizeObserver = new ResizeObserver(() => {
      updateTargetWidth()
      if (isVisible.value) {
        void requestThumbnailIfNeeded()
      }
    })

    resizeObserver.observe(rootElement.value)
    updateTargetWidth()
  }

  watch(isVisible, visible => {
    if (!visible) {
      return
    }

    void requestThumbnailIfNeeded()
  }, { immediate: true })

  watch(appearanceSignature, () => {
    if (!isVisible.value) {
      return
    }

    void requestThumbnailIfNeeded()
  })

  onMounted(() => {
    setupResizeObserver()
    setupVisibilityObserver()

    if (!props.lazy) {
      isVisible.value = true
      void requestThumbnailIfNeeded()
    }
  })

  onBeforeUnmount(() => {
    requestToken += 1

    if (visibilityObserver) {
      visibilityObserver.disconnect()
      visibilityObserver = null
    }

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  })
</script>

<style scoped>
  .follower-thumbnail-preview {
    position: relative;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: radial-gradient(circle at 30% 20%, rgb(62 102 71 / 26%) 0%, rgb(16 24 20 / 65%) 85%);
  }

  .follower-thumbnail-preview__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center center;
  }

  .follower-thumbnail-preview__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  .follower-thumbnail-preview__skeleton {
    width: 100%;
    height: 100%;
  }

  .follower-thumbnail-preview__error {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    color: rgb(var(--v-theme-error));
    background: rgb(var(--v-theme-surface));
    border-radius: 999px;
    padding: 2px;
  }

  .follower-thumbnail-preview__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    text-align: center;
    background: rgb(10 18 14 / 82%);
    color: rgb(236 244 238);
  }

  .follower-thumbnail-preview__placeholder-title {
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .follower-thumbnail-preview__placeholder-text {
    font-size: 0.64rem;
    line-height: 1.25;
    max-height: 4.6em;
    overflow: hidden;
  }
</style>
