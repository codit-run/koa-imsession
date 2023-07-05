import type { IncomingMessage, ServerResponse } from 'node:http'
import Koa from 'koa'
import setCookie from 'set-cookie-parser'
import request from 'supertest'
import { imsession } from './session.js'
import { MemoryStore } from './memory-store.js'

export const store = new MemoryStore()
export const app = new Koa()

const session = imsession({ store })
app.use(session)
app.use(async function (ctx) {
  const pathname = new URL('http://localhost' + ctx.url).pathname
  switch (pathname) {
    case '/get-session': {
      ctx.body = ctx.session || 'no session'
      return
    }
    case '/set-session': {
      ctx.session = { message: 'hello' + (ctx.query.hello ?? '') }
      ctx.body = ctx.session
      return
    }
    case '/unset-session': {
      const action = ctx.query.action || 'null'
      switch (action) {
        case 'false':
          ctx.session = false
          break
        case 'null':
          // @ts-ignore
          ctx.session = null
          break
        case 'undefined':
          // @ts-ignore
          ctx.session = undefined
          break
      }
      ctx.body = ctx.session || 'no session'
      break
    }
    case '/regenerate-sessionid': {
      ctx.session = true
      ctx.body = ctx.session || 'no session'
      return
    }
  }
})

export function createContext(reqOpts?: Partial<IncomingMessage>, resOpts?: Partial<ServerResponse>): Koa.Context {
  const req = {
    url: 'http://example.com',
    headers: {},
    ...reqOpts,
  } as IncomingMessage

  const resHeaders = {} as Record<string, any>
  const res = {
    getHeaders: () => resHeaders,
    getHeaderNames: () => Object.keys(resHeaders),
    getHeader: field => resHeaders[field.toLowerCase()],
    setHeader(field, val) { resHeaders[field.toLowerCase()] = val; return this },
    removeHeader(field) { delete resHeaders[field.toLowerCase()] },
    ...resOpts,
  } as ServerResponse

  const ctx = app.createContext(req, res)
  Object.defineProperty(ctx.request, 'secure', { get() { return false } })

  return ctx
}

/**
 * Runs session middleware on the given context.
 */
export function runSession(ctx: Koa.Context) {
  session(ctx, async () => { /* noop */ })
}

/**
 * Returns an request agent with session cookie.
 */
export async function sessionAgent() {
  const agent = request.agent(app.callback())
  const res = await agent
    .post('/set-session')
    .expect(200)
    .expect('Set-Cookie', /^connect.sid=\w{32};/)
    .expect({ message: 'hello' })

  return { agent, res }
}

export function getCookie(res: request.Response) {
  const cookies = setCookie.parse(res.get('Set-Cookie'))
  return cookies.find(cookie => cookie.name === 'connect.sid')
}