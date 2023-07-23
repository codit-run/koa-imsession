# koa-imsession

[![NPM version][npm-image]][npm-url]
[![Node.js CI](https://github.com/codit-run/koa-imsession/actions/workflows/nodejs.yml/badge.svg)](https://github.com/codit-run/koa-imsession/actions/workflows/nodejs.yml)
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/koa-imsession.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-imsession
[download-image]: https://img.shields.io/npm/dm/koa-imsession.svg?style=flat-square
[download-url]: https://npmjs.org/package/koa-imsession

Pretty simple and performance session middleware for Koa using immutability.

## Installation

```js
$ npm install koa-imsession
```

## API

### Set session (e.g. login)

```js
ctx.session = { id: 1, status: 'pending' }
```

### Update session

**Session data is immutable.** Set the session to a new object.

```js
const oldSession = ctx.session
ctx.session = { ...oldSession, status: 'activated' }
```

### Destroy session (e.g. logout)

```js
ctx.session = false // the `Set-Cookie` header will be sent to remove the cookie
```

### Manually regenerate session ID (e.g. renew session)

```js
ctx.session = true // a new session ID is generated and the existing session data is preserved
```

For session auto-renewal see [Redis session store and session auto-renewal](#redis-session-store-and-session-auto-renewal).

## Examples

### View counter

```js
import { imsession } from 'koa-imsession'
import Koa from 'koa'

const app = new Koa()

// All options are optional.
const options = {
  name: 'connsid',     // the name of the session ID cookie
  // idResolver,       // session ID resolver which gets/sets/generates the session ID
  // store,            // set custom session store instead of the default `MemoryStore` instance
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

The builtin `MemoryStore` is used by default for development and testing purpose only. A custom session store must be set for production environment.

```js
import type { SessionStore as ISessionStore, SessionData } from 'koa-imsession'
import { TTL_MS } from 'koa-imsession'
import redis from './redis.js' // ioredis

export class SessionStore<T extends SessionData> implements ISessionStore<T> {
  async get(sessionId: string): Promise<T | null> {
    const tx = redis.multi()
    tx.get(sessionId) // data
    tx.ttl(sessionId) // ttl in seconds
    const results = await tx.exec()
    if (!results) return null

    const [[, data], [, ttl]] = results
    if (!data) return null

    const sessionData = JSON.parse(data as string)
    if (ttl as number > 0) {
      // AUTO RENEWAL happens here!!!

      // Set the `TTL_MS` symbol property, koa-imsession will check whether
      // it is less than cookie's `maxAge/3`, if true the session will be
      // renewed automatically.
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

```js
import type Cookies from 'cookies'
import type Koa from 'koa'
import { SessionIdResolver as CookieSessionIdResolver } from 'koa-imsession'

export class SessionIdResolver extends CookieSessionIdResolver {
  constructor({ name, cookie }: { name: string; cookie?: Cookies.SetOption }) {
    super({ name, cookie })
  }

  // Overrides `get` method to get the access token from header first.
  get(ctx: Koa.Context): string | null {
    return getAccessTokenFromHeader(ctx) ?? super.get(ctx)
  }
}

/**
 * Gets access token from header.
 */
function getAccessTokenFromHeader(ctx: Koa.Context): string | null {
  const authorization = ctx.get('Authorization')
  if (!authorization) return null

  // Syntax: Bearer 1*SP b64token
  const [scheme, accessToken] = authorization.split(' ', 2)
  if (scheme.toLowerCase() === 'bearer')
    return accessToken || null

  return null
}
```