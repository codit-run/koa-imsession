import type { SessionData, SessionStore } from "./types.js"

type Session<T extends SessionData> = {
  data: T
  expires: number
}

/**
 * A session store in memory.
 */
export class MemoryStore<T extends SessionData> implements SessionStore<T> {
  sessions: Record<string, Session<T>> = Object.create(null)

  /**
   * Gets session by the given session ID.
   */
  async get(sessionId: string): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, _) => {
      setImmediate(() => {
        const data = this.#getSessionData(sessionId)
        resolve(data)
      })
    })
  }

  /**
   * Commits the given session associated with the given sessionId to the store.
   */
  async set(sessionId: string, sessionData: T, ttlMs: number): Promise<void> {
    if (!sessionData || typeof sessionData !== 'object')
      throw new Error('session data must be an object')

    return new Promise((resolve, _) => {
      setImmediate(() => {
        this.sessions[sessionId] = {
          data: sessionData,
          expires: Date.now() + ttlMs
        }
        resolve()
      })
    })
  }

  /**
   * Destroys the session associated with the given session ID.
   */
  async destroy(sessionId: string): Promise<void> {
    return new Promise((resolve, _) => {
      setImmediate(() => {
        delete this.sessions[sessionId]
        resolve()
      })
    })
  }

  /**
   * Gets session data from the store.
   */
  #getSessionData(sessionId: string): T | undefined {
    const session = this.sessions[sessionId]
    if (!session) return

    if (session.expires <= Date.now()) {
      // Destroy expired session.
      delete this.sessions[sessionId]
      return
    }

    return session.data
  }

  /**
   * Clears all the sessions. Internal use.
   * @private
   */
  _clear() {
    this.sessions = Object.create(null)
  }
}
