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

  it('parses empty string prompt_template to empty string (not undefined)', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
projects:
  - name: Standup
    notion_page_id: page-1
    prompt_template: ""
`,
    )
    const config = loadConfig(configPath)
    expect(config.projects[0].promptTemplate).toBe('')
  })

  it('loads config with ollama provider without ai_api_key', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: ollama
ai_model: llama3.2
notion_token: secret
notion_database_id: abc
`,
    )
    const config = loadConfig(configPath)
    expect(config.aiProvider).toBe('ollama')
    expect(config.aiApiKey).toBeUndefined()
  })

  it('throws when non-ollama provider has no ai_api_key', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
notion_token: secret
notion_database_id: abc
`,
    )
    expect(() => loadConfig(configPath)).toThrow('Config error: ai_api_key is required')
  })

  it('parses ai_base_url for ollama provider', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: ollama
ai_model: llama3.2
ai_base_url: http://192.168.1.10:11434
notion_token: secret
notion_database_id: abc
`,
    )
    const config = loadConfig(configPath)
    expect(config.aiBaseUrl).toBe('http://192.168.1.10:11434')
  })

  it('returns undefined aiBaseUrl when ai_base_url not set', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: ollama
ai_model: llama3.2
notion_token: secret
notion_database_id: abc
`,
    )
    const config = loadConfig(configPath)
    expect(config.aiBaseUrl).toBeUndefined()
  })

  it('throws on non-string prompt_template value', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
projects:
  - name: Standup
    notion_page_id: page-1
    prompt_template: 42
`,
    )
    expect(() => loadConfig(configPath)).toThrow('Config error: prompt_template must be a string')
  })

  it('parses prompt_template in project to promptTemplate', () => {
    fs.writeFileSync(
      configPath,
      `
user_name: Szymon
ai_provider: openai
ai_model: gpt-4o
ai_api_key: sk-test
notion_token: secret
notion_database_id: abc
projects:
  - name: Standup
    notion_page_id: page-1
    prompt_template: "Summarize the standup."
  - name: Client
    notion_page_id: page-2
`,
    )
    const config = loadConfig(configPath)
    expect(config.projects[0].promptTemplate).toBe('Summarize the standup.')
    expect(config.projects[1].promptTemplate).toBeUndefined()
  })
})
