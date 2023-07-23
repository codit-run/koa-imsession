import { test, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { MemoryStore } from './memory-store.js'

async function createEntry(store: MemoryStore<object>, ttlMs: number) {
  const id = randomBytes(16).toString('hex')
  const data = { id: 1 }
  await store.set(id, data, ttlMs)
  return { id, data }
}

test('sets object', async () => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')
  const sessionData = { id: 1 }

  expect(await store.set(sessionId, { ...sessionData }, 10)).toBeUndefined()
  expect(await store.get(sessionId)).toStrictEqual(sessionData)
})

const primitiveData = [null, undefined, 100, true]
test.each(primitiveData)('sets primitive', async (primitive) => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')

  // const sessionDataArr = [null, undefined, 100, true]
  // for (const sessionData of sessionDataArr) {
  await expect(store.set(sessionId, primitive as any, 10)).rejects.toThrow('session data must be an object')
  // }
})

test('gets nonexistent', async () => {
  const store = new MemoryStore()
  expect(await store.get('nonexistent')).toBeNull()
})

test('gets existing', async () => {
  const store = new MemoryStore()
  const session = await createEntry(store, 10)

  expect(await store.get(session.id)).toStrictEqual(session.data)
})

test('gets expired', async () => {
  const store = new MemoryStore()
  const session = await createEntry(store, 4)

  expect(await store.get(session.id)).toStrictEqual(session.data)
  await sleep(10)
  expect(await store.get(session.id)).toBeNull()
})

test('destroys nonexistent', async () => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')

  expect(await store.destroy(sessionId)).toBeUndefined()
  expect(await store.get(sessionId)).toBeNull()
})

test('destroys existing', async () => {
  const store = new MemoryStore()
  const session = await createEntry(store, 10)

  expect(await store.destroy(session.id)).toBeUndefined()
  expect(await store.get(session.id)).toBeNull()
})
