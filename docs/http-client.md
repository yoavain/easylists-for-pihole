# HTTP client: why `got`, and when to switch to native `fetch`

*Last verified 2026-08-28, on Node 24.20.0 (bundled undici 7.29.0).*

`src/parser.ts` downloads the upstream lists with [`got`](https://github.com/sindresorhus/got) 11.8.6
instead of Node's built-in `fetch`. This looks like a stale dependency. It is not. This document
records why, so the next person to ask does not have to re-derive it.

## Short version

| Question | Answer |
| --- | --- |
| Why not native `fetch`? | It aborts the process on 3 of the 7 input URLs. See below. |
| Why `got` 11 and not 15? | Historical: got 12+ went pure ESM. That constraint has since lapsed. |
| When do we switch to `fetch`? | When this repo runs on Node >= 26.5.0. Node 26 becomes LTS on 2026-10-28. |

## Why not native `fetch`

Native `fetch` is undici. A paused undici HTTP/1 parser crashes the process when the peer closes the
socket: [nodejs/undici#5360](https://github.com/nodejs/undici/issues/5360) (open).

The trigger is a body of 64 KiB or more that arrives in one socket read and is not consumed in the
same tick, followed by the server sending FIN. That describes our workload exactly. `easylist.to`
answers with `Connection: close` and a 736 KB body, so it fails every time:

```
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  assert(!this.paused)
    at Parser.finish (node:internal/deps/undici/undici:7388:9)
    at TLSSocket.onHttpSocketEnd (node:internal/deps/undici/undici:7827:34)
```

Measured on Node 24.20.0, one URL at a time:

| Source | Result |
| --- | --- |
| `easylist.to/easylist/easylist.txt` | crash |
| `easylist.to/easylist/easyprivacy.txt` | crash |
| `easylist.to/easylistgermany/easylistgermany.txt` | crash |
| `easylist-downloads.adblockplus.org/*` (3 lists) | OK — the connection stays alive |
| `raw.githubusercontent.com/.../EasyListHebrew.txt` | OK — the connection stays alive |

Three properties make this fatal rather than annoying:

1. **It cannot be caught.** It is an `assert`, not a rejected promise. `try`/`catch` around the call
   does nothing, and no retry wrapper can contain it. The process exits with code 1.
2. **No body-reading style avoids it.** `.text()`, `.arrayBuffer()`, `.then((r) => r.text())`, and
   streaming with `for await (... of response.body)` were all tested. All four crash.
3. **It is not Windows-only.** The bug was reported on Linux. CI would crash the same way, and the
   nightly job would stop producing lists.

The fix is in undici 8.6.0. Node 24 ships the 7.x line (7.29.0 as of 24.20.0) and the 7.x backport
was abandoned after test failures ([nodejs/undici#5553](https://github.com/nodejs/undici/pull/5553)).
**The Node 24 line will stay broken.** Only a major Node bump fixes this.

### Do not confuse this with the other one

An earlier, different crash also blocked `fetch` here — a libuv assertion on Windows,
[nodejs/node#56645](https://github.com/nodejs/node/issues/56645). That one **is fixed**, in Node
24.20.0. Commit `bd36656e` cites it as the reason for using `got`, and that reason has expired. The
undici parser bug above is what keeps `got` in place now. Confirming that #56645 is closed proves
nothing on its own — run the repro below instead.

## Why `got` 11.8.6 and not a current `got`

`got` 11.8.6 (December 2022) is the last CommonJS release. Every version from 12.0.0 on sets
`"type": "module"` and is pure ESM, and this project is CommonJS: no `"type"` in `package.json`,
`npm run parse` runs through `ts-node/register/transpile-only`, and jest transforms to CJS.

That was a hard blocker when the pin was made. On the current toolchain it is no longer, and both
halves were re-tested on 2026-08-28:

* `require("got")` against got 15.1.0 **succeeds** on Node 24.20.0, through Node's `require(esm)`
  support.
* `import got from "got"` against got 15.1.0 **type-checks** under TypeScript 6.0.3 with
  `module: nodenext`, which is this repo's setting.

**Not tested:** jest. ts-jest compiles to CJS and jest's own module registry intercepts `require`,
so `npm run test` is the part most likely to break on a `got` major bump. Check it first.

So the pin is safe but no longer forced. Upgrading `got` is a separate question from the `fetch`
question, and neither depends on the other.

## When to switch to `fetch`

The condition is the Node version, not a date:

* undici 8.7.0 landed in **Node 26.5.0** (2026-07-08). Any Node >= 26.5.0 carries the fix.
* Node 26 becomes **LTS on 2026-10-28**. Node 24 enters maintenance on 2026-10-20 and reaches
  end-of-life on 2028-04-30. Source: [nodejs/Release](https://github.com/nodejs/Release) `schedule.json`.

Waiting for the LTS date is the sensible trigger: it is one week after Node 24 goes to maintenance,
and it moves `engines` and the CI pins together in one step.

The switch is then:

1. Bump `engines.node` to `>= 26` and the `node-version` matrix in all three workflows.
2. Run the repro below on the new Node. Do not skip this step.
3. Replace `got.get(inputUrl).text()` in `src/parser.ts` with the helper below.
4. Remove `got` from `package.json` and the lockfile. The repo returns to zero runtime dependencies.
5. Replace `jest.mock("got", ...)` in `test/parser.test.ts` with a `global.fetch` stub that returns
   `{ ok, status, statusText, text() }`.

`fetch` needs two behaviours that `got` supplies by default, so they must be written out:

```ts
// `got` throws on any non-2xx; `fetch` does not. Without this guard an upstream 404 flows into
// filterDomains() as an HTML error page, yields zero domains, and the nightly job commits an
// empty list. test-generated/ does not assert non-emptiness, so nothing else would catch it.
const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES: Set<number> = new Set([408, 413, 429, 500, 502, 503, 504, 521, 522, 524]);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchText = async (inputUrl: string): Promise<string> => {
    for (let attempt = 0; ; attempt++) {
        let error: Error;
        let isRetryable: boolean;
        try {
            const response: Response = await fetch(inputUrl);
            if (response.ok) {
                return await response.text();
            }
            error = new Error(`Failed to fetch ${inputUrl}: ${response.status} ${response.statusText}`);
            isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
        }
        catch (fetchError) {
            error = fetchError as Error;
            isRetryable = true;
        }
        if (!isRetryable || attempt >= RETRY_LIMIT) {
            throw error;
        }
        await delay(RETRY_DELAY_MS * (attempt + 1));
    }
};
```

The retry list matches `got` 11's defaults. `got` also retries GET twice; plain `fetch` never
retries, which matters for a nightly job against third-party servers.

## How to re-check

Unit tests use mocks and cannot see this bug. Test against the real URLs.

```bash
node -e "fetch('https://easylist.to/easylist/easylist.txt').then(r => r.text()).then(t => console.log('OK', t.length))"
```

Read the result:

* `OK 736071` (or a similar size) — the bug is gone. Start the switch above.
* `AssertionError ... assert(!this.paused)` — the bug is still present. Keep `got`.
