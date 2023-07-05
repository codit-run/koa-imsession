import test from 'node:test'
import assert from 'node:assert'
import { SessionIdResolver } from './sessionid-resolver.js'
import { createContext } from './test-utils.js'

const sessionIdResolver = new SessionIdResolver({ name: 'connect.sid' })

test('generates session ID', async (t) => {
  const ctx = createContext()
  assert.match(sessionIdResolver.generate(ctx), /^\w{32}$/)
})

test('gets session ID', async (t) => {
  const ctx = createContext(
    {
      headers: { 'cookie': 'connect.sid=c650059107b876d453cb25a6d2dd0e36' },
    },
  )
  assert.strictEqual(sessionIdResolver.get(ctx), 'c650059107b876d453cb25a6d2dd0e36')
})

test('sets session ID', async (t) => {
  const ctx = createContext()
  sessionIdResolver.set(ctx, 'c650059107b876d453cb25a6d2dd0e36')
  assert.match((ctx.res.getHeader('Set-Cookie') as string[])[0], /^connect.sid=c650059107b876d453cb25a6d2dd0e36;/)
})
