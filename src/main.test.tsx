// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rootMocks = vi.hoisted(() => {
  const render = vi.fn()
  return {
    createRoot: vi.fn(() => ({ render })),
    render,
  }
})

vi.mock('react-dom/client', () => ({ createRoot: rootMocks.createRoot }))

beforeEach(() => {
  vi.resetModules()
  rootMocks.createRoot.mockClear()
  rootMocks.render.mockClear()
  document.body.innerHTML = '<div id="root"></div>'
})

describe('application entry point', () => {
  it('mounts the root and renders the content provider tree', async () => {
    await import('./main')

    expect(rootMocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'))
    expect(rootMocks.render).toHaveBeenCalledOnce()
  })

  it('fails clearly when the expected application root is missing', async () => {
    document.body.innerHTML = ''

    await expect(import('./main')).rejects.toThrow('APP_ROOT_MISSING')
    expect(rootMocks.createRoot).not.toHaveBeenCalled()
  })
})
