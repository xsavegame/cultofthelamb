<template>
  <div ref="rootElement" class="follower-spine-preview">
    <div ref="playerHostElement" class="follower-spine-preview__host" :style="hostStyle" />
    <div v-if="missingAssetsMessage" class="follower-spine-preview__placeholder">
      <v-icon icon="mdi-folder-alert-outline" size="24" />
      <div class="follower-spine-preview__placeholder-title">
        Missing Generated Assets
      </div>
      <div class="follower-spine-preview__placeholder-text">
        {{ missingAssetsMessage }}
      </div>
    </div>
    <div v-else-if="isLoading" class="follower-spine-preview__loading">
      <v-skeleton-loader class="follower-spine-preview__skeleton" type="image" />
    </div>
    <div v-else-if="errorMessage" class="follower-spine-preview__error">
      <v-icon icon="mdi-alert-circle-outline" size="18" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FollowerAppearanceDraft } from '@/types/follower'
import { type Spine, Spine as SpineView } from '@pixi-spine/all-3.8'
import { Application } from 'pixi.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  type FollowerAppearanceCatalog,
  loadFollowerAppearanceCatalog,
} from '@/followers/appearance-catalog'
import {
  applyFollowerAppearanceToSpine,
  fitFollowerSpineToRenderer,
} from '@/followers/spine-appearance'
import {
  getMissingFollowerAssetsMessage,
  isMissingFollowerAssetsError,
  loadFollowerSpineResource,
} from '@/followers/spine-resource'

type PreviewScene = {
  app: Application
  spine: Spine
  resizeObserver: ResizeObserver | null
}

const props = withDefaults(defineProps<{
  appearance: FollowerAppearanceDraft
  height?: number
  animation?: string
  lazy?: boolean
  paused?: boolean
}>(), {
  height: 180,
  animation: 'idle',
  lazy: false,
  paused: false,
})

const rootElement = ref<HTMLElement | null>(null)
const playerHostElement = ref<HTMLElement | null>(null)
const isVisible = ref(!props.lazy)
const isLoading = ref(true)
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
    props.animation,
    props.paused ? 1 : 0,
  ].join('|')
})

let previewScene: PreviewScene | null = null
let visibilityObserver: IntersectionObserver | null = null
let appearanceCatalog: FollowerAppearanceCatalog | null = null
let appearanceCatalogPromise: Promise<FollowerAppearanceCatalog> | null = null
let isInitializing = false

function resizeSceneRenderer(
  scene: PreviewScene,
  width: number,
  height: number,
) {
  const nextWidth = Math.max(1, Math.round(width))
  const nextHeight = Math.max(1, Math.round(height))
  scene.app.renderer.resize(nextWidth, nextHeight)
}

function fitSceneSpine(
  scene: PreviewScene,
) {
  fitFollowerSpineToRenderer(
    scene.spine,
    scene.app.renderer.width,
    scene.app.renderer.height,
    {
      targetWidthRatio: 0.2,
      targetHeightRatio: 0.2,
      anchorY: 0.4,
      anchorX: 0.3,
      fallbackY: 0,
    },
  )
}

function updatePlaybackState() {
  if (!previewScene) {
    return
  }

  if (props.paused) {
    previewScene.spine.autoUpdate = false
    previewScene.app.stop()
    previewScene.spine.update(0)
    previewScene.app.render()
    return
  }

  previewScene.spine.autoUpdate = true
  previewScene.app.start()
}

function applyAppearanceToScene() {
  if (!previewScene || !appearanceCatalog) {
    return
  }

  // Fit using setup pose first so bounds are stable and not tied to a potentially narrow animation frame.
  applyFollowerAppearanceToSpine(
    previewScene.spine,
    appearanceCatalog,
    props.appearance,
    {
      animation: null,
      fallbackAnimations: [],
      loop: false,
    },
  )

  fitSceneSpine(previewScene)

  applyFollowerAppearanceToSpine(
    previewScene.spine,
    appearanceCatalog,
    props.appearance,
    {
      animation: props.animation,
      loop: true,
    },
  )

  updatePlaybackState()
}

function setupSceneResizeObserver(
  scene: PreviewScene,
  host: HTMLElement,
) {
  const observer = new ResizeObserver(entries => {
    const entry = entries[0]
    if (!entry) {
      return
    }

    resizeSceneRenderer(
      scene,
      entry.contentRect.width,
      entry.contentRect.height,
    )
    fitSceneSpine(scene)

    if (props.paused) {
      scene.app.render()
    }
  })

  observer.observe(host)
  scene.resizeObserver = observer

  resizeSceneRenderer(
    scene,
    host.clientWidth,
    host.clientHeight || props.height,
  )
  fitSceneSpine(scene)
  if (props.paused) {
    scene.app.render()
  }
}

async function ensureAppearanceCatalogLoaded() {
  if (appearanceCatalog) {
    return
  }

  if (!appearanceCatalogPromise) {
    appearanceCatalogPromise = loadFollowerAppearanceCatalog()
  }

  appearanceCatalog = await appearanceCatalogPromise
}

async function createSceneIfNeeded() {
  if (previewScene || isInitializing || !isVisible.value) {
    return
  }

  const missingMessage = getMissingFollowerAssetsMessage()
  if (missingMessage) {
    missingAssetsMessage.value = missingMessage
    errorMessage.value = null
    isLoading.value = false
    return
  }

  const host = playerHostElement.value
  if (!host) {
    return
  }

  isInitializing = true
  isLoading.value = true
  errorMessage.value = null
  missingAssetsMessage.value = null

  try {
    const [resource] = await Promise.all([
      loadFollowerSpineResource(),
      ensureAppearanceCatalogLoaded(),
    ])

    if (!isVisible.value || !playerHostElement.value) {
      return
    }

    host.innerHTML = ''
    const app = new Application({
      width: Math.max(1, Math.round(host.clientWidth || 1)),
      height: Math.max(1, Math.round(host.clientHeight || props.height || 1)),
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      resizeTo: host
    })

    host.append(app.view as HTMLCanvasElement)
    const spine = new SpineView(resource.skeletonData)
    app.stage.addChild(spine)

    previewScene = {
      app,
      spine,
      resizeObserver: null,
    }

    setupSceneResizeObserver(previewScene, host)
    applyAppearanceToScene()
    missingAssetsMessage.value = null
  } catch (error) {
    if (isMissingFollowerAssetsError(error)) {
      missingAssetsMessage.value = error.message
      errorMessage.value = null
      return
    }

    missingAssetsMessage.value = null
    errorMessage.value = error instanceof Error ? error.message : `${error}`
  } finally {
    isLoading.value = false
    isInitializing = false
  }
}

function disposeScene() {
  if (!previewScene) {
    return
  }

  if (previewScene.resizeObserver) {
    previewScene.resizeObserver.disconnect()
    previewScene.resizeObserver = null
  }

  previewScene.app.destroy(true, {
    children: true,
    texture: false,
    baseTexture: false,
  })
  previewScene = null

  const host = playerHostElement.value
  if (host) {
    host.innerHTML = ''
  }
}

function setupVisibilityObserver() {
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

watch(isVisible, visible => {
  if (visible) {
    void createSceneIfNeeded()
    return
  }

  disposeScene()
}, { immediate: true })

watch(appearanceSignature, () => {
  if (!previewScene) {
    if (isVisible.value) {
      void createSceneIfNeeded()
    }
    return
  }

  applyAppearanceToScene()
})

onMounted(() => {
  setupVisibilityObserver()

  if (!props.lazy) {
    isVisible.value = true
    void createSceneIfNeeded()
  }
})

onBeforeUnmount(() => {
  if (visibilityObserver) {
    visibilityObserver.disconnect()
    visibilityObserver = null
  }

  disposeScene()
})
</script>

<style scoped>
.follower-spine-preview {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(circle at 30% 20%, rgb(62 102 71 / 26%) 0%, rgb(16 24 20 / 65%) 85%);
}

.follower-spine-preview__host {
  width: 100%;
  min-height: 80px;
}

.follower-spine-preview__host :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.follower-spine-preview__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.follower-spine-preview__skeleton {
  width: 100%;
  height: 100%;
}

.follower-spine-preview__error {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  color: rgb(var(--v-theme-error));
  background: rgb(var(--v-theme-surface));
  border-radius: 999px;
  padding: 2px;
}

.follower-spine-preview__placeholder {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
  background: rgb(10 18 14 / 82%);
  color: rgb(236 244 238);
}

.follower-spine-preview__placeholder-title {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.follower-spine-preview__placeholder-text {
  font-size: 0.74rem;
  line-height: 1.35;
}
</style>
