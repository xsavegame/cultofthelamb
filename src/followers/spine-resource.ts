import type { SkeletonData } from '@pixi-spine/all-3.8';
import {
  AtlasAttachmentLoader,
  SkeletonBinary,
  TextureAtlas,
} from '@pixi-spine/all-3.8';
import { BaseTexture } from 'pixi.js';

const FOLLOWER_ASSET_DIRECTORY = 'src/generated/data/assets';
const REQUIRED_FOLLOWER_ASSET_FILES = [
  'Follower.atlas',
  'Follower.png',
  'Follower.skel',
] as const;

const followerAssetModules = import.meta.glob('/src/generated/data/assets/*', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const followerAssetUrlByName = new Map<string, string>(
  Object.entries(followerAssetModules)
    .map(([fullPath, assetUrl]) => {
      const normalizedName = fullPath.split('/').at(-1)?.toLowerCase() ?? '';
      return [normalizedName, assetUrl] as const;
    })
    .filter(([normalizedName]) => normalizedName !== ''),
);

export type FollowerSpineResource = {
  atlas: TextureAtlas;
  skeletonData: SkeletonData;
};

export class MissingFollowerAssetsError extends Error {
  missingFiles: string[];

  constructor(missingFiles: string[]) {
    super(buildMissingFollowerAssetsMessage(missingFiles));
    this.name = 'MissingFollowerAssetsError';
    this.missingFiles = [...missingFiles];
  }
}

let followerSpineResourcePromise: Promise<FollowerSpineResource> | null = null;
let followerAnimationNamesPromise: Promise<string[]> | null = null;
let followerAnimationNamesCache: string[] | null = null;

function buildMissingFollowerAssetsMessage(missingFiles: string[]): string {
  if (import.meta.env.VITE_GITHUB_PAGE) {
    return `This is github pages, assets are not available.`;
  }
  return `Missing generated follower assets in ${FOLLOWER_ASSET_DIRECTORY}: ${missingFiles.join(', ')}. Please generate them.`;
}

function getMissingFollowerAssetFiles(): string[] {
  return REQUIRED_FOLLOWER_ASSET_FILES.filter((fileName) => {
    return !followerAssetUrlByName.has(fileName.toLowerCase());
  });
}

export function getMissingFollowerAssetsMessage(): string | null {
  const missingFiles = getMissingFollowerAssetFiles();
  if (missingFiles.length === 0) {
    return null;
  }

  return buildMissingFollowerAssetsMessage(missingFiles);
}

export function isMissingFollowerAssetsError(
  error: unknown,
): error is MissingFollowerAssetsError {
  return error instanceof MissingFollowerAssetsError;
}

function assertFollowerAssetsAvailable() {
  const missingFiles = getMissingFollowerAssetFiles();
  if (missingFiles.length > 0) {
    throw new MissingFollowerAssetsError(missingFiles);
  }
}

function getFollowerAssetUrl(fileName: string): string {
  const assetUrl = followerAssetUrlByName.get(fileName.toLowerCase());
  if (assetUrl) {
    return assetUrl;
  }

  const missingFiles = getMissingFollowerAssetFiles();
  if (missingFiles.length > 0) {
    throw new MissingFollowerAssetsError(missingFiles);
  }

  throw new MissingFollowerAssetsError([fileName]);
}

function resolveAssetUrl(path: string, parentUrl: string): string {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:')) {
    return path;
  }

  try {
    return new URL(path, parentUrl).toString();
  } catch {
    return path;
  }
}

function resolveFollowerTextureUrl(path: string, parentUrl: string): string {
  const normalizedPath = path.trim().replaceAll('\\', '/').toLowerCase();
  if (normalizedPath === '' || normalizedPath === 'follower.png') {
    return getFollowerAssetUrl('Follower.png');
  }

  return resolveAssetUrl(path.trim(), parentUrl);
}

async function createTextureAtlas(
  atlasText: string,
  atlasUrl: string,
): Promise<TextureAtlas> {
  return await new Promise<TextureAtlas>((resolve, reject) => {
    let atlas: TextureAtlas | null = null;
    let failed = false;

    atlas = new TextureAtlas(
      atlasText,
      (path, loaderFunction) => {
        if (failed) {
          return;
        }

        const textureUrl = resolveFollowerTextureUrl(path, atlasUrl);
        const baseTexture = BaseTexture.from(textureUrl);

        if (baseTexture.valid) {
          loaderFunction(baseTexture);
          return;
        }

        const clearListeners = () => {
          baseTexture.off('loaded', onLoaded);
          baseTexture.off('error', onError);
        };

        const onLoaded = () => {
          clearListeners();
          loaderFunction(baseTexture);
        };

        const onError = () => {
          clearListeners();
          failed = true;
          reject(
            new Error(`Failed to load follower texture page: ${textureUrl}`),
          );
        };

        baseTexture.once('loaded', onLoaded);
        baseTexture.once('error', onError);
      },
      (loadedAtlas) => {
        if (failed) {
          return;
        }

        if (!loadedAtlas) {
          reject(new Error('Failed to parse follower atlas data.'));
          return;
        }

        resolve(atlas ?? loadedAtlas);
      },
    );
  });
}

export async function loadFollowerSpineResource(): Promise<FollowerSpineResource> {
  assertFollowerAssetsAvailable();

  if (!followerSpineResourcePromise) {
    followerSpineResourcePromise = (async () => {
      const followerAtlasUrl = getFollowerAssetUrl('Follower.atlas');
      const followerSkeletonUrl = getFollowerAssetUrl('Follower.skel');
      const [atlasResponse, skeletonResponse] = await Promise.all([
        fetch(followerAtlasUrl),
        fetch(followerSkeletonUrl),
      ]);

      if (!atlasResponse.ok) {
        throw new Error(
          `Failed to load follower atlas (${atlasResponse.status}).`,
        );
      }
      if (!skeletonResponse.ok) {
        throw new Error(
          `Failed to load follower skeleton (${skeletonResponse.status}).`,
        );
      }

      const [atlasText, skeletonBuffer] = await Promise.all([
        atlasResponse.text(),
        skeletonResponse.arrayBuffer(),
      ]);

      const atlas = await createTextureAtlas(
        atlasText,
        atlasResponse.url || followerAtlasUrl,
      );
      const attachmentLoader = new AtlasAttachmentLoader(atlas);
      const binaryReader = new SkeletonBinary(attachmentLoader);
      const skeletonData = binaryReader.readSkeletonData(
        new Uint8Array(skeletonBuffer),
      );

      return {
        atlas,
        skeletonData,
      };
    })().catch((error) => {
      followerSpineResourcePromise = null;
      throw error;
    });
  }

  return await followerSpineResourcePromise;
}

function getAnimationPriority(animationName: string): number {
  const normalizedName = animationName.toLowerCase();
  if (normalizedName === 'idle') {
    return 0;
  }

  if (normalizedName.includes('idle')) {
    return 1;
  }

  return 2;
}

export async function loadFollowerAnimationNames(): Promise<string[]> {
  if (followerAnimationNamesCache) {
    return [...followerAnimationNamesCache];
  }

  if (!followerAnimationNamesPromise) {
    followerAnimationNamesPromise = loadFollowerSpineResource()
      .then((resource) => {
        const uniqueNames = [
          ...new Set(
            resource.skeletonData.animations
              .map((animation) => animation.name.trim())
              .filter((name) => name !== ''),
          ),
        ];

        uniqueNames.sort((left, right) => {
          const priorityDelta =
            getAnimationPriority(left) - getAnimationPriority(right);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          return left.localeCompare(right);
        });

        followerAnimationNamesCache = uniqueNames;
        return uniqueNames;
      })
      .catch((error) => {
        followerAnimationNamesPromise = null;
        throw error;
      });
  }

  const animationNames = await followerAnimationNamesPromise;
  return [...animationNames];
}
