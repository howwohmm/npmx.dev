import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { CommandPalette } from '#components'

let commandPalette: ReturnType<typeof useCommandPalette> | null = null

const CommandPaletteHarness = defineComponent({
  name: 'CommandPaletteHarness',
  setup() {
    commandPalette = useCommandPalette()

    onMounted(() => {
      commandPalette?.open()
    })

    onBeforeUnmount(() => {
      commandPalette?.close()
      commandPalette?.clearPackageContext()
    })

    return () => h('div', [h(CommandPalette)])
  },
})

afterEach(() => {
  commandPalette?.close()
  commandPalette?.clearPackageContext()
  commandPalette = null
})

describe('CommandPalette', () => {
  it('connects the input to an existing description, live status, and results region', async () => {
    await mountSuspended(CommandPaletteHarness)
    await nextTick()
    await nextTick()

    const input = document.getElementById('command-palette-modal-input')
    const description = document.getElementById('command-palette-modal-description')
    const status = document.getElementById('command-palette-modal-status')
    const results = document.getElementById('command-palette-modal-results')

    expect(input).not.toBeNull()
    expect(description?.textContent).toBeTruthy()
    expect(status?.getAttribute('role')).toBe('status')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(results?.getAttribute('role')).toBe('region')

    expect(input?.getAttribute('aria-describedby')).toContain('command-palette-modal-description')
    expect(input?.getAttribute('aria-describedby')).toContain('command-palette-modal-status')
    expect(input?.getAttribute('aria-controls')).toBe('command-palette-modal-results')
  })

  it('updates the live region when the query changes', async () => {
    await mountSuspended(CommandPaletteHarness)
    await nextTick()
    await nextTick()

    const status = document.getElementById('command-palette-modal-status')
    expect(status).not.toBeNull()
    const initialStatus = status?.textContent

    commandPalette!.query.value = 'dark'
    await nextTick()

    expect(status?.textContent).not.toBe(initialStatus)
  })

  it('updates the input placeholder for palette subviews', async () => {
    await mountSuspended(CommandPaletteHarness)
    await nextTick()
    await nextTick()

    const input = document.getElementById('command-palette-modal-input')
    expect(input?.getAttribute('placeholder')).toBe('type a command...')

    commandPalette!.setView('languages')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Language')

    commandPalette!.setView('accent-colors')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Accent colors')

    commandPalette!.setView('background-themes')
    await nextTick()
    expect(input?.getAttribute('placeholder')).toBe('Background shade')
  })

  it('renders navigation and external commands as links', async () => {
    await mountSuspended(CommandPaletteHarness)
    await nextTick()
    await nextTick()

    const settingsLink = document.querySelector('a[data-command-item="true"][href$="/settings"]')
    const chatLink = document.querySelector(
      'a[data-command-item="true"][href="https://chat.npmx.dev"]',
    )

    expect(settingsLink?.tagName).toBe('A')
    expect(chatLink?.tagName).toBe('A')
    expect(chatLink?.getAttribute('target')).toBe('_blank')
  })
})
