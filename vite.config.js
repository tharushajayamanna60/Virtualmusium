import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    historyApiFallback: true, // This ensures all paths load the index.html
  }
})