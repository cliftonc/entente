import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface EntenteConfig {
  apiKey?: string
  serverUrl?: string
  username?: string
}

const CONFIG_DIR = join(homedir(), '.entente')
const CONFIG_FILE = join(CONFIG_DIR, 'entente.json')

export async function ensureConfigDir(): Promise<void> {
  try {
    await access(CONFIG_DIR)
  } catch {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
}

export async function loadConfig(): Promise<EntenteConfig> {
  try {
    await ensureConfigDir()
    const content = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

export async function saveConfig(config: EntenteConfig): Promise<void> {
  await ensureConfigDir()
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
}

export async function getApiKey(): Promise<string | undefined> {
  // Check environment variable first (for CI/CD)
  if (process.env.ENTENTE_API_KEY) {
    return process.env.ENTENTE_API_KEY
  }

  const config = await loadConfig()
  return config.apiKey
}

export async function getServerUrl(): Promise<string> {
  // Check environment variable first (for CI/CD)
  if (process.env.ENTENTE_SERVICE_URL) {
    return process.env.ENTENTE_SERVICE_URL
  }

  const config = await loadConfig()
  return config.serverUrl || 'https://entente.dev'
}

export async function clearConfig(): Promise<void> {
  await saveConfig({})
}

export async function updateConfig(updates: Partial<EntenteConfig>): Promise<void> {
  const config = await loadConfig()
  await saveConfig({ ...config, ...updates })
}
