# koa-imsession

[![npm][npm-img]][npm-url]
[![build status][build-img]][build-img]
[![npm download][download-img]][download-url]

[npm-img]: https://img.shields.io/npm/v/koa-imsession.svg
[npm-url]: https://www.npmjs.org/package/koa-imsession
[build-img]: https://github.com/codit-run/koa-imsession/actions/workflows/ci.yml/badge.svg
[build-url]: https://github.com/codit-run/koa-imsession/actions/workflows/ci.yml
[download-img]: https://img.shields.io/npm/dm/koa-imsession.svg
[download-url]: https://www.npmjs.org/package/koa-imsession


Pretty simple and performance session middleware for [koa](https://github.com/koajs/koa) using immutability.

## Installation

```shell
$ npm install koa-imsession
```

## API

### Set session (e.g. login)

```ts
ctx.session = { id: 1, state: 'pending' }
```

### Update session

**Session data is immutable.** Set the session to a new object.

```ts
const oldSession = ctx.session
ctx.session = { ...oldSession, state: 'activated' }
```

### Destroy session (e.g. logout)

```ts
ctx.session = false // the `Set-Cookie` header will be sent to remove the cookie
```

### Manually regenerate session ID (e.g. renew session)

```ts
ctx.session = true // a new session ID is generated and the existing session data is preserved
```

For session auto-renewal see [Redis session store and session auto-renewal](#redis-session-store-and-session-auto-renewal).

## Examples

### View counter

```ts
import { imsession } from 'koa-imsession'
import Koa from 'koa'

const app = new Koa()

/**
 * All options are optional, except the `store` MUST be set to a custom store
 * (eg. Redis) on production.
 */
const options = {
  name: 'connsid',     // the name of the session ID cookie, default value is `connsid`
  // idResolver,       // session ID resolver which gets/sets/generates the session ID
  // store,            // session store, default value is a `MemoryStore` instance for development
  cookie: {            // cookie options, see https://github.com/pillarjs/cookies
    maxAge: 86400_000, // default value is 1 day
  },
}

app.use(imsession(options))

app.use(ctx => {
  const views = ctx.session?.views ?? 0
  ctx.session = { views: views + 1 } // immutable object
  ctx.body = 'views: ' + ctx.session.views
})

app.listen(3000)
```

### Redis session store and session auto-renewal

The builtin `MemoryStore` is used by default for development and testing purpose only. A custom session store must be set on production environment.

```ts
import type { SessionStore, SessionData } from 'koa-imsession'
import { TTL_MS } from 'koa-imsession'
import redis from './redis.js' // github.com/redis/ioredis

/**
 * A Redis session store.
 */
export class RedisSessionStore<T extends SessionData> implements SessionStore<T> {
  /**
   * Returns session data and TTL_MS.
   */
  async get(sessionId: string): Promise<T | undefined> {
    const tx = redis.multi()
    tx.get(sessionId) // value
    tx.ttl(sessionId) // ttl in seconds
    const results = await tx.exec()
    if (!results) return

    const [[, value], [, ttl]] = results
    if (!value) return

    const sessionData = JSON.parse(value as string)
    if (ttl as number > 0) {
      // AUTO RENEWAL happens here!!!

      // Set the `TTL_MS` symbol property, koa-imsession will check whether it
      // is less than cookie's `maxAge/3`, if true the session will be renewed
      // automatically.
      sessionData[TTL_MS] = (ttl as number) * 1000
    }

    return sessionData
  }

  async set(sessionId: string, sessionData: T, ttlMs: number): Promise<void> {
    const data = JSON.stringify(sessionData)
    await redis.set(sessionId, data, 'PX', ttlMs)
  }

  async destroy(sessionId: string): Promise<void> {
    await redis.del(sessionId)
  }
}
```

### Custom SessionIdResolver

You may want to get the `Bearer` access token from the `Authorization` header.

```ts
import type Cookies from 'cookies'
import type Koa from 'koa'
import { SessionIdResolver as CookieSessionIdResolver } from 'koa-imsession'

export class SessionIdResolver extends CookieSessionIdResolver {
  constructor({ name, cookie }: { name: string; cookie?: Cookies.SetOption }) {
    super({ name, cookie })
  }

  // Overrides `get` method to get the access token from header first.
  get(ctx: Koa.Context): string | undefined {
    return getAccessTokenFromHeader(ctx) ?? super.get(ctx)
  }
}

/**
 * Gets access token from header.
 */
function getAccessTokenFromHeader(ctx: Koa.Context): string | undefined {
  const authorization = ctx.get('Authorization')
  if (!authorization) return

  // Syntax: Bearer 1*SP b64token
  const [scheme, accessToken] = authorization.split(' ', 2)
  if (scheme.toLowerCase() === 'bearer')
    return accessToken
}
```