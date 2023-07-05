import assert from 'node:assert'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import test from 'node:test'
import { MemoryStore } from './memory-store.js'

async function fill(store: MemoryStore<object>, maxAge: number) {
  const id = randomBytes(16).toString('hex')
  const data = { id: 1 }
  await store.set(id, data, maxAge)
  return { id, data }
}

test('sets object', async (t) => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')
  const sessoinData = { id: 1 }

  assert.strictEqual(await store.set(sessionId, { ...sessoinData }, 10), undefined)
  assert.deepStrictEqual(await store.get(sessionId), sessoinData)
})

test('sets primitive', async (t) => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')

  const sessionDataArr = [null, undefined, 100, true]
  for (const sessionData of sessionDataArr) {
    await assert.rejects(store.set(sessionId, sessionData as any, 10), /session data must be an object$/)
  }
})

test('gets nonexistent', async (t) => {
  const store = new MemoryStore()
  assert.strictEqual(await store.get('nonexistent'), null)
})

test('gets existing', async (t) => {
  const store = new MemoryStore()
  const session = await fill(store, 10)

  assert.deepStrictEqual(await store.get(session.id), session.data)
})

test('gets expired', async (t) => {
  const store = new MemoryStore()
  const session = await fill(store, 4)

  assert.deepStrictEqual(await store.get(session.id), session.data)
  await sleep(10)
  assert.strictEqual(await store.get(session.id), null)
})

test('destroys nonexistent', async (t) => {
  const store = new MemoryStore()
  const sessionId = randomBytes(16).toString('hex')

  assert.strictEqual(await store.destroy(sessionId), undefined)
  assert.strictEqual(await store.get(sessionId), null)
})

test('destroys existing', async (t) => {
  const store = new MemoryStore()
  const session = await fill(store, 10)

  assert.strictEqual(await store.destroy(session.id), undefined)
  assert.strictEqual(await store.get(session.id), null)
})
