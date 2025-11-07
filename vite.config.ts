import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'
import { APP_BASE_PATH } from './src/config/constants'

// 创建移除crossorigin属性的插件
const removeCrossoriginPlugin = {
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html.replace(/ crossorigin/g, '')
  }
}

// 自动注入type="module"插件
const autoModuleTypePlugin = {
  name: 'auto-module-type',
  transformIndexHtml(html) {
    // 匹配所有<script>标签并添加type="module"
    return html.replace(/<script(\s[^>]*)?>/gi, '<script$1 type="module">')
  }
}

export default defineConfig({
  base: `/${APP_BASE_PATH}/`, // 设置部署基础路径为/drmkey目录
  plugins: [
    react(),
    removeCrossoriginPlugin,
    autoModuleTypePlugin // 确保在react插件之后执行
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9150',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    cssCodeSplit: true,
    // 关键：通过Rollup配置生成带哈希的文件名
    rollupOptions: {
      output: {
        // 生成ES模块格式
        format: 'es',
        // 入口文件命名规则（带哈希）
        entryFileNames: 'assets/[name]-[hash].js',
        // 动态加载的chunk文件命名规则（带哈希）
        chunkFileNames: 'assets/[name]-[hash].js',
        // 资源文件命名规则（保留原始扩展名）
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})