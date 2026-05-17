import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/fukushi-app/', // GitHub Pages用（デプロイ時に使用）
})
