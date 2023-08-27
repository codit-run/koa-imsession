import { vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Koa from 'koa'
import request from 'supertest'

import { MemoryStore } from './memory-store.js'
import { imsession } from './session.js'
import { SessionData, TTL_MS } from './types.js'

export const store = new MemoryStore()
export const app = new Koa()

app.use(imsession(app, { store }))
app.use(async ctx => {
  const pathname = new URL('http://localhost' + ctx.url).pathname
  switch (pathname) {
    case '/get-session': {
      ctx.body = ctx.session || 'no session'
      return
    }
    case '/set-session': {
      ctx.session = { message: 'hello' + (ctx.query.hello ?? '') } as SessionData
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
      return
    }
    case '/regenerate-sessionid': {
      ctx.session = true
      ctx.body = ctx.session || 'no session'
      return
    }
  }
})

export function mockStoreTTL(cookieMaxAge: number, storeTTL: number) {
  const app = new Koa()
  const store = new MemoryStore()
  const spy = vi.spyOn(store, 'get').mockResolvedValue({
    message: 'hello',
    [TTL_MS]: storeTTL,
  } as SessionData)
  app.use(imsession(app, { store, cookie: { maxAge: cookieMaxAge } }))
  app.use(async ctx => {
    ctx.body = ctx.session || 'no session'
    return
  })

  return { app, spy }
}

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
 * Returns a request agent with session cookie.
 */
export async function sessionAgent() {
  const agent = request.agent(app.callback())
  const res = await agent
    .post('/set-session')
    .expect(200)
    .expect('Set-Cookie', /^connsid=\w{32};/)
    .expect({ message: 'hello' })

  return { agent, res }
}

interface Cookie {
  connsid: string
  path?: string
  expires?: Date
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: string
}

/**
 * Parses response cookie.
 *
 * ```js
 * const cookieString = 'connsid=8bfee50ccbcb8295dc2f5ae545cbc6be; path=/; expires=Thu, 06 Jul 2023 10:18:44 GMT; httponly'
 * // => {
 * {
 *   connsid: '8bfee50ccbcb8295dc2f5ae545cbc6be',
 *   path: '/',
 *   expires: '2023-07-06T10:18:44.000Z',
 *   httponly: true,
 * }
 * ```
 */
export function parseCookie(res: request.Response): Cookie | undefined {
  const cookieString = res.get('Set-Cookie').find(str => str.includes('connsid='))
  if (!cookieString) return

  const cookie = {} as Cookie
  for (const part of cookieString.split('; ')) {
    const [name, value] = part.split('=')
    // @ts-ignore: custom property assign
    cookie[name] = name === 'expires'
      ? new Date(value)
      : value || true
  }
  return cookie
}
