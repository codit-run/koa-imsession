import { randomBytes } from 'node:crypto'
import Debug from 'debug'
import type Koa from 'koa'
import { MemoryStore } from './memory-store.js'
import type { Options, ResolveId, SessionData } from './types.js'

const debug = Debug('koa-imsession')
const SESSION = Symbol('SESSION')

declare module 'koa' {
  interface DefaultContext {
    // FIXME: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/65976
    [SESSION]: Session
  }
}

interface Session {
  id: string | null
  data: SessionData | null
  readonly options: Required<Options> & { cookie: { signed: boolean; maxAge: number } }
}

export function imsession(opts: Options): Koa.Middleware {
  const options = parseOptions(opts)
  debug('session options %O', options)

  return async function middleware(ctx, next) {
    const session = extendContext(ctx, options)
    const sessionId = options.resolveId.get(ctx)
    const sessionData = sessionId ? await options.store.get(sessionId) : null
    session.id = sessionId
    session.data = sessionData

    try {
      await next()
    } finally {
      const hasNewId = session.id !== sessionId
      if (session.data !== sessionData || hasNewId) {
        if (hasNewId && sessionId)
          await session.options.store.destroy(sessionId)
        await commit(ctx)
      }
    }
  }
}

function parseOptions(opts: Options): Session['options'] {
  const {
    name = 'connect.sid',
    resolveId = defaultResolveId,
    store = new MemoryStore(),
  } = opts

  if (store instanceof MemoryStore)
    console.warn('You are using the memory store for sessions. Must not use it on production environment.')

  const cookie = { ...opts.cookie } as typeof opts.cookie & { maxAge: number; signed: boolean }

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
  const session: Session = Object.create(null, {
    id: { value: null, writable: true },
    data: { value: null, writable: true },
    options: { value: options },
  } satisfies Record<keyof Session, PropertyDescriptor>)

  Object.defineProperties(ctx, {
    [SESSION]: { value: session },
    session: {
      get: () => session.data,
      set(data: SessionData | boolean) {
        if (data === true) {
          if (session.id) // generate a new one only when the id exists
            session.id = session.options.resolveId.generate(ctx)
        } else {
          session.data = data || null
        }
      },
    },
  })

  return session
}

/**
 * Commits the session changes or removal.
 */
async function commit(ctx: Koa.Context) {
  const session: Session = ctx[SESSION]

  if (!session.data) {
    if (session.id) {
      await session.options.store.destroy(session.id)
      session.options.resolveId.set(ctx, null)
    }
    debug('[commit] remove session: %s', session.id)
    return
  }

  debug('[commit] set session: %s:%O', session.id, session.data)

  const options = session.options
  const sessionId = session.id || options.resolveId.generate(ctx)
  const sessionData = session.data
  const maxAge = options.cookie.maxAge + 10_000 // 10s longer than cookie

  await options.store.set(sessionId, sessionData, maxAge)
  options.resolveId.set(ctx, sessionId)
}

/**
 * Resolve session ID by cookie.
 */
export const defaultResolveId: ResolveId = {
  get(ctx: Koa.Context): string | null {
    const session: Session = ctx[SESSION]
    return ctx.cookies.get(session.options.name, session.options.cookie) || null
  },

  set(ctx: Koa.Context, sessionId: string | null): void {
    const session: Session = ctx[SESSION]
    ctx.cookies.set(session.options.name, sessionId, session.options.cookie) // null session id will remove the cookie
  },

  generate(ctx: Koa.Context): string {
    return randomBytes(16).toString('hex')
  }
}
