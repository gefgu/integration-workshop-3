# Browser verification

Use an installed Playwright Core package and Chrome. These checks supplement `bun test app/tests`.

Build the frontend, then run a server with a disposable database:

```sh
npm run assembly:app:build
ASSEMBLY_PORT=8082 ASSEMBLY_DB=/tmp/tedtronics-browser-check.sqlite bun app/server.ts
```

In another terminal, set `PLAYWRIGHT_CORE_PATH` to your installed package and run:

```sh
node app/scripts/check-browser.cjs
node app/scripts/check-number-overlaps.cjs
```

`ASSEMBLY_TEST_URL` overrides the default localhost port8082. The guide check creates a synthetic build and synthetic progress in that disposable database. It never supplies firmware or records real hardware acceptance. Desktop/mobile screenshots are written under `/tmp/`.
