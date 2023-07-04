import type Koa from 'koa'
import type Cookies from 'cookies'

declare module 'koa' {
  interface DefaultContext {
    get session(): SessionData
    set session(data: SessionData | boolean)
  }
}

export interface Options {
  /**
   * The name of the session which is used as cookie name.
   *
   * The default value is `connect.sid`.
   */
  name?: string

  /**
   * Session ID resolver, can get/set/gen session ID.
   *
   * The default value is `defaultResolveId`.
   */
  resolveId?: ResolveId

  /**
   * Session store. A `MemoryStore` is used by default for development purpose.
   * You should provide a stote (Redis, MongoDB) instead on production.
   *
   * The default value is a `MemoryStore` instance.
   */
  store?: Store<SessionData>

  /**
   * Settings object for the session ID cookie.
   *
   * @see https://github.com/pillarjs/cookies
   */
  cookie?: Cookies.SetOption
}

export interface SessionData {
  [key: string]: any
}

export interface ResolveId {
  /**
   * Gets session ID.
   */
  get(ctx: Koa.Context): string | null
  /**
   * Sets session ID.
   */
  set(ctx: Koa.Context, id: string | null): void
  /**
   * Generates session ID only on necessary.
   */
  generate(ctx: Koa.Context): string
}

export interface Store<T extends SessionData = SessionData> {
  get(sessionId: string): Promise<T | null>
  set(sessionId: string, sessionData: T, maxAge: number): Promise<void>
  destroy(sessionId: string): Promise<void>
}
