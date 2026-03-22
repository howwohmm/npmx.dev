import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, watchEffect, type Ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type {
  CommandPaletteCommand,
  CommandPaletteCommandGroup,
  CommandPaletteContextCommandInput,
  CommandPalettePackageContext,
  CommandPaletteView,
} from '~/types/command-palette'

async function captureCommandPalette(options?: {
  route?: string
  query?: string
  colorMode?: 'system' | 'light' | 'dark'
  view?: CommandPaletteView
  packageContext?: CommandPalettePackageContext | null
  versionUrlPattern?: string
  contextCommands?: CommandPaletteContextCommandInput[]
}) {
  const groupedCommands = ref<CommandPaletteCommandGroup[]>([]) as Ref<CommandPaletteCommandGroup[]>
  const flatCommands = ref<CommandPaletteCommand[]>([]) as Ref<CommandPaletteCommand[]>
  const routePath = ref('') as Ref<string>
  let submitSearchQuery!: () => Promise<void>

  const WrapperComponent = defineComponent({
    setup() {
      const { query, setPackageContext, clearPackageContext, setView } = useCommandPalette()
      const colorMode = useColorMode()
      const route = useRoute()

      colorMode.preference = options?.colorMode ?? 'system'
      setView(options?.view ?? 'root')
      query.value = options?.query ?? ''

      if (options?.packageContext) {
        setPackageContext(options.packageContext)
        useCommandPalettePackageCommands(() => options.packageContext ?? null)
        useCommandPaletteVersionCommands(
          () => options.packageContext ?? null,
          () => options.versionUrlPattern,
        )
      } else {
        clearPackageContext()
      }

      if (options?.contextCommands) {
        useCommandPaletteContextCommands(options.contextCommands)
      }

      const commands = useCommandPaletteCommands()
      submitSearchQuery = commands.submitSearchQuery

      watchEffect(() => {
        groupedCommands.value = commands.groupedCommands.value
        flatCommands.value = commands.flatCommands.value
        routePath.value = route.fullPath
      })

      return () => h('div')
    },
  })

  const wrapper = await mountSuspended(WrapperComponent, {
    route: options?.route ?? '/',
  })

  return {
    wrapper,
    groupedCommands,
    flatCommands,
    routePath,
    submitSearchQuery,
  }
}

describe('useCommandPaletteCommands', () => {
  it('includes synchronous built-in, link, and settings commands', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette()

    expect(groupedCommands.value.map(group => group.id)).toEqual([
      'navigation',
      'connections',
      'settings',
      'help',
      'npmx',
    ])
    expect(flatCommands.value.find(command => command.id === 'search')?.label).toBe('Search')
    expect(flatCommands.value.find(command => command.id === 'language')?.label).toBe('Language')
    expect(flatCommands.value.find(command => command.id === 'keyboard-shortcuts')?.group).toBe(
      'help',
    )
    expect(flatCommands.value.find(command => command.id === 'help-docs-link')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'chat-link')?.group).toBe('help')
    expect(flatCommands.value.find(command => command.id === 'npmx-chat-link')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'builders-chat-link')?.group).toBe(
      'npmx',
    )
    expect(flatCommands.value.find(command => command.id === 'about')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'blog')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'privacy')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'accessibility')?.group).toBe('npmx')
    expect(flatCommands.value.find(command => command.id === 'settings')?.to).toEqual({
      name: 'settings',
    })
    expect(flatCommands.value.find(command => command.id === 'chat-link')?.href).toBe(
      'https://chat.npmx.dev',
    )
    expect(flatCommands.value.find(command => command.id === 'relative-dates')?.badge).toBe('off')
    expect(flatCommands.value.find(command => command.id === 'settings')?.label).toBe('settings')
    expect(flatCommands.value.find(command => command.id === 'theme-system')?.active).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'theme-dark')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'accent-colors')?.badge).toBe('Sky')
    expect(flatCommands.value.find(command => command.id === 'background-themes')?.badge).toBe(
      'Neutral',
    )

    wrapper.unmount()
  })

  it('filters commands locally with Fuse', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      query: 'dark',
    })

    expect(groupedCommands.value.some(group => group.id === 'settings')).toBe(true)
    expect(flatCommands.value.some(command => command.id === 'theme-dark')).toBe(true)

    wrapper.unmount()
  })

  it('surfaces matching locale commands on the root palette', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      query: 'francais',
    })

    expect(groupedCommands.value.map(group => group.id)).toContain('language')
    expect(flatCommands.value.find(command => command.id === 'root-locale:fr-FR')?.label).toBe(
      'Language: Français',
    )

    wrapper.unmount()
  })

  it('adds package commands and keeps versions grouped last', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.0',
        latestVersion: '3.5.0',
        versions: ['3.3.0', '3.5.0', '3.4.0'],
        tarballUrl: 'https://registry.npmjs.org/vue/-/vue-3.4.0.tgz',
      },
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual([
      'package',
      'navigation',
      'connections',
      'settings',
      'help',
      'npmx',
      'versions',
    ])
    expect(flatCommands.value.find(command => command.id === 'package-diff')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'package-download')).toBeTruthy()
    expect(flatCommands.value.find(command => command.id === 'package-main')?.to).toBeTruthy()
    expect(groupedCommands.value.at(-1)?.id).toBe('versions')
    expect(groupedCommands.value.at(-1)?.items[0]?.id).toBe('version:3.4.0')
    expect(groupedCommands.value.at(-1)?.items[0]?.active).toBe(true)

    wrapper.unmount()
  })

  it('filters only version commands when the query is a valid semver range', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      route: '/package/vue',
      query: '^3.4.0',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.2',
        latestVersion: '4.0.0',
        versions: ['4.0.0', '3.5.0', '3.4.2', '3.3.0'],
      },
    })

    expect(flatCommands.value.find(command => command.id === 'search')).toBeTruthy()
    expect(
      groupedCommands.value.find(group => group.id === 'versions')?.items.map(item => item.id),
    ).toEqual(['version:3.4.2', 'version:3.5.0'])
    expect(flatCommands.value.find(command => command.id === 'version:3.4.2')?.label).toBe('3.4.2')

    wrapper.unmount()
  })

  it('keeps version navigation on the current surface when a version URL pattern is provided', async () => {
    const { wrapper, flatCommands, routePath } = await captureCommandPalette({
      route: '/package-code/vue/v/3.4.2/src/index.ts',
      packageContext: {
        packageName: 'vue',
        resolvedVersion: '3.4.2',
        latestVersion: '4.0.0',
        versions: ['4.0.0', '3.5.0', '3.4.2'],
      },
      versionUrlPattern: '/package-code/vue/v/{version}/src/index.ts',
    })

    const versionCommand = flatCommands.value.find(command => command.id === 'version:3.5.0')

    expect(versionCommand && 'to' in versionCommand).toBe(true)
    if (!versionCommand || !('to' in versionCommand)) {
      throw new Error('Expected version command to use `to` navigation')
    }

    await navigateTo(versionCommand.to)

    await vi.waitFor(() => {
      expect(routePath.value).toBe('/package-code/vue/v/3.5.0/src/index.ts')
    })

    wrapper.unmount()
  })

  it('keeps the search action available when a query is present', async () => {
    const { wrapper, flatCommands } = await captureCommandPalette({
      query: 'webpack',
    })

    expect(flatCommands.value.find(command => command.id === 'search')).toBeTruthy()
    expect(flatCommands.value.at(-1)?.id).toBe('search')
    expect(flatCommands.value.at(-1)?.label).toBe('Search for "webpack"')

    wrapper.unmount()
  })

  it('shows language commands on the language subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'languages',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['language', 'links'])
    expect(flatCommands.value.find(command => command.id === 'language-help-translate')?.href).toBe(
      'https://i18n.npmx.dev/',
    )
    expect(flatCommands.value.some(command => command.id.startsWith('locale:'))).toBe(true)

    wrapper.unmount()
  })

  it('shows accent color commands on the accent color subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'accent-colors',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['settings'])
    expect(flatCommands.value.find(command => command.id === 'accent-color:sky')?.active).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'accent-color:coral')).toBeTruthy()

    wrapper.unmount()
  })

  it('shows background theme commands on the background theme subpage', async () => {
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      view: 'background-themes',
    })

    expect(groupedCommands.value.map(group => group.id)).toEqual(['settings'])
    expect(
      flatCommands.value.find(command => command.id === 'background-theme:neutral')?.active,
    ).toBe(true)
    expect(flatCommands.value.find(command => command.id === 'background-theme:stone')).toBeTruthy()

    wrapper.unmount()
  })

  it('includes registered page context commands', async () => {
    const action = vi.fn()
    const { wrapper, groupedCommands, flatCommands } = await captureCommandPalette({
      contextCommands: [
        {
          id: 'context-copy',
          group: 'package',
          label: 'Copy thing',
          keywords: ['thing'],
          iconClass: 'i-lucide:copy',
          action,
        },
      ],
    })

    expect(groupedCommands.value.map(group => group.id)).toContain('package')

    await flatCommands.value.find(command => command.id === 'context-copy')?.action!()
    expect(action).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
