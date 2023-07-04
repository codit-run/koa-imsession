import assert from 'node:assert'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import test from 'node:test'
import { MemoryStore } from './store.js'

async function fill(store: MemoryStore, maxAge: number) {
  const id = randomBytes(16).toString('hex')
  const sess = { id: 1 }
  await store.set(id, { id: 1 }, maxAge)
  return { id, sess }
}

test('sets object', async (t) => {
  const store = new MemoryStore()
  const id = randomBytes(16).toString('hex')

  assert.strictEqual(await store.set(id, { id: 1 }, 10), undefined)
  assert.deepStrictEqual(await store.get(id), { id: 1 })
})

test('sets primitive', async (t) => {
  const store = new MemoryStore()
  const id = randomBytes(16).toString('hex')

  const values = [null, undefined, 100, true]
  for (const value of values) {
    await assert.rejects(store.set(id, value as any, 10), /session must be an object$/)
  }
})

test('gets nonexistent', async (t) => {
  const store = new MemoryStore()
  assert.strictEqual(await store.get('nonexistent'), null)
})

test('gets existing', async (t) => {
  const store = new MemoryStore()
  const { id, sess } = await fill(store, 10)

  assert.deepStrictEqual(await store.get(id), { ...sess })
})

test('gets expired', async (t) => {
  const store = new MemoryStore()
  const { id, sess } = await fill(store, 1)

  assert.deepStrictEqual(await store.get(id), { ...sess })
  await sleep(10)
  assert.strictEqual(await store.get(id), null)
})

test('destroys nonexistent', async (t) => {
  const store = new MemoryStore()
  const id = randomBytes(16).toString('hex')

  assert.deepStrictEqual(await store.destroy(id), undefined)
  assert.deepStrictEqual(await store.get(id), null)
})

test('destroys existing', async (t) => {
  const store = new MemoryStore()
  const { id } = await fill(store, 10)

  assert.deepStrictEqual(await store.destroy(id), undefined)
  assert.deepStrictEqual(await store.get(id), null)
})
