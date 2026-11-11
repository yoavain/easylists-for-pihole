# HTTP client: native `fetch` and the Node version floor

`src/parser.ts` downloads the upstream lists with Node's built-in `fetch` through the `fetchText`
helper. The repo has zero runtime dependencies.

## Why `engines.node` is `>= 26.5.0`

Native `fetch` is undici. Older undici crashes the process when a paused HTTP/1 parser sees the peer
close the socket: [nodejs/undici#5360](https://github.com/nodejs/undici/issues/5360). The fix is in
undici 8.6.0 and ships in Node 26.5.0. The Node 24 line (undici 7.x) stays broken, because the 7.x
backport was abandoned ([nodejs/undici#5553](https://github.com/nodejs/undici/pull/5553)).

The trigger is a body of 64 KiB or more that arrives in one socket read, followed by the server
sending FIN. `easylist.to` answers with `Connection: close`, so `easylist`, `easyprivacy` and
`easylistgermany` hit it.

The failure is an `assert`, not a rejected promise:

```
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  assert(!this.paused)
```

`try`/`catch` and retries cannot contain it, and no body-reading style avoids it. The process exits
with code 1, so the nightly job would stop producing lists. Never lower the Node floor below 26.5.0.

## Behaviour `fetchText` supplies

* **Non-2xx responses throw.** `fetch` does not throw on them. Without the guard, an upstream 404
  would flow into `filterDomains()` as an HTML page and the nightly job would commit an empty list.
  `test-generated/` does not assert non-emptiness, so nothing else would catch it.
* **Retries.** Two retries with a linear delay, on network errors and on the status codes in
  `RETRYABLE_STATUS_CODES`. Plain `fetch` never retries, which matters for a nightly job against
  third-party servers.

## How to check

Unit tests use mocks and cannot see the undici bug. After any change to the Node version or the
fetch code, run `npm run parse` against the real URLs.

```bash
node -e "fetch('https://easylist.to/easylist/easylist.txt').then(r => r.text()).then(t => console.log('OK', t.length))"
```

`OK <size>` means the runtime is good. `AssertionError ... assert(!this.paused)` means the Node
version is below the floor.
