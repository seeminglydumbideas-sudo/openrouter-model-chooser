import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { WRITE_CONFIG_ROUTE, handleWriteConfig, resolveOutputDir } from './server/writeConfig.ts'
import { HISTORY_ROUTE, handleHistory, resolveHistoryDir, startHistoryRecorder } from './server/history.ts'

// Dev server only: backs the OpenCode Config tab's "Write on disk" button. The
// container uses the same handler via server/server.ts.
function writeOpenCodeConfig(): Plugin {
  return {
    name: 'write-opencode-config',
    apply: 'serve',
    configureServer(server) {
      const outputDir = resolveOutputDir(server.config.root)
      server.middlewares.use(WRITE_CONFIG_ROUTE, (req, res) => void handleWriteConfig(req, res, outputDir))
    },
  }
}

// Dev server only: daily OpenRouter snapshots for the 2D Matrix timeline. The
// container uses the same handler via server/server.ts.
function modelHistory(): Plugin {
  return {
    name: 'model-history',
    apply: 'serve',
    configureServer(server) {
      const dir = resolveHistoryDir(server.config.root)
      server.middlewares.use(HISTORY_ROUTE, (req, res) => void handleHistory(req, res, dir))
      startHistoryRecorder(dir, msg => server.config.logger.info(msg))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), writeOpenCodeConfig(), modelHistory()],
})
