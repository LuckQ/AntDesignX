import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.dify.ai',
        
        // 122
        // target: 'http://192.168.79.122:8083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/v1': {
        target: 'https://api.dify.ai/v1',
        // target: 'http://192.168.79.122:8083/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/v1/, '')
      },
      '/langchain': {
        target: 'http://192.168.11.75:8888/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/langchain/, '')
      },
    }
  }
})
