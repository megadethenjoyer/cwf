# cwf

## The Cool Web Framework

It basically works sort of like php, look at `targets/index.cwf`.
You see a `<cwf>get_message <p>{0} {1}</p</cwf>`.

This means that the `get_message` function (handler) is ran in javascript.
`get_message` returns `['hi', 'hello']`, so `{0} {1}` turns into `hi hello`

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```
