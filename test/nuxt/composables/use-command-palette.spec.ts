import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref, type PropType } from 'vue'
import type { CommandPalettePackageContext } from '~/types/command-palette'

const packageA = {
  packageName: 'alpha',
  resolvedVersion: '1.0.0',
  latestVersion: '1.1.0',
  versions: ['1.0.0', '1.1.0'],
}

const packageB = {
  packageName: 'beta',
  resolvedVersion: '2.0.0',
  latestVersion: '2.1.0',
  versions: ['2.0.0', '2.1.0'],
}

afterEach(() => {
  useCommandPalette().clearPackageContext()
})

describe('useCommandPalettePackageContext', () => {
  it('keeps the newer package context when an older scope unmounts later', async () => {
    const showAlpha = ref(true)
    const showBeta = ref(false)
    let commandPalette!: ReturnType<typeof useCommandPalette>

    const ContextOwner = defineComponent({
      name: 'ContextOwner',
      props: {
        context: {
          type: Object as PropType<CommandPalettePackageContext>,
          required: true,
        },
      },
      setup(props) {
        useCommandPalettePackageContext(() => props.context)
        return () => h('div')
      },
    })

    const Harness = defineComponent({
      name: 'CommandPaletteContextHarness',
      setup() {
        commandPalette = useCommandPalette()
        return () =>
          h('div', [
            showAlpha.value ? h(ContextOwner, { context: packageA }) : null,
            showBeta.value ? h(ContextOwner, { context: packageB }) : null,
          ])
      },
    })

    const wrapper = await mountSuspended(Harness)

    expect(commandPalette.packageContext.value?.packageName).toBe('alpha')

    showBeta.value = true
    await nextTick()

    expect(commandPalette.packageContext.value?.packageName).toBe('beta')

    showAlpha.value = false
    await nextTick()

    expect(commandPalette.packageContext.value?.packageName).toBe('beta')

    wrapper.unmount()
  })

  it('runs the active package context onOpen hook when the palette opens', async () => {
    const showAlpha = ref(true)
    const showBeta = ref(false)
    const onOpenAlpha = vi.fn()
    const onOpenBeta = vi.fn()
    let commandPalette!: ReturnType<typeof useCommandPalette>

    const ContextOwner = defineComponent({
      name: 'ContextOwner',
      props: {
        context: {
          type: Object as PropType<CommandPalettePackageContext>,
          required: true,
        },
        onOpen: {
          type: Function as PropType<() => void | Promise<void>>,
          required: true,
        },
      },
      setup(props) {
        useCommandPalettePackageContext(() => props.context, {
          onOpen: props.onOpen,
        })
        return () => h('div')
      },
    })

    const Harness = defineComponent({
      name: 'CommandPaletteContextOpenHarness',
      setup() {
        commandPalette = useCommandPalette()
        return () =>
          h('div', [
            showAlpha.value ? h(ContextOwner, { context: packageA, onOpen: onOpenAlpha }) : null,
            showBeta.value ? h(ContextOwner, { context: packageB, onOpen: onOpenBeta }) : null,
          ])
      },
    })

    const wrapper = await mountSuspended(Harness)

    commandPalette.open()
    await nextTick()

    expect(onOpenAlpha).toHaveBeenCalledTimes(1)
    expect(onOpenBeta).not.toHaveBeenCalled()

    commandPalette.close()
    showBeta.value = true
    await nextTick()

    commandPalette.open()
    await nextTick()

    expect(onOpenAlpha).toHaveBeenCalledTimes(1)
    expect(onOpenBeta).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
