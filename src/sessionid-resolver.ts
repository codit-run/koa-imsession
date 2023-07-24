import { randomBytes } from 'node:crypto'
import type Koa from 'koa'
import type Cookies from 'cookies'

interface SessionIdResolverOptions {
  name: string
  cookie: Cookies.SetOption & { signed: boolean }
}

export class SessionIdResolver {
  options: SessionIdResolverOptions

  constructor({ name, cookie }: { name: string, cookie?: Cookies.SetOption }) {
    this.options = {
      name,
      cookie: {
        ...cookie,
        signed: cookie?.signed || false,
      },
    }
  }

  /**
   * Resolves the session ID associated with the context.
   *
   * By default the cookie value of `options.name` is read. You can override it
   * to provide more methods.
   */
  get(ctx: Koa.Context): string | null {
    return ctx.cookies.get(this.options.name, this.options.cookie) || null
  }

  /**
   * Sends the given session ID to the client or if the session ID is `null`
   * instructs the client to end the current session.
   *
   * By default the cookie value of `options.name` is written. You can override
   * it to provide other methods.
   */
  set(ctx: Koa.Context, sessionId: string | null): void {
    ctx.cookies.set(this.options.name, sessionId, this.options.cookie)
  }

  /**
   * Generates a new session ID.
   *
   * It is called only when necessary.
   */
  generate(ctx: Koa.Context): string {
    return randomBytes(16).toString('hex')
  }
}
