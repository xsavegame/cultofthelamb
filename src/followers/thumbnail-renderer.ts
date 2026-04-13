import type { FollowerAppearanceDraft } from '@/types/follower'
import { Spine } from '@pixi-spine/all-3.8'
import { Application } from 'pixi.js'
import { type FollowerAppearanceCatalog, loadFollowerAppearanceCatalog } from '@/followers/appearance-catalog'
import {
  applyFollowerAppearanceToSpine,
  fitFollowerSpineToRenderer,
} from '@/followers/spine-appearance'
import { loadFollowerSpineResource } from '@/followers/spine-resource'

export type FollowerThumbnailFitMode = 'list' | 'editor'
export type FollowerThumbnailPose = 'setup' | 'idle'

export type FollowerThumbnailRequest = {
  appearance: FollowerAppearanceDraft
  width: number
  height: number
  fitMode?: FollowerThumbnailFitMode
  pose?: FollowerThumbnailPose
  cacheKeyExtra?: string | number | null
}

export type FollowerAnimationFramesRequest = {
  appearance: FollowerAppearanceDraft
  width: number
  height: number
  fitMode?: FollowerThumbnailFitMode
  animation?: string | null
  frameCount?: number
  fps?: number
  cacheKeyExtra?: string | number | null
}

export type FollowerAnimationFrames = {
  frameUrls: string[]
  fps: number
}

type ThumbnailRuntime = {
  app: Application
  spine: Spine
  appearanceCatalog: FollowerAppearanceCatalog
}

const MAX_THUMBNAIL_CACHE_SIZE = 300
const MAX_ANIMATION_CACHE_SIZE = 120

const thumbnailCache = new Map<string, string>()
const animationFrameCache = new Map<string, FollowerAnimationFrames>()
const inFlightRenderMap = new Map<string, Promise<string>>()
const inFlightAnimationRenderMap = new Map<string, Promise<FollowerAnimationFrames>>()

let runtimePromise: Promise<ThumbnailRuntime> | null = null
let renderQueue = Promise.resolve()

function normalizeDimension (value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.round(value))
}

function normalizeFitMode (
  fitMode: FollowerThumbnailFitMode | undefined,
): FollowerThumbnailFitMode {
  return fitMode ?? 'list'
}

function normalizePose (
  pose: FollowerThumbnailPose | undefined,
): FollowerThumbnailPose {
  return pose ?? 'setup'
}

function normalizeAnimationName (
  animation: string | null | undefined,
): string {
  if (typeof animation !== 'string') {
    return 'idle'
  }

  const trimmedAnimation = animation.trim()
  if (trimmedAnimation === '') {
    return 'idle'
  }

  return trimmedAnimation
}

function normalizeFrameCount (
  frameCount: number | undefined,
): number {
  if (typeof frameCount !== 'number' || !Number.isFinite(frameCount)) {
    return 12
  }

  return Math.min(24, Math.max(1, Math.round(frameCount)))
}

function normalizeFramesPerSecond (
  fps: number | undefined,
): number {
  if (typeof fps !== 'number' || !Number.isFinite(fps)) {
    return 12
  }

  return Math.min(30, Math.max(1, Math.round(fps)))
}

function getCacheKey (
  request: {
    appearance: FollowerAppearanceDraft
    width: number
    height: number
    fitMode: FollowerThumbnailFitMode
    pose: FollowerThumbnailPose
    cacheKeyExtra: string
  },
): string {
  return [
    request.appearance.AppearanceSkin,
    request.appearance.AppearanceClothingType,
    request.appearance.AppearanceClothingVariantIndex,
    request.appearance.AppearanceFormColorIndex,
    request.appearance.AppearanceClothingColorIndex,
    request.width,
    request.height,
    request.fitMode,
    request.pose,
    request.cacheKeyExtra,
  ].join('|')
}

function getAnimationCacheKey (
  request: {
    appearance: FollowerAppearanceDraft
    width: number
    height: number
    fitMode: FollowerThumbnailFitMode
    animation: string
    frameCount: number
    fps: number
    cacheKeyExtra: string
  },
): string {
  return [
    request.appearance.AppearanceSkin,
    request.appearance.AppearanceClothingType,
    request.appearance.AppearanceClothingVariantIndex,
    request.appearance.AppearanceFormColorIndex,
    request.appearance.AppearanceClothingColorIndex,
    request.width,
    request.height,
    request.fitMode,
    request.animation,
    request.frameCount,
    request.fps,
    request.cacheKeyExtra,
  ].join('|')
}

function getCachedThumbnail (
  key: string,
): string | null {
  const cached = thumbnailCache.get(key)
  if (!cached) {
    return null
  }

  thumbnailCache.delete(key)
  thumbnailCache.set(key, cached)
  return cached
}

function cloneAnimationFrames (
  animationFrames: FollowerAnimationFrames,
): FollowerAnimationFrames {
  return {
    frameUrls: [...animationFrames.frameUrls],
    fps: animationFrames.fps,
  }
}

function getCachedAnimationFrames (
  key: string,
): FollowerAnimationFrames | null {
  const cached = animationFrameCache.get(key)
  if (!cached) {
    return null
  }

  animationFrameCache.delete(key)
  animationFrameCache.set(key, cached)
  return cloneAnimationFrames(cached)
}

function setCachedThumbnail (
  key: string,
  imageUrl: string,
) {
  const existing = thumbnailCache.get(key)
  if (existing) {
    if (existing !== imageUrl) {
      URL.revokeObjectURL(existing)
    }
    thumbnailCache.delete(key)
  }

  thumbnailCache.set(key, imageUrl)

  while (thumbnailCache.size > MAX_THUMBNAIL_CACHE_SIZE) {
    const oldestEntry = thumbnailCache.entries().next().value as [string, string] | undefined
    if (!oldestEntry) {
      break
    }

    const [oldestKey, oldestImageUrl] = oldestEntry
    thumbnailCache.delete(oldestKey)
    URL.revokeObjectURL(oldestImageUrl)
  }
}

function revokeAnimationFrames (
  frameUrls: string[],
) {
  for (const frameUrl of frameUrls) {
    URL.revokeObjectURL(frameUrl)
  }
}

function setCachedAnimationFrames (
  key: string,
  animationFrames: FollowerAnimationFrames,
) {
  const existing = animationFrameCache.get(key)
  if (existing) {
    revokeAnimationFrames(existing.frameUrls)
    animationFrameCache.delete(key)
  }

  animationFrameCache.set(key, {
    frameUrls: [...animationFrames.frameUrls],
    fps: animationFrames.fps,
  })

  while (animationFrameCache.size > MAX_ANIMATION_CACHE_SIZE) {
    const oldestEntry = animationFrameCache.entries().next().value as [string, FollowerAnimationFrames] | undefined
    if (!oldestEntry) {
      break
    }

    const [oldestKey, oldestAnimationFrames] = oldestEntry
    animationFrameCache.delete(oldestKey)
    revokeAnimationFrames(oldestAnimationFrames.frameUrls)
  }
}

function enqueueRender<T> (
  renderJob: () => Promise<T>,
): Promise<T> {
  const scheduledRender = renderQueue.then(renderJob, renderJob)
  renderQueue = scheduledRender.then(
    () => undefined,
    () => undefined,
  )
  return scheduledRender
}

async function ensureRuntime (): Promise<ThumbnailRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const [resource, appearanceCatalog] = await Promise.all([
        loadFollowerSpineResource(),
        loadFollowerAppearanceCatalog(),
      ])

      const app = new Application({
        width: 1,
        height: 1,
        antialias: true,
        autoDensity: false,
        backgroundAlpha: 0,
        resolution: 1,
        preserveDrawingBuffer: true,
      })
      app.stop()

      const spine = new Spine(resource.skeletonData)
      spine.autoUpdate = false
      app.stage.addChild(spine)

      return {
        app,
        spine,
        appearanceCatalog,
      }
    })().catch(error => {
      runtimePromise = null
      throw error
    })
  }

  return await runtimePromise
}

function getFitOptions (
  fitMode: FollowerThumbnailFitMode,
) {
  if (fitMode === 'editor') {
    return {
      targetWidthRatio: 0.84,
      targetHeightRatio: 0.9,
      anchorY: 0.56,
    }
  }

  return {
    targetWidthRatio: 0.68,
    targetHeightRatio: 0.78,
    anchorY: 0.58,
  }
}

async function canvasToObjectUrl (
  canvas: HTMLCanvasElement,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to generate follower thumbnail image blob.'))
        return
      }

      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

async function renderThumbnail (
  request: {
    appearance: FollowerAppearanceDraft
    width: number
    height: number
    fitMode: FollowerThumbnailFitMode
    pose: FollowerThumbnailPose
  },
): Promise<string> {
  const runtime = await ensureRuntime()

  runtime.app.renderer.resize(request.width, request.height)

  applyFollowerAppearanceToSpine(
    runtime.spine,
    runtime.appearanceCatalog,
    request.appearance,
    {
      animation: request.pose === 'idle' ? 'idle' : null,
      fallbackAnimations: request.pose === 'idle'
        ? undefined
        : [],
      loop: false,
    },
  )

  fitFollowerSpineToRenderer(
    runtime.spine,
    request.width,
    request.height,
    getFitOptions(request.fitMode),
  )

  runtime.app.renderer.render(runtime.app.stage)
  const canvas = runtime.app.view as HTMLCanvasElement
  return await canvasToObjectUrl(canvas)
}

async function renderAnimationFrames (
  request: {
    appearance: FollowerAppearanceDraft
    width: number
    height: number
    fitMode: FollowerThumbnailFitMode
    animation: string
    frameCount: number
    fps: number
  },
): Promise<FollowerAnimationFrames> {
  const runtime = await ensureRuntime()
  const skeleton = runtime.spine.skeleton

  runtime.app.renderer.resize(request.width, request.height)

  const { animationName } = applyFollowerAppearanceToSpine(
    runtime.spine,
    runtime.appearanceCatalog,
    request.appearance,
    {
      animation: request.animation,
      loop: true,
    },
  )

  fitFollowerSpineToRenderer(
    runtime.spine,
    request.width,
    request.height,
    getFitOptions(request.fitMode),
  )

  const canvas = runtime.app.view as HTMLCanvasElement
  const frameUrls: string[] = []

  const renderCurrentFrame = async () => {
    runtime.app.renderer.render(runtime.app.stage)
    frameUrls.push(await canvasToObjectUrl(canvas))
  }

  const animationDuration = animationName
    ? (skeleton.data.findAnimation(animationName)?.duration ?? 0)
    : 0
  if (!animationName || request.frameCount <= 1 || animationDuration <= 0) {
    await renderCurrentFrame()
    return {
      frameUrls,
      fps: request.fps,
    }
  }

  const frameStepDuration = animationDuration / request.frameCount
  runtime.spine.state.setAnimation(0, animationName, true)
  runtime.spine.state.apply(skeleton)
  skeleton.updateWorldTransform()

  for (let frameIndex = 0; frameIndex < request.frameCount; frameIndex += 1) {
    if (frameIndex > 0) {
      runtime.spine.state.update(frameStepDuration)
      runtime.spine.state.apply(skeleton)
      skeleton.updateWorldTransform()
    }

    await renderCurrentFrame()
  }

  return {
    frameUrls,
    fps: request.fps,
  }
}

export async function getFollowerThumbnail (
  request: FollowerThumbnailRequest,
): Promise<string> {
  const normalizedRequest = {
    appearance: request.appearance,
    width: normalizeDimension(request.width),
    height: normalizeDimension(request.height),
    fitMode: normalizeFitMode(request.fitMode),
    pose: normalizePose(request.pose),
    cacheKeyExtra: request.cacheKeyExtra === null || request.cacheKeyExtra === undefined
      ? ''
      : `${request.cacheKeyExtra}`,
  }

  const cacheKey = getCacheKey(normalizedRequest)
  const cached = getCachedThumbnail(cacheKey)
  if (cached) {
    return cached
  }

  const inFlight = inFlightRenderMap.get(cacheKey)
  if (inFlight) {
    return await inFlight
  }

  const renderPromise = enqueueRender(async () => {
    try {
      const imageUrl = await renderThumbnail(normalizedRequest)
      setCachedThumbnail(cacheKey, imageUrl)
      return imageUrl
    } finally {
      inFlightRenderMap.delete(cacheKey)
    }
  })

  inFlightRenderMap.set(cacheKey, renderPromise)
  return await renderPromise
}

export async function getFollowerAnimationFrames (
  request: FollowerAnimationFramesRequest,
): Promise<FollowerAnimationFrames> {
  const normalizedRequest = {
    appearance: request.appearance,
    width: normalizeDimension(request.width),
    height: normalizeDimension(request.height),
    fitMode: normalizeFitMode(request.fitMode),
    animation: normalizeAnimationName(request.animation),
    frameCount: normalizeFrameCount(request.frameCount),
    fps: normalizeFramesPerSecond(request.fps),
    cacheKeyExtra: request.cacheKeyExtra === null || request.cacheKeyExtra === undefined
      ? ''
      : `${request.cacheKeyExtra}`,
  }

  const cacheKey = getAnimationCacheKey(normalizedRequest)
  const cached = getCachedAnimationFrames(cacheKey)
  if (cached) {
    return cached
  }

  const inFlight = inFlightAnimationRenderMap.get(cacheKey)
  if (inFlight) {
    return await inFlight
  }

  const renderPromise = enqueueRender(async () => {
    try {
      const animationFrames = await renderAnimationFrames(normalizedRequest)
      setCachedAnimationFrames(cacheKey, animationFrames)
      return cloneAnimationFrames(animationFrames)
    } finally {
      inFlightAnimationRenderMap.delete(cacheKey)
    }
  })

  inFlightAnimationRenderMap.set(cacheKey, renderPromise)
  return await renderPromise
}

export function clearFollowerThumbnailCache () {
  for (const imageUrl of thumbnailCache.values()) {
    URL.revokeObjectURL(imageUrl)
  }

  for (const animationFrames of animationFrameCache.values()) {
    revokeAnimationFrames(animationFrames.frameUrls)
  }

  thumbnailCache.clear()
  animationFrameCache.clear()
  inFlightRenderMap.clear()
  inFlightAnimationRenderMap.clear()
}
