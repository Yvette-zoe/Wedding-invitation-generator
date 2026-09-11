/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_VL_API_KEY: string;
  readonly VITE_VL_API_URL: string;
  readonly VITE_VL_MODEL: string;
  readonly VITE_DEEPSEEK_API_KEY: string;
  readonly VITE_DEEPSEEK_API_URL: string;
  readonly VITE_DEEPSEEK_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
