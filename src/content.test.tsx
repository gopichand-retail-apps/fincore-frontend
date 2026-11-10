// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentProvider } from './content'
import { useContent } from './content-context'
import { contentModelSchema, dataStringFrom, ledgerEntryDescription, type Translate } from './content-schema'
import fincoreModel from '../public/fincore-model.json'

function ContentProbe() {
  const { t } = useContent()
  return <p>{t('brand.name')}</p>
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function MissingContextProbe() {
  useContent()
  return null
}

describe('FinCore content model', () => {
  it('requires the shared content provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<MissingContextProbe />)).toThrow('CONTENT_PROVIDER_MISSING')
  })

  it('maps transfer ledger descriptions by stable transfer ID and direction', () => {
    const model = contentModelSchema.parse(fincoreModel)
    const modelMessages = new Map(Object.entries(model.messages))
    const translate: Translate = (key) => modelMessages.get(key) ?? key

    expect(
      ledgerEntryDescription(model, translate, {
        description: 'Transfer to Rainy day savings',
        transferId: 'transfer-demo-001',
        amountMinor: -12500,
      }),
    ).toBe(model.messages['ledger.transferSent'])
    expect(
      ledgerEntryDescription(model, translate, {
        description: 'Transfer from Everyday checking',
        transferId: 'transfer-demo-001',
        amountMinor: 12500,
      }),
    ).toBe(model.messages['ledger.transferReceived'])
    expect(
      ledgerEntryDescription(model, translate, {
        description: 'Monthly pay',
        amountMinor: 250000,
      }),
    ).toBe(dataStringFrom(model, 'ledgerDescriptions', 'Monthly pay'))
    expect(dataStringFrom(model, 'ledgerCategories', 'TRANSFER')).toBe('Internal transfer')
  })

  it('updates rendered copy and document metadata from the served model', async () => {
    const localizedModel = {
      ...fincoreModel,
      locale: 'fr-FR',
      messages: {
        ...fincoreModel.messages,
        'brand.name': 'FinCore FR',
        'meta.title': 'FinCore | Simulation bancaire',
        'meta.description': 'Comptes synthetiques et operations de demonstration.',
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(localizedModel), { status: 200 })))

    render(
      <ContentProvider appId="fincore" modelUrl="/fincore-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByText('FinCore FR')).toBeTruthy()
    expect(document.documentElement.lang).toBe('fr-FR')
    expect(document.title).toBe(localizedModel.messages['meta.title'])
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      localizedModel.messages['meta.description'],
    )
    expect(fetch).toHaveBeenCalledWith(
      '/fincore-model.json',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it.each([
    ['an unsuccessful response', new Response('unavailable', { status: 503 })],
    ['an unreadable response body', new Response('not-json', { status: 200 })],
    ['an invalid schema', new Response(JSON.stringify({ ...fincoreModel, unknown: true }), { status: 200 })],
    [
      'a different application model',
      new Response(JSON.stringify({ ...fincoreModel, appId: 'other-app' }), { status: 200 }),
    ],
    [
      'missing metadata',
      new Response(
        JSON.stringify({
          ...fincoreModel,
          messages: { ...fincoreModel.messages, 'meta.title': '' },
        }),
        { status: 200 },
      ),
    ],
  ])('fails closed on %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    render(
      <ContentProvider appId="fincore" modelUrl="/fincore-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(fincoreModel.messages['brand.name'])).toBeNull()
  })

  it('shows a loading failure when the model endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network details')))

    render(
      <ContentProvider appId="fincore" modelUrl="/fincore-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('network details')).toBeNull()
  })

  it('aborts an in-flight model request when the provider unmounts', async () => {
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn(
      (_url: RequestInfo | URL, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = options?.signal ?? undefined
          requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(
      <ContentProvider appId="fincore" modelUrl="/fincore-model.json">
        <ContentProbe />
      </ContentProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})
