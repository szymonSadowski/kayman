import fs from 'fs'
import path from 'path'
import os from 'os'

export const CONFIG_PATH = path.join(os.homedir(), '.config', 'kayman', 'config.yaml')

export function setConfigValue(key: string, value: string): void {
  const raw = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : ''
  const keyRegex = new RegExp(`^${key}:.*`, 'm')
  const updated = keyRegex.test(raw)
    ? raw.replace(keyRegex, `${key}: ${value}`)
    : raw + `\n${key}: ${value}\n`
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, updated, 'utf8')
}

export function setConfigValues(values: Record<string, string>): void {
  let updated = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : ''
  for (const [key, value] of Object.entries(values)) {
    const keyRegex = new RegExp(`^${key}:.*`, 'm')
    updated = keyRegex.test(updated)
      ? updated.replace(keyRegex, `${key}: ${value}`)
      : updated + `\n${key}: ${value}\n`
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, updated, 'utf8')
}
