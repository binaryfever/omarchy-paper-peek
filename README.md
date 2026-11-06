# omarchy-paper-peek

Paper Peek shows a Paper artboard beside your code. Change it in `~/.config/paper-peek/settings.json`. With no file, Paper Peek keeps the defaults in the table. An invalid value falls back to that default, and the shell logs a warning that starts with `paper-peek:`. Saving a new `drawerSide` moves the open drawer without a shell restart.

| Key | Default | What it sets |
| --- | --- | --- |
| `toggleHotkey` | `SUPER + SHIFT + H` | Chord that toggles the peek |
| `browserHotkey` | empty | Chord that opens the project browser. Empty adds no chord |
| `drawerSide` | `right` | `left` or `right` |
| `drawerWidth` | `480` | Drawer width in pixels, from 240 to 1200 |
| `refreshIntervalMs` | `2000` | Milliseconds between Paper checks, from 500 to 60000 |
| `defaultMode` | `drawer` | `drawer`, `float`, or `dock` on the next open |
| `paperAddress` | `127.0.0.1:29979` | Paper host and port. Requests use that host and port on the path `/mcp` |

Leave a key out to keep its default. `PAPER_MCP_URL` overrides `paperAddress` when you run `scripts/paper-fetch` yourself. When this file exists, the drawer uses the address from the file.

```json
{
  "drawerSide": "left",
  "drawerWidth": 560
}
```