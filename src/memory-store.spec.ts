import { test, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { MemoryStore } from './memory-store.js'
import { SessionData } from './types.js'

interface Data extends SessionData {
  id: string
}

const store = new MemoryStore<Data>()

async function createEntry(ttlMs = 10) {
  const { id, data } = randomSession()
  await store.set(id, data, ttlMs)
  return { id, data }
}

function randomSession() {
  const id = randomBytes(16).toString('base64url')
  const data = { id: randomBytes(16).toString('base64url') }
  return { id, data }
}

test('sets object', async () => {
  const { id, data } = randomSession()

  expect(await store.set(id, { ...data }, 10)).toBeUndefined()
  expect(await store.get(id)).toStrictEqual(data)
})

const primitiveData = [null, undefined, 100, true]
test.each(primitiveData)('sets primitive of "%s"', async (primitive) => {
  const { id } = randomSession()

  await expect(store.set(id, primitive as any, 10)).rejects.toThrow('session data must be an object')
})

test('gets nonexistent', async () => {
  expect(await store.get('nonexistent')).toBeUndefined()
})

test('gets existing', async () => {
  const session = await createEntry()
  expect(await store.get(session.id)).toStrictEqual(session.data)
})

test('gets expired', async () => {
  const session = await createEntry(4)

  expect(await store.get(session.id)).toStrictEqual(session.data)
  await sleep(10)
  expect(await store.get(session.id)).toBeUndefined()
})

test('destroys nonexistent', async () => {
  const id = randomSession()

  expect(await store.destroy('nonexistent')).toBeUndefined()
  expect(await store.get('nonexistent')).toBeUndefined()
})

test('destroys existing', async () => {
  const session = await createEntry()

  expect(await store.destroy(session.id)).toBeUndefined()
  expect(await store.get(session.id)).toBeUndefined()
})
