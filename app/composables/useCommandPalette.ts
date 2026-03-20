import type { MaybeRefOrGetter } from 'vue'
import type {
  CommandPaletteContextCommand,
  CommandPaletteContextCommandInput,
  CommandPaletteCommand,
  CommandPaletteGroup,
  CommandPalettePackageContext,
  CommandPaletteView,
} from '~/types/command-palette'

const commandPaletteActionRegistry = new Map<string, () => void | Promise<void>>()
const commandPaletteActionIdsByScopeId = new Map<string, string[]>()
const commandPalettePackageContextOpenRegistry = new Map<string, () => void | Promise<void>>()
const commandPaletteQueryOverrideRegistry = new Map<
  string,
  (query: string) => CommandPaletteCommand[] | null
>()

function stripContextCommandAction(
  command: CommandPaletteContextCommandInput,
  actionId: string,
): CommandPaletteContextCommand {
  if ('action' in command) {
    const { action: _action, ...serializedCommand } = command
    return {
      ...serializedCommand,
      actionId,
    }
  }

  return {
    ...command,
    actionId,
  }
}

export function useCommandPalette() {
  const isOpen = useState('command-palette:is-open', () => false)
  const query = useState('command-palette:query', () => '')
  const view = useState<CommandPaletteView>('command-palette:view', () => 'root')
  const packageContext = useState<CommandPalettePackageContext | null>(
    'command-palette:package-context',
    () => null,
  )
  const packageContextScopeId = useState<string | null>(
    'command-palette:package-context-scope-id',
    () => null,
  )
  const contextCommands = useState<
    Array<{ scopeId: string; commands: CommandPaletteContextCommand[] }>
  >('command-palette:context-commands', () => [])
  const queryOverrides = useState<Array<{ scopeId: string; group: CommandPaletteGroup }>>(
    'command-palette:query-overrides',
    () => [],
  )

  function open() {
    isOpen.value = true

    if (import.meta.client) {
      const scopeId = packageContextScopeId.value
      if (!scopeId) return

      const onOpen = commandPalettePackageContextOpenRegistry.get(scopeId)
      if (!onOpen) return

      void Promise.resolve(onOpen()).catch(() => {})
    }
  }

  function close() {
    isOpen.value = false
    query.value = ''
    view.value = 'root'
  }

  function toggle() {
    if (isOpen.value) {
      close()
      return
    }

    open()
  }

  function setView(nextView: CommandPaletteView) {
    view.value = nextView
    query.value = ''
  }

  function setPackageContext(context: CommandPalettePackageContext, scopeId?: string) {
    packageContext.value = context
    packageContextScopeId.value = scopeId ?? null
  }

  function clearPackageContext(scopeId?: string) {
    if (scopeId && packageContextScopeId.value !== scopeId) return

    packageContext.value = null
    packageContextScopeId.value = null
  }

  function setContextCommands(commands: CommandPaletteContextCommand[], scopeId: string) {
    const nextEntries = contextCommands.value.filter(entry => entry.scopeId !== scopeId)
    if (commands.length > 0) {
      nextEntries.push({ scopeId, commands })
    }
    contextCommands.value = nextEntries
  }

  function clearContextCommands(scopeId: string) {
    contextCommands.value = contextCommands.value.filter(entry => entry.scopeId !== scopeId)
  }

  function registerContextCommandActions(
    scopeId: string,
    commands: Array<{ actionId: string; action: () => void | Promise<void> }>,
  ) {
    const previousActionIds = commandPaletteActionIdsByScopeId.get(scopeId) ?? []
    previousActionIds.forEach(actionId => {
      commandPaletteActionRegistry.delete(actionId)
    })

    const nextActionIds: string[] = []
    commands.forEach(command => {
      commandPaletteActionRegistry.set(command.actionId, command.action)
      nextActionIds.push(command.actionId)
    })
    commandPaletteActionIdsByScopeId.set(scopeId, nextActionIds)
  }

  function clearContextCommandActions(scopeId: string) {
    const actionIds = commandPaletteActionIdsByScopeId.get(scopeId) ?? []
    actionIds.forEach(actionId => {
      commandPaletteActionRegistry.delete(actionId)
    })
    commandPaletteActionIdsByScopeId.delete(scopeId)
  }

  function resolveContextCommandAction(actionId: string) {
    return commandPaletteActionRegistry.get(actionId)
  }

  function setPackageContextOnOpen(scopeId: string, onOpen: () => void | Promise<void>) {
    commandPalettePackageContextOpenRegistry.set(scopeId, onOpen)
  }

  function clearPackageContextOnOpen(scopeId: string) {
    commandPalettePackageContextOpenRegistry.delete(scopeId)
  }

  function setQueryOverride(
    scopeId: string,
    group: CommandPaletteGroup,
    resolve: (query: string) => CommandPaletteCommand[] | null,
  ) {
    commandPaletteQueryOverrideRegistry.set(`${scopeId}:${group}`, resolve)
    queryOverrides.value = [
      ...queryOverrides.value.filter(
        entry => !(entry.scopeId === scopeId && entry.group === group),
      ),
      { scopeId, group },
    ]
  }

  function clearQueryOverride(scopeId: string, group: CommandPaletteGroup) {
    commandPaletteQueryOverrideRegistry.delete(`${scopeId}:${group}`)
    queryOverrides.value = queryOverrides.value.filter(
      entry => !(entry.scopeId === scopeId && entry.group === group),
    )
  }

  function resolveQueryOverride(scopeId: string, group: CommandPaletteGroup) {
    return commandPaletteQueryOverrideRegistry.get(`${scopeId}:${group}`)
  }

  return {
    isOpen,
    query,
    view,
    packageContext,
    contextCommands,
    queryOverrides,
    open,
    close,
    toggle,
    setView,
    setPackageContext,
    clearPackageContext,
    setContextCommands,
    clearContextCommands,
    registerContextCommandActions,
    clearContextCommandActions,
    resolveContextCommandAction,
    setPackageContextOnOpen,
    clearPackageContextOnOpen,
    setQueryOverride,
    clearQueryOverride,
    resolveQueryOverride,
  }
}

export function useCommandPalettePackageContext(
  context: MaybeRefOrGetter<CommandPalettePackageContext | null>,
  options?: {
    onOpen?: () => void | Promise<void>
  },
) {
  const {
    setPackageContext,
    clearPackageContext,
    setPackageContextOnOpen,
    clearPackageContextOnOpen,
  } = useCommandPalette()
  const scopeId = useId()

  if (import.meta.client && options?.onOpen) {
    setPackageContextOnOpen(scopeId, options.onOpen)
  }

  watchEffect(() => {
    const value = toValue(context)
    if (value) {
      setPackageContext(value, scopeId)
      return
    }

    clearPackageContext(scopeId)
  })

  onScopeDispose(() => {
    clearPackageContext(scopeId)
    if (import.meta.client) {
      clearPackageContextOnOpen(scopeId)
    }
  })
}

export function useCommandPaletteContextCommands(
  commands: MaybeRefOrGetter<CommandPaletteContextCommandInput[]>,
) {
  const {
    setContextCommands,
    clearContextCommands,
    registerContextCommandActions,
    clearContextCommandActions,
  } = useCommandPalette()
  const scopeId = useId()

  watch(
    () => toValue(commands),
    value => {
      const serializedCommands = value.map((command, index) =>
        stripContextCommandAction(command, `${scopeId}:${index}`),
      )

      setContextCommands(serializedCommands, scopeId)

      if (import.meta.client) {
        registerContextCommandActions(
          scopeId,
          value.flatMap((command, index) =>
            command.action != null
              ? [
                  {
                    actionId: `${scopeId}:${index}`,
                    action: command.action,
                  },
                ]
              : [],
          ),
        )
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearContextCommands(scopeId)
    if (import.meta.client) {
      clearContextCommandActions(scopeId)
    }
  })
}

export function useCommandPaletteQueryOverride(
  group: CommandPaletteGroup,
  resolve: (query: string) => CommandPaletteCommand[] | null,
) {
  const { setQueryOverride, clearQueryOverride } = useCommandPalette()
  const scopeId = useId()

  setQueryOverride(scopeId, group, resolve)

  onScopeDispose(() => {
    clearQueryOverride(scopeId, group)
  })
}
