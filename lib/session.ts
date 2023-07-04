import { randomBytes } from 'node:crypto'
import type Cookies from 'cookies'
import Debug from 'debug'
import type Koa from 'koa'
import { MemoryStore, type Store } from './store.js'

const debug = Debug('koa-imsession')
const SESSION = Symbol('SESSION')

export interface Options {
  /**
   * The name of the session which is used as cookie name.
   *
   * The default value is `koasessid`.
   */
  name?: string

  /**
   * Session ID resolver, can get/set/gen session ID.
   *
   * The default value is `defaultResolveId`.
   */
  resolveId?: typeof defaultResolveId

  /**
   * Session store. A `MemoryStore` is used by default for development purpose.
   * You should provide a stote (Redis, MongoDB) instead on production.
   *
   * The default value is a `MemoryStore` instance.
   */
  store?: Store

  /**
   * Settings object for the session ID cookie.
   *
   * @see https://github.com/pillarjs/cookies
   */
  cookie?: Cookies.SetOption
}

interface Session {
  id: string | null
  data: SessionData | null
  readonly options: Required<Options> & { cookie: { signed: boolean; maxAge: number } }
}

export interface SessionData {
  [key: string]: any
}

declare module 'koa' {
  interface ExtendableContext {
    [SESSION]: Session
    get session(): SessionData
    set session(data: SessionData | boolean)
  }
}

export const defaultResolveId = {
  get(ctx: Koa.Context): string | null {
    const sess: Session = ctx[SESSION]
    return ctx.cookies.get(sess.options.name, sess.options.cookie) || null
  },

  set(ctx: Koa.Context, id: string | null): void {
    const sess: Session = ctx[SESSION]
    ctx.cookies.set(sess.options.name, id, sess.options.cookie) // null id will remove the cookie
  },

  gen(ctx: Koa.Context): string {
    return randomBytes(16).toString('hex')
  }
}

export function session(opts: Options): Koa.Middleware {
  const options = parseOptions(opts)
  debug('session options %O', options)

  return async function middleware(ctx, next) {
    const sess = extendContext(ctx, options)
    const sessId = options.resolveId.get(ctx)
    const sessData = sessId ? await options.store.get(sessId) : null
    sess.id = sessId
    sess.data = sessData

    try {
      await next()
    } finally {
      const hasNewId = sess.id !== sessId
      if (sess.data !== sessData || hasNewId) {
        if (hasNewId && sessId)
          await sess.options.store.destroy(sessId)
        await commit(ctx)
      }
    }
  }
}

function parseOptions(opts: Options) {
  const {
    name = 'koasessid',
    resolveId = defaultResolveId,
    store = new MemoryStore(),
  } = opts

  if (store instanceof MemoryStore)
    console.warn('You are using the memory store for sessions. Must not use it on production environment.')

  const cookie = { ...opts.cookie }

  if (!cookie.maxAge)
    cookie.maxAge = cookie.expires
      ? cookie.expires.getTime() - Date.now()
      : 86400_000 // defaults to 1 day

  if (cookie.signed == null)
    cookie.signed = false

  return {
    name,
    resolveId,
    store,
    cookie,
  }
}

/**
 * Extends context instance, add session properties.
 */
function extendContext(ctx: Koa.Context, options: Options): Session {
  const sess: Session = Object.create(null, {
    id: { value: null, writable: true },
    data: { value: null, writable: true },
    options: { value: options },
  } satisfies Record<keyof Session, PropertyDescriptor>)

  Object.defineProperties(ctx, {
    [SESSION]: { value: sess },
    session: {
      get: () => sess.data,
      set(data: SessionData | boolean) {
        if (data === true) {
          if (sess.id) // generate a new one only when the id exists
            sess.id = sess.options.resolveId.gen(ctx)
        } else {
          sess.data = data || null
        }
      },
    },
  })

  return sess
}

/**
 * Commits the session changes or removal.
 */
async function commit(ctx: Koa.Context) {
  const sess: Session = ctx[SESSION]

  if (!sess.data) {
    if (sess.id) {
      await sess.options.store.destroy(sess.id)
      sess.options.resolveId.set(ctx, null)
    }
    debug('[commit] remove session: %s', sess.id)
    return
  }

  debug('[commit] set session: %s:%O', sess.id, sess.data)

  const opts = sess.options
  const sessId = sess.id || opts.resolveId.gen(ctx)
  const sessData = sess.data
  const maxAge = opts.cookie.maxAge + 10_000 // 10s longer than cookie

  await opts.store.set(sessId, sessData, maxAge)
  opts.resolveId.set(ctx, sessId)
}
