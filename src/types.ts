import type Cookies from 'cookies'
import type { SessionIdResolver } from './sessionid-resolver.js'

export interface SessionOptions {
  /**
   * The name of the session which is used as cookie name.
   *
   * The default value is `connsid`.
   */
  name?: string

  /**
   * Session ID resolver, can get/set/generate session ID. You could create a
   * child class to provide custom behavior.
   *
   * The default value is a `SessionIdResolver` instance.
   */
  idResolver?: SessionIdResolver

  /**
   * Session store. A `MemoryStore` is used by default for development purpose.
   * You must provide a stote (Redis, MongoDB) instead on production.
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
  [TTL_MS]?: number
}

export interface SessionStore<T extends SessionData> {
  get(sessionId: string): Promise<T | undefined>
  set(sessionId: string, sessionData: T, ttlMs: number): Promise<void>
  destroy(sessionId: string): Promise<void>
}
