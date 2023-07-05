import Debug from 'debug'
import type Koa from 'koa'
import { MemoryStore } from './memory-store.js'
import type { SessionOptions, SessionData } from './types.js'
import { SessionIdResolver } from './sessionid-resolver.js'

const debug = Debug('koa-imsession')
const SESSION = Symbol('SESSION')

declare module 'koa' {
  interface DefaultContext {
    get session(): SessionData | null
    set session(data: SessionData | boolean)

    // FIXME: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/65976
    [key: keyof any]: any
  }
}

interface Session {
  id: string | null
  data: SessionData | null
}

interface ParsedSessionOptions extends Required<SessionOptions> {
  cookie: { maxAge: number }
}

export function imsession(opts: SessionOptions = {}): Koa.Middleware {
  const options = parseOptions(opts)
  debug('session options %O', options)

  return async function middleware(ctx, next) {
    Object.defineProperty(ctx, SESSION, { value: Object.create(null) })
    const session: Session = ctx[SESSION]
    const sessionId = options.idResolver.get(ctx)
    const sessionData = sessionId ? await options.store.get(sessionId) : null
    session.id = sessionId
    session.data = sessionData

    extendContextSession(ctx, options)

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
    name = 'connect.sid',
    store = new MemoryStore(),
  } = opts

  if (store instanceof MemoryStore)
    console.warn('You are using the memory store for sessions. Must not use it on production environment.')

  const cookie = { ...opts.cookie } as typeof opts.cookie & { maxAge: number }
  if (!cookie.maxAge)
    cookie.maxAge = cookie.expires
      ? cookie.expires.getTime() - Date.now()
      : 86400_000 // defaults to 1 day

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
function extendContextSession(ctx: Koa.Context, options: ParsedSessionOptions): void {
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
    if (session.id) {
      await options.store.destroy(session.id)
      options.idResolver.set(ctx, null)
    }
    debug('[commit] remove session: %s', session.id)
    return
  }

  debug('[commit] set session: %s:%O', session.id, session.data)

  const sessionId = session.id || options.idResolver.generate(ctx)
  const sessionData = session.data
  const maxAge = options.cookie.maxAge + 10_000 // 10s longer than cookie

  await options.store.set(sessionId, sessionData, maxAge)
  options.idResolver.set(ctx, sessionId)
}
