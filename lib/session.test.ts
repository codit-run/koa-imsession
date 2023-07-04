import test from 'node:test'
import assert from 'node:assert'
import Koa from 'koa'
import setCookie from 'set-cookie-parser'
import request from 'supertest'
import { session } from './session.js'
import { MemoryStore } from './store.js'

const store = new MemoryStore()

const app = new Koa()
app.use(session({ store }))
app.use(async function (ctx) {
  const pathname = new URL('http://localhost' + ctx.url).pathname
  switch (pathname) {
    case '/get-session': {
      ctx.body = ctx.session || 'no session'
      break;
    }
    case '/set-session': {
      ctx.session = { message: 'hello' + (ctx.query.hello ?? '') }
      ctx.body = ctx.session
      break;
    }
    case '/unset-session': {
      const action = ctx.query.action || 'null'
      switch (action) {
        case 'false':
          ctx.session = false
          break;
        case 'null':
          ctx.session = null
          break;
        case 'undefined':
          ctx.session = undefined
          break;
      }
      ctx.body = ctx.session || 'no session'
      break;
    }
    case '/regenerate-sessionid': {
      ctx.session = true
      ctx.body = ctx.session || 'no session'
      break;
    }
  }
})

async function sessionAgent() {
  const agent = request.agent(app.callback())
  const res = await agent
    .post('/set-session')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=\w{32};/)
    .expect({ message: 'hello' })

  return { agent, res }
}

function getCookie(res: request.Response) {
  const cookies = setCookie.parse(res.get('Set-Cookie'))
  return cookies.find(cookie => cookie.name === 'koasessid')
}

test.beforeEach(() => {
  store._clear()
})

test('gets no session', (t, done) => {
  request(app.callback())
    .post('/get-session')
    .expect(200)
    .expect('no session', (err, res) => {
      if (err) return done(err)
      assert.strictEqual(res.get('Set-Cookie'), undefined, 'no Set-Cookie header')
      done()
    })
})

test('gets no new session', async (t) => {
  const { agent } = await sessionAgent()
  const res = await agent
    .get('/get-session')
    .expect(200)
    .expect({ message: 'hello' })
  assert.strictEqual(res.get('Set-Cookie'), undefined)
})

test('sets session', async (t) => {
  const res = await request(app.callback())
    .post('/set-session')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=\w{32};/)
    .expect({ message: 'hello' })

  const cookie = getCookie(res)
  assert.deepStrictEqual(await store.get(cookie!.value), { message: 'hello' }, 'session saved')
})

test('sets new session when data is set', async (t) => {
  const { agent, res } = await sessionAgent()
  const cookie = getCookie(res)

  const res2 = await agent
    .get('/set-session?hello=world')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=\w{32};/)
    .expect({ message: 'helloworld' })
  const cookie2 = getCookie(res2)
  assert.strictEqual(cookie2!.value, cookie!.value, 'session ID not changed')
  assert.deepStrictEqual(await store.get(cookie!.value), { message: 'helloworld' }, 'session updated')

  const res3 = await agent
    .get('/set-session?hello=world')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=\w{32};/)
    .expect({ message: 'helloworld' })
  const cookie3 = getCookie(res3)
  assert.strictEqual(cookie3!.value, cookie2!.value, 'session ID not changed')
  assert.deepStrictEqual(await store.get(cookie!.value), { message: 'helloworld' }, 'session updated with same data')
})

test('unsets session', async (t) => {
  const { agent, res } = await sessionAgent()
  const cookie = getCookie(res)

  const res2 = await agent
    .get('/unset-session?action=null')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=;/)
    .expect('no session')
  const cookie2 = getCookie(res2)
  assert.strictEqual(cookie2!.expires!.toUTCString(), 'Thu, 01 Jan 1970 00:00:00 GMT', 'cookie removal')
  assert.strictEqual(await store.get(cookie!.value), null, 'session destroyed')

  const res3 = await agent
    .get('/unset-session?action=undefined')
    .expect(200)
    .expect('no session')
  assert.strictEqual(res3.get('Set-Cookie'), undefined, 'no cookie removal')

  const res4 = await agent
    .get('/unset-session?action=false')
    .expect(200)
    .expect('no session')
  assert.strictEqual(res4.get('Set-Cookie'), undefined, 'no cookie removal')
})

test('regenerates sessionid', async (t) => {
  const { agent, res } = await sessionAgent()
  const cookie = getCookie(res)

  const res2 = await agent
    .get('/regenerate-sessionid')
    .expect(200)
    .expect('Set-Cookie', /^koasessid=\w{32};/)
    .expect({ message: 'hello' })
  const cookie2 = getCookie(res2)
  assert.notStrictEqual(cookie2!.value, cookie!.value, 'session ID changed')
  assert.strictEqual(await store.get(cookie!.value), null, 'old session destroyed')
  assert.deepStrictEqual(await store.get(cookie2!.value), { message: 'hello' }, 'new session saved')
})

test('regenerates no new sessionid', async (t) => {
  const res = await request(app.callback())
    .get('/regenerate-sessionid')
    .expect(200)
    .expect('no session')
  assert.strictEqual(res.get('Set-Cookie'), undefined, 'no cookie set')
})
