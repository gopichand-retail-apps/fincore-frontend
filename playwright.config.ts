import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDirectory = fileURLToPath(new URL('.', import.meta.url))
const backendDirectory = resolve(frontendDirectory, '../fincore-backend')
const selectedMode = process.env.FINCORE_E2E_MODE ?? 'true'
if (selectedMode !== 'true' && selectedMode !== 'false') {
  throw new Error('FINCORE_E2E_MODE must be exactly "true" or "false".')
}

const apiOrigin = 'http://127.0.0.1:5504'
const frontendOrigin = 'http://127.0.0.1:5503'
const isMock = selectedMode === 'true'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: frontendOrigin,
  },
  webServer: [
    {
      command: 'mvn -q spring-boot:run',
      cwd: backendDirectory,
      url: `${apiOrigin}/actuator/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: '5504',
        SPRING_PROFILES_ACTIVE: 'local',
        FINCORE_DB_URL: 'jdbc:h2:mem:fincore_e2e;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE',
        FINCORE_FRONTEND_ORIGINS: frontendOrigin,
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5503 --strictPort',
      cwd: frontendDirectory,
      url: frontendOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_IS_MOCK: selectedMode,
        VITE_MOCK_API_BASE_URL: isMock ? apiOrigin : 'http://127.0.0.1:1',
        VITE_REAL_API_BASE_URL: isMock ? 'http://127.0.0.1:1' : apiOrigin,
        FINCORE_API_PROXY_TARGET: 'http://127.0.0.1:1',
      },
    },
  ],
})
