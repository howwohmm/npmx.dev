import type { CommandPaletteCommand } from '~/types/command-palette'
import {
  DISCORD_BUILDERS_URL,
  DISCORD_COMMUNITY_URL,
  NPMX_DOCS_SITE,
} from '#shared/utils/constants'
import type { CommandPaletteView } from '~/types/command-palette'

interface UseCommandPaletteGlobalCommandsOptions {
  submitSearchQuery: () => Promise<void>
}

type CommandPaletteSubview = Exclude<CommandPaletteView, 'root'>

interface CommandPaletteViewDefinition {
  commands: CommandPaletteCommand[]
  placeholder: string
  rootSearchCommands?: CommandPaletteCommand[]
  subtitle: string
}

function addSearchKeyword(keywords: Set<string>, value: string | null | undefined) {
  if (!value) return

  const trimmedValue = value.trim()
  if (!trimmedValue) return

  keywords.add(trimmedValue)

  const foldedValue = trimmedValue.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  if (foldedValue !== trimmedValue) {
    keywords.add(foldedValue)
  }
}

function getLocaleDisplayName(displayLocale: string, code: string) {
  try {
    return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(code) ?? null
  } catch {
    return null
  }
}

function getLocaleSearchKeywords(
  code: string,
  label: string,
  activeLocale: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  const keywords = new Set<string>()
  const baseCode = code.split('-')[0] ?? code

  addSearchKeyword(keywords, code)
  addSearchKeyword(keywords, baseCode)
  addSearchKeyword(keywords, label)
  addSearchKeyword(keywords, t('settings.language'))

  ;[
    getLocaleDisplayName(activeLocale, code),
    getLocaleDisplayName('en', code),
    getLocaleDisplayName(code, code),
    code === baseCode ? null : getLocaleDisplayName(activeLocale, baseCode),
    code === baseCode ? null : getLocaleDisplayName('en', baseCode),
    code === baseCode ? null : getLocaleDisplayName(baseCode, baseCode),
  ].forEach(value => addSearchKeyword(keywords, value))

  return [...keywords]
}

function activeLabel(isCurrentRoute: boolean, label: string) {
  return isCurrentRoute ? label : null
}

function withRootSearchLabel(command: CommandPaletteCommand, label: string): CommandPaletteCommand {
  const commandBase = {
    id: `root-${command.id}`,
    group: command.group,
    label,
    keywords: command.keywords,
    iconClass: command.iconClass,
    badge: command.badge,
    active: command.active,
    activeLabel: command.activeLabel,
  }

  if (command.to != null) {
    return {
      ...commandBase,
      to: command.to,
    }
  }

  if (command.href != null) {
    return {
      ...commandBase,
      href: command.href,
    }
  }

  return {
    ...commandBase,
    action: command.action!,
  }
}

export function useCommandPaletteGlobalCommands({
  submitSearchQuery,
}: UseCommandPaletteGlobalCommandsOptions) {
  const { locale, locales, setLocale, t } = useI18n()
  const route = useRoute()
  const colorMode = useColorMode()
  const { accentColors, selectedAccentColor, setAccentColor } = useAccentColor()
  const { backgroundThemes, selectedBackgroundTheme, setBackgroundTheme } = useBackgroundTheme()
  const connectorModal = useModal('connector-modal')
  const authModal = useModal('auth-modal')
  const keyboardShortcutsModal = useModal('keyboard-shortcuts-modal')
  const { settings } = useSettings()
  const { isConnected: isNpmConnected, npmUser, disconnect: disconnectNpm } = useConnector()
  const { user: atprotoUser, logout } = useAtproto()
  const { close, setView } = useCommandPalette()

  function closeThen(run: () => void | Promise<void>) {
    return async () => {
      close()
      await run()
    }
  }

  const currentLocaleLabel = computed(() => {
    const current = locales.value.find(entry =>
      typeof entry === 'string' ? entry === locale.value : entry.code === locale.value,
    )

    if (!current) return locale.value
    return typeof current === 'string' ? current : (current.name ?? current.code)
  })
  const currentAccentColorLabel = computed(() => {
    const activeAccentColorId = selectedAccentColor.value ?? 'sky'
    const activeAccentColor = accentColors.value.find(color => color.id === activeAccentColorId)

    if (!activeAccentColor) return activeAccentColorId
    return activeAccentColor.id === 'neutral' ? t('settings.clear_accent') : activeAccentColor.label
  })
  const currentBackgroundThemeLabel = computed(() => {
    const activeBackgroundThemeId = selectedBackgroundTheme.value ?? 'neutral'
    return (
      backgroundThemes.value.find(theme => theme.id === activeBackgroundThemeId)?.label ??
      activeBackgroundThemeId
    )
  })
  const localeCommands = computed<CommandPaletteCommand[]>(() =>
    locales.value.map(entry => {
      const code = typeof entry === 'string' ? entry : entry.code
      const label = typeof entry === 'string' ? entry : (entry.name ?? entry.code)

      return {
        id: `locale:${code}`,
        group: 'language' as const,
        label,
        keywords: getLocaleSearchKeywords(code, label, locale.value, t),
        iconClass: 'i-lucide:languages',
        active: code === locale.value,
        activeLabel: code === locale.value ? t('command_palette.current') : null,
        action: closeThen(async () => {
          await setLocale(code)
        }),
      }
    }),
  )
  const accentColorCommands = computed<CommandPaletteCommand[]>(() => {
    const activeAccentColorId = selectedAccentColor.value ?? 'sky'

    return accentColors.value.map(color => ({
      id: `accent-color:${color.id}`,
      group: 'settings' as const,
      label: color.id === 'neutral' ? t('settings.clear_accent') : color.label,
      keywords: [color.label, color.id, t('settings.accent_colors.label'), t('settings.theme')],
      iconClass: 'i-lucide:palette',
      previewColor: color.value,
      active: color.id === activeAccentColorId,
      activeLabel: color.id === activeAccentColorId ? t('command_palette.current') : null,
      action: closeThen(() => {
        setAccentColor(color.id)
      }),
    }))
  })
  const backgroundThemeCommands = computed<CommandPaletteCommand[]>(() => {
    const activeBackgroundThemeId = selectedBackgroundTheme.value ?? 'neutral'

    return backgroundThemes.value.map(theme => ({
      id: `background-theme:${theme.id}`,
      group: 'settings' as const,
      label: theme.label,
      keywords: [theme.label, theme.id, t('settings.background_themes.label'), t('settings.theme')],
      iconClass: 'i-lucide:swatch-book',
      previewColor: theme.value,
      active: theme.id === activeBackgroundThemeId,
      activeLabel: theme.id === activeBackgroundThemeId ? t('command_palette.current') : null,
      action: closeThen(() => {
        setBackgroundTheme(theme.id)
      }),
    }))
  })

  const globalCommands = computed<CommandPaletteCommand[]>(() => {
    const items: CommandPaletteCommand[] = [
      {
        id: 'search',
        group: 'navigation',
        label: t('command_palette.actions.search'),
        keywords: [t('search.title_packages'), t('search.label')],
        iconClass: 'i-lucide:search',
        action: submitSearchQuery,
      },
      {
        id: 'keyboard-shortcuts',
        group: 'help',
        label: t('command_palette.actions.keyboard_shortcuts'),
        keywords: [t('footer.keyboard_shortcuts'), t('shortcuts.show_kbd_hints')],
        iconClass: 'i-lucide:command',
        action: closeThen(() => {
          keyboardShortcutsModal.open()
        }),
      },
      {
        id: 'language',
        group: 'settings',
        label: t('settings.language'),
        keywords: [t('settings.sections.language'), currentLocaleLabel.value, locale.value],
        iconClass: 'i-lucide:languages',
        badge: currentLocaleLabel.value,
        action: async () => {
          setView('languages')
        },
      },
      {
        id: 'relative-dates',
        group: 'settings',
        label: t('settings.relative_dates'),
        keywords: [t('settings.sections.display'), t('package.stats.published')],
        iconClass: 'i-lucide:calendar-days',
        badge: settings.value.relativeDates
          ? t('command_palette.state.on')
          : t('command_palette.state.off'),
        action: closeThen(() => {
          settings.value.relativeDates = !settings.value.relativeDates
        }),
      },
      {
        id: 'home',
        group: 'navigation',
        label: t('command_palette.navigation.home'),
        keywords: [t('header.home')],
        iconClass: 'i-lucide:house',
        active: route.name === 'index',
        activeLabel: activeLabel(route.name === 'index', t('command_palette.here')),
        to: { name: 'index' },
      },
      {
        id: 'compare',
        group: 'navigation',
        label: t('nav.compare'),
        keywords: [t('shortcuts.compare')],
        iconClass: 'i-lucide:git-compare',
        active: route.name === 'compare',
        activeLabel: activeLabel(route.name === 'compare', t('command_palette.here')),
        to: { name: 'compare' },
      },
      {
        id: 'settings',
        group: 'navigation',
        label: t('nav.settings'),
        keywords: [t('shortcuts.settings')],
        iconClass: 'i-lucide:settings',
        active: route.name === 'settings',
        activeLabel: activeLabel(route.name === 'settings', t('command_palette.here')),
        to: { name: 'settings' },
      },
      {
        id: 'about',
        group: 'npmx',
        label: t('footer.about'),
        keywords: [t('footer.about')],
        iconClass: 'i-lucide:info',
        active: route.name === 'about',
        activeLabel: activeLabel(route.name === 'about', t('command_palette.here')),
        to: { name: 'about' },
      },
      {
        id: 'blog',
        group: 'npmx',
        label: t('footer.blog'),
        keywords: [t('blog.title')],
        iconClass: 'i-lucide:notebook-pen',
        active: `${route.name ?? ''}`.startsWith('blog'),
        activeLabel: activeLabel(
          `${route.name ?? ''}`.startsWith('blog'),
          t('command_palette.here'),
        ),
        to: { name: 'blog' },
      },
      {
        id: 'privacy',
        group: 'npmx',
        label: t('privacy_policy.title'),
        keywords: [t('privacy_policy.title')],
        iconClass: 'i-lucide:shield-check',
        active: route.name === 'privacy',
        activeLabel: activeLabel(route.name === 'privacy', t('command_palette.here')),
        to: { name: 'privacy' },
      },
      {
        id: 'accessibility',
        group: 'npmx',
        label: t('a11y.title'),
        keywords: [t('a11y.footer_title')],
        iconClass: 'i-custom:a11y',
        active: route.name === 'accessibility',
        activeLabel: activeLabel(route.name === 'accessibility', t('command_palette.here')),
        to: { name: 'accessibility' },
      },
      {
        id: 'npm-connection',
        group: 'connections',
        label:
          isNpmConnected.value && npmUser.value
            ? t('command_palette.connections.npm_connected', { username: npmUser.value })
            : t('command_palette.connections.npm_connect'),
        keywords: [t('account_menu.npm_cli')],
        iconClass: 'i-lucide:terminal',
        badge: isNpmConnected.value ? t('command_palette.connected') : null,
        action: closeThen(() => {
          connectorModal.open()
        }),
      },
      {
        id: 'atproto-connection',
        group: 'connections',
        label: atprotoUser.value?.handle
          ? t('command_palette.connections.atmosphere_connected', {
              handle: atprotoUser.value.handle,
            })
          : t('command_palette.connections.atmosphere_connect'),
        keywords: [t('account_menu.atmosphere')],
        iconClass: 'i-lucide:at-sign',
        badge: atprotoUser.value ? t('command_palette.connected') : null,
        action: closeThen(() => {
          authModal.open()
        }),
      },
      {
        id: 'help-docs-link',
        group: 'help',
        label: t('footer.docs'),
        keywords: [t('footer.docs')],
        iconClass: 'i-lucide:file-text',
        href: NPMX_DOCS_SITE,
      },
      {
        id: 'chat-link',
        group: 'help',
        label: t('footer.chat'),
        keywords: [t('footer.chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_COMMUNITY_URL,
      },
      {
        id: 'docs-link',
        group: 'npmx',
        label: t('footer.docs'),
        keywords: [t('footer.docs')],
        iconClass: 'i-lucide:file-text',
        href: NPMX_DOCS_SITE,
      },
      {
        id: 'npmx-chat-link',
        group: 'npmx',
        label: t('footer.chat'),
        keywords: [t('footer.chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_COMMUNITY_URL,
      },
      {
        id: 'builders-chat-link',
        group: 'npmx',
        label: t('footer.builders_chat'),
        keywords: [t('footer.builders_chat')],
        iconClass: 'i-lucide:message-circle',
        href: DISCORD_BUILDERS_URL,
      },
      {
        id: 'source-link',
        group: 'npmx',
        label: t('footer.source'),
        keywords: [t('footer.source')],
        iconClass: 'i-simple-icons:github',
        href: 'https://repo.npmx.dev',
      },
      {
        id: 'social-link',
        group: 'npmx',
        label: t('footer.social'),
        keywords: [t('footer.social')],
        iconClass: 'i-simple-icons:bluesky',
        href: 'https://social.npmx.dev',
      },
      {
        id: 'theme-system',
        group: 'settings',
        label: t('command_palette.theme.system'),
        keywords: [t('settings.theme_system'), t('settings.theme')],
        iconClass: 'i-lucide:monitor',
        active: colorMode.preference === 'system',
        action: closeThen(() => {
          colorMode.preference = 'system'
        }),
      },
      {
        id: 'theme-light',
        group: 'settings',
        label: t('command_palette.theme.light'),
        keywords: [t('settings.theme_light'), t('settings.theme')],
        iconClass: 'i-lucide:sun',
        active: colorMode.preference === 'light',
        action: closeThen(() => {
          colorMode.preference = 'light'
        }),
      },
      {
        id: 'theme-dark',
        group: 'settings',
        label: t('command_palette.theme.dark'),
        keywords: [t('settings.theme_dark'), t('settings.theme')],
        iconClass: 'i-lucide:moon',
        active: colorMode.preference === 'dark',
        action: closeThen(() => {
          colorMode.preference = 'dark'
        }),
      },
      {
        id: 'accent-colors',
        group: 'settings',
        label: t('settings.accent_colors.label'),
        keywords: [
          t('settings.accent_colors.label'),
          currentAccentColorLabel.value,
          t('settings.theme'),
        ],
        iconClass: 'i-lucide:palette',
        badge: currentAccentColorLabel.value,
        action: async () => {
          setView('accent-colors')
        },
      },
      {
        id: 'background-themes',
        group: 'settings',
        label: t('settings.background_themes.label'),
        keywords: [
          t('settings.background_themes.label'),
          currentBackgroundThemeLabel.value,
          t('settings.theme'),
        ],
        iconClass: 'i-lucide:swatch-book',
        badge: currentBackgroundThemeLabel.value,
        action: async () => {
          setView('background-themes')
        },
      },
    ]

    if (isNpmConnected.value && npmUser.value) {
      items.push(
        {
          id: 'npm-disconnect',
          group: 'connections',
          label: t('command_palette.connections.npm_disconnect'),
          keywords: [
            npmUser.value,
            t('command_palette.connections.npm_connected', { username: npmUser.value }),
          ],
          iconClass: 'i-lucide:plug-zap',
          action: closeThen(() => {
            disconnectNpm()
          }),
        },
        {
          id: 'my-packages',
          group: 'navigation',
          label: t('command_palette.navigation.packages', { username: npmUser.value }),
          keywords: [npmUser.value, t('header.packages')],
          iconClass: 'i-lucide:boxes',
          active: route.name === '~username' && route.params.username?.toString() === npmUser.value,
          activeLabel: activeLabel(
            route.name === '~username' && route.params.username?.toString() === npmUser.value,
            t('command_palette.here'),
          ),
          to: {
            name: '~username',
            params: {
              username: npmUser.value!,
            },
          },
        },
        {
          id: 'my-orgs',
          group: 'navigation',
          label: t('command_palette.navigation.orgs', { username: npmUser.value }),
          keywords: [npmUser.value, t('header.orgs')],
          iconClass: 'i-lucide:users',
          active:
            route.name === '~username-orgs' && route.params.username?.toString() === npmUser.value,
          activeLabel: activeLabel(
            route.name === '~username-orgs' && route.params.username?.toString() === npmUser.value,
            t('command_palette.here'),
          ),
          to: {
            name: '~username-orgs',
            params: {
              username: npmUser.value!,
            },
          },
        },
      )
    }

    if (atprotoUser.value != null) {
      items.push(
        {
          id: 'atproto-disconnect',
          group: 'connections',
          label: t('command_palette.connections.atmosphere_disconnect'),
          keywords: [
            atprotoUser.value.handle,
            t('command_palette.connections.atmosphere_connected', {
              handle: atprotoUser.value.handle,
            }),
          ],
          iconClass: 'i-lucide:log-out',
          action: closeThen(async () => {
            await logout()
          }),
        },
        {
          id: 'my-profile',
          group: 'navigation',
          label: t('command_palette.navigation.profile', { handle: atprotoUser.value.handle }),
          keywords: [atprotoUser.value.handle, t('account_menu.atmosphere')],
          iconClass: 'i-lucide:user',
          active:
            route.name === 'profile-identity' &&
            route.params.identity?.toString() === atprotoUser.value.handle,
          activeLabel: activeLabel(
            route.name === 'profile-identity' &&
              route.params.identity?.toString() === atprotoUser.value.handle,
            t('command_palette.here'),
          ),
          to: {
            name: 'profile-identity',
            params: {
              identity: atprotoUser.value!.handle,
            },
          },
        },
      )
    }

    return items
  })

  const viewDefinitions = computed<Record<CommandPaletteSubview, CommandPaletteViewDefinition>>(
    () => ({
      'languages': {
        commands: [
          ...localeCommands.value,
          {
            id: 'language-help-translate',
            group: 'links',
            label: t('command_palette.actions.help_translate'),
            keywords: [t('settings.help_translate'), t('settings.language')],
            iconClass: 'i-lucide:languages',
            href: 'https://i18n.npmx.dev/',
          },
        ],
        placeholder: t('settings.language'),
        rootSearchCommands: localeCommands.value.map(command =>
          withRootSearchLabel(command, `${t('settings.language')}: ${command.label}`),
        ),
        subtitle: t('command_palette.subtitle_languages'),
      },
      'accent-colors': {
        commands: accentColorCommands.value,
        placeholder: t('settings.accent_colors.label'),
        subtitle: t('settings.accent_colors.label'),
      },
      'background-themes': {
        commands: backgroundThemeCommands.value,
        placeholder: t('settings.background_themes.label'),
        subtitle: t('settings.background_themes.label'),
      },
    }),
  )

  return {
    globalCommands,
    viewDefinitions,
  }
}
