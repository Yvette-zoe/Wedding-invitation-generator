import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const vlUrl =
    env.VITE_VL_API_URL ||
    env.VITE_DEEPSEEK_API_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  let vlOrigin = 'https://dashscope.aliyuncs.com';
  try {
    vlOrigin = new URL(vlUrl).origin;
  } catch {
    /* 使用默认百炼域名 */
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // 浏览器直连视觉接口会遇到 CORS，开发态走本地代理
      proxy: {
        '/vl-proxy': {
          target: vlOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vl-proxy/, ''),
        },
      },
    },
  };
});
