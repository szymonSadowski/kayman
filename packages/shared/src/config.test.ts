import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadConfig } from './config'

const VALID_CONFIG = `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test-key
notion_token: secret_notion
notion_database_id: abc123
projects:
  - name: Kayman
    notion_page_id: page-abc
audio_source: system_and_mic
`

describe('loadConfig', () => {
  let tmpDir: string
  let configPath: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kayman-test-'))
    configPath = path.join(tmpDir, 'config.yaml')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns typed Config from valid yaml', () => {
    fs.writeFileSync(configPath, VALID_CONFIG)
    const config = loadConfig(configPath)

    expect(config.userName).toBe('Szymon')
    expect(config.aiProvider).toBe('openai')
    expect(config.aiModel).toBe('gpt-4o')
    expect(config.aiApiKey).toBe('sk-test-key')
    expect(config.notionToken).toBe('secret_notion')
    expect(config.notionDatabaseId).toBe('abc123')
    expect(config.projects).toEqual([{ name: 'Kayman', notionPageId: 'page-abc' }])
    expect(config.audioSource).toBe('system_and_mic')
  })

  it('throws user-readable error on missing required field', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_database_id: abc123
`,
    )
    expect(() => loadConfig(configPath)).toThrow('Config error: notion_token is required')
  })

  it('throws on malformed YAML', () => {
    fs.writeFileSync(configPath, 'key: [unclosed')
    expect(() => loadConfig(configPath)).toThrow('Config error: malformed YAML')
  })

  it('throws when config file is missing', () => {
    expect(() => loadConfig('/nonexistent/path/config.yaml')).toThrow(
      'Config error: config file not found',
    )
  })

  it('throws on unsupported ai_provider value', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: mistral
ai_model: mistral-7b
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
`,
    )
    expect(() => loadConfig(configPath)).toThrow('Config error: ai_provider "mistral" is not supported')
  })

  it('throws on invalid audio_source value', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
audio_source: invalid_value
`,
    )
    expect(() => loadConfig(configPath)).toThrow('Config error: audio_source must be one of')
  })

  it('defaults audioSource to system_and_mic when omitted', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
`,
    )
    const config = loadConfig(configPath)
    expect(config.audioSource).toBe('system_and_mic')
  })
})
