/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTHOR_NAME?: string;
  readonly VITE_GITHUB_PAGE?: string;
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_APP_OWNER?: string;
  readonly VITE_APP_REPOSITORY_URL?: string;
  readonly VITE_APP_COMMIT_HASH?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_BUILT_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
