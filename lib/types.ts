import type Cookies from 'cookies'
import type { SessionIdResolver } from './sessionid-resolver.js'

export interface SessionOptions {
  /**
   * The name of the session which is used as cookie name.
   *
   * The default value is `connect.sid`.
   */
  name?: string

  /**
   * Session ID resolver, can get/set/gen session ID.
   *
   * The default value is a `SessionIdResolver` instance.
   */
  idResolver?: SessionIdResolver

  /**
   * Session store. A `MemoryStore` is used by default for development purpose.
   * You should provide a stote (Redis, MongoDB) instead on production.
   *
   * The default value is a `MemoryStore` instance.
   */
  store?: SessionStore<SessionData>

  /**
   * Settings object for the session ID cookie.
   *
   * @see https://github.com/pillarjs/cookies
   */
  cookie?: Cookies.SetOption
}

export const TTL_MS = Symbol('TTL_MS')

export interface SessionData {
  [key: string]: any
  [TTL_MS]?: number
}

export interface SessionStore<T extends SessionData = SessionData> {
  get(sessionId: string): Promise<T | null>
  set(sessionId: string, sessionData: T, ttlMs: number): Promise<void>
  destroy(sessionId: string): Promise<void>
}
