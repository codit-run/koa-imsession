import { expect, test } from 'vitest'
import { SessionIdResolver } from './sessionid-resolver.js'
import { createContext } from './test-utils.js'

const sessionIdResolver = new SessionIdResolver({ name: 'connsid' })

test('generates session ID', () => {
  const ctx = createContext()
  expect(sessionIdResolver.generate(ctx)).toMatch(/^\w{32}$/)
})

test('gets session ID', () => {
  const ctx = createContext(
    {
      headers: { 'cookie': 'connsid=c650059107b876d453cb25a6d2dd0e36' },
    },
  )
  expect(sessionIdResolver.get(ctx)).toBe('c650059107b876d453cb25a6d2dd0e36')
})

test('sets session ID', () => {
  const ctx = createContext()
  sessionIdResolver.set(ctx, 'c650059107b876d453cb25a6d2dd0e36')
  expect((ctx.res.getHeader('Set-Cookie') as string[])[0]).toMatch(/^connsid=c650059107b876d453cb25a6d2dd0e36;/)
})
