import { beforeEach, test, expect, vi } from 'vitest'
import request from 'supertest'
import {
  app,
  createContext,
  parseCookie,
  mockStoreTTL,
  sessionAgent,
  store,
} from './test-utils.js'

beforeEach(() => {
  store._clear()
})

test('gets context.session', () => {
  const ctx = createContext()
  expect(ctx.session).toBeNull()
})

test('sets context.session', () => {
  const ctx = createContext()
  ctx.session = { id: 1 }
  expect(ctx.session).toStrictEqual({ id: 1 })
})

test('gets no session', async () => {
  const res = await request(app.callback())
    .post('/get-session')
    .expect(200)
    .expect('no session')
  expect(res.get('Set-Cookie')).toBeUndefined() // no Set-Cookie header
})

test('gets no new session', async () => {
  const { agent } = await sessionAgent()
  const res = await agent
    .get('/get-session')
    .expect(200)
    .expect({ message: 'hello' })
  expect(res.get('Set-Cookie'), undefined)
})

test('sets session', async () => {
  const res = await request(app.callback())
    .post('/set-session')
    .expect(200)
    .expect('Set-Cookie', /^connsid=\w{32};/)
    .expect({ message: 'hello' })

  const cookie = parseCookie(res)
  expect(await store.get(cookie!.connsid)).toStrictEqual({ message: 'hello' }) // session saved
})

test('sets new session when data is set', async () => {
  const { agent, res } = await sessionAgent()
  const cookie = parseCookie(res)

  const res2 = await agent
    .get('/set-session?hello=world')
    .expect(200)
    .expect('Set-Cookie', /^connsid=\w{32};/)
    .expect({ message: 'helloworld' })
  const cookie2 = parseCookie(res2)
  expect(cookie2!.connsid).toBe(cookie!.connsid) // session ID not changed
  expect(await store.get(cookie!.connsid)).toStrictEqual({ message: 'helloworld' }) // session updated

  const res3 = await agent
    .get('/set-session?hello=world')
    .expect(200)
    .expect('Set-Cookie', /^connsid=\w{32};/)
    .expect({ message: 'helloworld' })
  const cookie3 = parseCookie(res3)
  expect(cookie3!.connsid).toBe(cookie2!.connsid) // session ID not changed
  expect(await store.get(cookie!.connsid)).toStrictEqual({ message: 'helloworld' }) // session updated with same data
})

test('unsets session', async () => {
  const { agent, res } = await sessionAgent()
  const cookie = parseCookie(res)

  const res2 = await agent
    .get('/unset-session?action=null')
    .expect(200)
    .expect('Set-Cookie', /^connsid=;/)
    .expect('no session')
  const cookie2 = parseCookie(res2)
  expect(cookie2!.expires!.toUTCString()).toBe('Thu, 01 Jan 1970 00:00:00 GMT') // cookie removal
  expect(await store.get(cookie!.connsid)).toBeNull() // session destroyed

  const res3 = await agent
    .get('/unset-session?action=undefined')
    .expect(200)
    .expect('no session')
  expect(res3.get('Set-Cookie')).toBeUndefined() // no cookie removal

  const res4 = await agent
    .get('/unset-session?action=false')
    .expect(200)
    .expect('no session')
  expect(res4.get('Set-Cookie')).toBeUndefined() // no cookie removal
})

test('regenerates sessionid', async () => {
  const { agent, res } = await sessionAgent()
  const cookie = parseCookie(res)

  const res2 = await agent
    .get('/regenerate-sessionid')
    .expect(200)
    .expect('Set-Cookie', /^connsid=\w{32};/)
    .expect({ message: 'hello' })
  const cookie2 = parseCookie(res2)
  expect(cookie2!.connsid).not.toBe(cookie!.connsid) // session ID changed
  expect(await store.get(cookie!.connsid)).toBeNull() // old session destroyed
  expect(await store.get(cookie2!.connsid)).toStrictEqual({ message: 'hello' }) // new session saved
})

test('regenerates no new sessionid', async () => {
  const res = await request(app.callback())
    .get('/regenerate-sessionid')
    .expect(200)
    .expect('no session')
  expect(res.get('Set-Cookie')).toBeUndefined() // no cookie set
})

test('renews sessionid', async () => {
  const { app, spy } = mockStoreTTL(2000, 100) // `100` is much less than `2000/3`

  await request(app.callback())
    .get('/')
    .set('Cookie', [`connsid=mysessionid`])
    .expect(200)
    // A new session ID is generated and expires is reset.
    .expect('Set-Cookie', new RegExp(`^connsid=\\w{32}; path=/; expires=${new Date(Date.now() + 2000).toUTCString()};`))
    .expect({ message: 'hello' })

  spy.mockRestore()
})

test('sessionid is not renewed', async () => {
  const { app, spy } = mockStoreTTL(2000, 1800) // `1800` is not less than `2000/3`

  const res = await request(app.callback())
    .get('/')
    .set('Cookie', [`connsid=mysessionid`])
    .expect(200)
    .expect({ message: 'hello' })
  expect(res.get('Set-Cookie')).toBeUndefined() // no cookie set

  spy.mockRestore()
})
