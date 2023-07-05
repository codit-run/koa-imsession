# koa-imsession

[![NPM version][npm-image]][npm-url]
[![Node.js CI](https://github.com/xuxucode/koa-imsession/actions/workflows/nodejs.yml/badge.svg)](https://github.com/xuxucode/koa-imsession/actions/workflows/nodejs.yml)
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

## Examples

### View counter

```js
import { imsession } from 'koa-imsession'
import Koa from 'koa'
const app = new Koa()

// All options are optional.
const options = {
  name: 'connect.sid', // the name of the session ID cookie
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

### Set session (e.g. login)

```js
ctx.session = { id: 1, status: 'pending_approval' }
```

### Update session

**Session data is immutable.** Set the session to a new object.

```js
const oldSession = ctx.session
ctx.session = { ...oldSession, status: 'activated' }
```

### Destroy session (e.g. logout)

```js
ctx.session = false // by default a `Set-Cookie` header will be sent to remove the cookie
```

### Regenerate session ID (e.g. renew session)

```js
ctx.session = true // a new session ID is generated and existing session data is preserved
```
