import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sites } from './build/sites-vite-plugin'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  // 제품 웹(apps/web)이 vite 기본 포트 5173을 쓴다. 자동 이동을 허용하면
  // 와이어프레임이 매번 다른 포트로 떠서 5173을 열었을 때 제품 웹이 나온다.
  // 고정하고, 이미 점유돼 있으면 조용히 옮기지 말고 실패시킨다.
  server: { port: 5180, strictPort: true },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react({
      babel: {
        compact: false,
      },
    }),
    tailwindcss(),
    sites(),
    cloudflare({
      viteEnvironment: { name: 'server' },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
