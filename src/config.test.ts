import { describe, expect, it } from 'vitest'
import { DEFAULT_IS_MOCK, resolveApiRequest, resolveIsMock } from './config'

describe('API data mode configuration', () => {
  it('defaults to mock mode and accepts only exact true or false values', () => {
    expect(DEFAULT_IS_MOCK).toBe(true)
    expect(resolveIsMock(undefined)).toBe(true)
    expect(resolveIsMock('true')).toBe(true)
    expect(resolveIsMock('false')).toBe(false)
    expect(() => resolveIsMock('FALSE')).toThrow('VITE_IS_MOCK')
    expect(() => resolveIsMock('')).toThrow('VITE_IS_MOCK')
  })

  it('uses the local Vite proxy when mock mode has no explicit API origin in development', () => {
    expect(
      resolveApiRequest('/api/v1/auth/csrf', {
        isMock: true,
        isDevelopment: true,
      }),
    ).toEqual({ url: '/api/v1/auth/csrf', credentials: 'same-origin' })
  })

  it('routes mock and live requests to their selected API origins with credentials', () => {
    expect(
      resolveApiRequest('/api/v1/accounts', {
        isMock: true,
        isDevelopment: true,
        mockApiBaseUrl: 'http://127.0.0.1:5504',
        realApiBaseUrl: 'http://127.0.0.1:1',
      }),
    ).toEqual({ url: 'http://127.0.0.1:5504/api/v1/accounts', credentials: 'include' })

    expect(
      resolveApiRequest('/api/v1/accounts', {
        isMock: false,
        isDevelopment: true,
        mockApiBaseUrl: 'http://127.0.0.1:1',
        realApiBaseUrl: 'https://api.example.test',
      }),
    ).toEqual({ url: 'https://api.example.test/api/v1/accounts', credentials: 'include' })
  })

  it('fails explicitly when the selected endpoint is missing or unsafe', () => {
    expect(() =>
      resolveApiRequest('/api/v1/accounts', {
        isMock: false,
        isDevelopment: true,
      }),
    ).toThrow('VITE_REAL_API_BASE_URL')
    expect(() =>
      resolveApiRequest('/api/v1/accounts', {
        isMock: true,
        isDevelopment: false,
      }),
    ).toThrow('VITE_MOCK_API_BASE_URL')
    expect(() =>
      resolveApiRequest('/api/v1/accounts', {
        isMock: false,
        isDevelopment: true,
        realApiBaseUrl: 'http://api.example.test',
      }),
    ).toThrow('HTTPS')
    expect(() =>
      resolveApiRequest('/api/v1/accounts', {
        isMock: false,
        isDevelopment: true,
        realApiBaseUrl: 'https://api.example.test/v1',
      }),
    ).toThrow('without a path')
    expect(() =>
      resolveApiRequest('//api.example.test/api/v1/accounts', {
        isMock: true,
        isDevelopment: true,
      }),
    ).toThrow('same-origin')
  })
})
