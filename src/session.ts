import Debug from 'debug'
import type Koa from 'koa'

import { MemoryStore } from './memory-store.js'
import { SessionIdResolver } from './sessionid-resolver.js'
import type { SessionData, SessionOptions } from './types.js'
import { TTL_MS } from './types.js'

const debug = Debug('koa-imsession')
const SESSION = Symbol('SESSION')
const _SESSION = Symbol('_SESSION')

declare module 'koa' {
  interface DefaultContext {
    get session(): SessionData | null
    set session(data: SessionData | boolean)
  }
}

interface Session {
  id: string | null
  data: SessionData | null
}

interface ParsedSessionOptions extends Required<SessionOptions> {
  cookie: { maxAge: number }
}

export function imsession(app: Koa, opts: SessionOptions = {}): Koa.Middleware {
  const options = parseOptions(opts)
  debug('session options %O', options)

  extendContext(app.context, options)

  return async function middleware(ctx, next) {
    const session: Session = ctx[SESSION]
    const sessionId = options.idResolver.get(ctx)
    const sessionData = sessionId ? await options.store.get(sessionId) : null
    session.id = sessionId
    session.data = sessionData

    // Renew session automatically if `TTL_MS` magic symbol property is defined.
    const ttlMs = sessionData?.[TTL_MS]
    if (ttlMs && ttlMs > 0 && ttlMs < options.cookie.maxAge / 3)
      session.id = options.idResolver.generate(ctx)

    try {
      await next()
    } finally {
      const hasNewId = session.id !== sessionId
      if (session.data !== sessionData || hasNewId) {
        if (hasNewId && sessionId)
          await options.store.destroy(sessionId)
        await commit(ctx, options)
      }
    }
  }
}

function parseOptions(opts: SessionOptions): ParsedSessionOptions {
  const {
    name = 'connsid',
    store = new MemoryStore(),
  } = opts

  if (store instanceof MemoryStore && process.env.NODE_ENV !== 'test')
    console.warn('[koa-imsession] You are using the memory store for sessions. Must not use it on production environment.')

  const cookie = { ...opts.cookie } as typeof opts.cookie & { maxAge: number }
  if (!cookie.maxAge)
    cookie.maxAge = cookie.expires
      ? cookie.expires.getTime() - Date.now()
      : 86400_000 // default value is 1 day

  const idResolver = opts.idResolver ?? new SessionIdResolver({ name, cookie })

  return {
    name,
    idResolver,
    store,
    cookie,
  }
}

/**
 * Extends context instance, adds `session` property.
 */
function extendContext(ctx: Koa['context'], options: ParsedSessionOptions): void {
  function getSession(this: Koa.Context): Session {
    if (this[_SESSION]) return this[_SESSION]

    return this[_SESSION] = Object.create(null, {
      id: {
        configurable: false,
        enumerable: true,
        value: null,
        writable: true,
      },
      data: {
        configurable: false,
        enumerable: true,
        value: null,
        writable: true,
      },
    } satisfies Record<keyof Session, PropertyDescriptor>)
  }

  function getSessionData(this: Koa.Context): SessionData | null {
    return this[SESSION].data
  }

  function setSessionData(this: Koa.Context, data: SessionData | boolean): void {
    const session: Session = this[SESSION]
    if (data === true) {
      if (session.id) // generate a new one only when the ID exists
        session.id = options.idResolver.generate(this)
    } else {
      session.data = data || null
    }
  }

  Object.defineProperty(ctx, SESSION, {
    get: getSession,
  })

  Object.defineProperty(ctx, 'session', {
    get: getSessionData,
    set: setSessionData,
  })
}

/**
 * Commits the session changes or removal.
 */
async function commit(ctx: Koa.Context, options: ParsedSessionOptions) {
  const session: Session = ctx[SESSION]

  if (!session.data) {
    if (session.id) await options.store.destroy(session.id)
    options.idResolver.set(ctx, null)
    debug('[commit] remove session: %s', session.id)
    return
  }

  debug('[commit] set session: %s:%O', session.id, session.data)

  const sessionId = session.id || options.idResolver.generate(ctx)
  const sessionData = session.data
  const ttlMs = options.cookie.maxAge + 10_000 // store entry TTL is reset and 10s longer than cookie

  await options.store.set(sessionId, sessionData, ttlMs)
  options.idResolver.set(ctx, sessionId)
}
