export interface Store<T extends object = object> {
  get(sessId: string): Promise<T | null>
  set(sessId: string, sess: T, maxAge: number): Promise<void>
  destroy(sessId: string): Promise<void>
}

type Session<T extends object> = {
  data: T
  expires: number
}

/**
 * A session store in memory.
 */
export class MemoryStore<T extends object = object> implements Store<T> {
  sessions: Record<string, Session<T>> = Object.create(null)

  /**
   * Fetches session by the given session ID.
   */
  async get(sessId: string): Promise<T | null> {
    return new Promise<T | null>((resolve, _) => {
      setImmediate(() => {
        const data = this.#getSessionData(sessId)
        resolve(data)
      })
    })
  }

  /**
   * Commits the given session associated with the given sessionId to the store.
   */
  async set(sessId: string, sess: T, maxAge: number): Promise<void> {
    if (!sess || typeof sess !== 'object') throw new Error('session must be an object')

    return new Promise((resolve, _) => {
      setImmediate(() => {
        this.sessions[sessId] = {
          data: sess,
          expires: Date.now() + maxAge
        }
        resolve()
      })
    })
  }

  /**
   * Destroys the session associated with the given session ID.
   */
  async destroy(sessId: string): Promise<void> {
    return new Promise((resolve, _) => {
      setImmediate(() => {
        delete this.sessions[sessId]
        resolve()
      })
    })
  }

  /**
   * Gets session data from the store.
   */
  #getSessionData(sessId: string): T | null {
    const sess = this.sessions[sessId]
    if (!sess) return null

    if (sess.expires <= Date.now()) {
      // Destroy expired session.
      delete this.sessions[sessId]
      return null
    }

    return sess.data
  }

  _clear() {
    this.sessions = Object.create(null)
  }
}
