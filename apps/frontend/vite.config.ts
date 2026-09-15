import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 后端契约：apps/backend（Java）@ http://localhost:8787，前端开发一律走相对 /api
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // 实时通道（订单状态推送 / 弹幕 / 即时聊天）
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
