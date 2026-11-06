import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import {
  BROWSER_COMMAND,
  BROWSER_DESCRIPTION,
  DEFAULT_SETTINGS,
  TOGGLE_COMMAND,
  TOGGLE_DESCRIPTION,
  configuredPaperUrl,
  hotkeyEval,
  loadSettings,
  parseLiveBinds,
  parseSettings,
  planHotkeys,
  type LiveHotkey,
} from "./settings.ts"

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`assert failed: ${message}`)
    process.exit(1)
  }
}

function toggleBind(modmask = 65, key = "H"): LiveHotkey {
  return { modmask, key, description: TOGGLE_DESCRIPTION }
}

async function runTests(): Promise<void> {
  const absentDir = await mkdtemp(join(tmpdir(), "paper-peek-settings-"))
  const previous = process.env.PAPER_PEEK_SETTINGS
  const previousUrl = process.env.PAPER_MCP_URL
  try {
    process.env.PAPER_PEEK_SETTINGS = join(absentDir, "missing.json")
    delete process.env.PAPER_MCP_URL
    const absent = loadSettings()
    assert(absent.source === "absent" && absent.warnings.length === 0, "a missing file uses defaults without a warning")
    assert(absent.settings.drawerSide === "right", "the default drawer side is right")
    assert(absent.settings.drawerWidth === 480, "the default drawer width is 480")
    assert(absent.settings.refreshIntervalMs === 2000, "the default refresh interval is 2000")
    assert(absent.settings.defaultMode === "drawer", "the default mode is drawer")
    assert(absent.settings.toggleHotkey === "SUPER + SHIFT + H", "the default toggle chord is Super+Shift+H")
    assert(absent.settings.browserHotkey === "", "the browser has no default hotkey")
    assert(absent.paperUrl === "http://127.0.0.1:29979/mcp", "the default Paper url uses port 29979")
    assert(configuredPaperUrl() === absent.paperUrl, "paper-fetch uses the default url when no file or env is set")

    const broken = parseSettings("{")
    assert(broken.source === "file" && broken.settings.drawerSide === "right", "invalid json falls back to defaults")
    assert(broken.warnings.length === 1, "invalid json logs one warning")

    const mixed = parseSettings(
      JSON.stringify({
        drawerSide: "left",
        drawerWidth: 640,
        refreshIntervalMs: 5000,
        defaultMode: "dock",
        toggleHotkey: "shift + super + p",
        browserHotkey: "",
        paperAddress: "10.0.0.8:29980",
        extra: true,
        drawerSideTypo: "left",
      }),
    )
    assert(mixed.settings.drawerSide === "left", "a valid side is kept")
    assert(mixed.settings.drawerWidth === 640, "a valid width is kept")
    assert(mixed.settings.refreshIntervalMs === 5000, "a valid interval is kept")
    assert(mixed.settings.defaultMode === "dock", "dock is a mode")
    assert(mixed.settings.toggleHotkey === "SUPER + SHIFT + P", "a chord is normalized")
    assert(mixed.settings.browserHotkey === "", "an empty browser hotkey stays empty")
    assert(mixed.paperUrl === "http://10.0.0.8:29980/mcp", "the address becomes the Paper url")
    assert(
      mixed.warnings.some((warning) => warning.includes("unknown setting")),
      "an unknown key logs a warning",
    )

    const bad = parseSettings(
      JSON.stringify({
        drawerSide: "top",
        drawerWidth: 10,
        refreshIntervalMs: 1,
        defaultMode: "tile",
        toggleHotkey: "H",
        browserHotkey: "not a chord",
        paperAddress: "http://127.0.0.1:29979/mcp",
      }),
    )
    assert(bad.settings.toggleHotkey === DEFAULT_SETTINGS.toggleHotkey, "a bare key falls back to the toggle")
    assert(bad.settings.browserHotkey === "", "a bad browser chord falls back to no hotkey")
    assert(bad.settings.drawerSide === "right", "a bad side falls back to right")
    assert(bad.settings.drawerWidth === 480, "a too-small width falls back to 480")
    assert(bad.settings.refreshIntervalMs === 2000, "a too-small interval falls back to 2000")
    assert(bad.settings.defaultMode === "drawer", "a bad mode falls back to drawer")
    assert(bad.settings.paperAddress === DEFAULT_SETTINGS.paperAddress, "a url is not an address")
    assert(bad.warnings.length === 7, "each invalid value logs its own warning")

    const file = join(absentDir, "settings.json")
    await writeFile(file, JSON.stringify({ paperAddress: "10.1.1.1:9" }))
    process.env.PAPER_PEEK_SETTINGS = file
    assert(configuredPaperUrl() === "http://10.1.1.1:9/mcp", "the settings file sets the Paper url")
    process.env.PAPER_MCP_URL = "http://127.0.0.1:9/mcp"
    assert(configuredPaperUrl() === "http://127.0.0.1:9/mcp", "PAPER_MCP_URL overrides the settings file")
    assert(configuredPaperUrl("http://example.test/mcp") === "http://example.test/mcp", "an explicit url wins")

    const idle = planHotkeys(DEFAULT_SETTINGS, [toggleBind()])
    assert(idle.unbind.length === 0 && idle.bind.length === 0 && idle.warnings.length === 0, "the existing toggle bind is left alone")

    const moved = planHotkeys({ ...DEFAULT_SETTINGS, toggleHotkey: "SUPER + ALT + P" }, [toggleBind()])
    assert(moved.unbind.join(",") === "SUPER + SHIFT + H", "a new toggle removes the old Paper Peek chord")
    assert(moved.bind.length === 1 && moved.bind[0]?.chord === "SUPER + ALT + P", "a new toggle binds the requested chord")
    assert(moved.bind[0]?.command === TOGGLE_COMMAND, "the toggle runs the toggle command")
    assert(hotkeyEval(moved)[0] === 'hl.unbind("SUPER + SHIFT + H")', "unbind uses the chord Hyprland already knows")
    assert(
      hotkeyEval(moved)[1] ===
        `o.bind("SUPER + ALT + P", "${TOGGLE_DESCRIPTION}", "${TOGGLE_COMMAND}")`,
      "bind uses o.bind with the toggle description",
    )

    const taken = planHotkeys(
      { ...DEFAULT_SETTINGS, toggleHotkey: "SUPER + ALT + P" },
      [toggleBind(), { modmask: 72, key: "P", description: "Close window" }],
    )
    assert(taken.bind.length === 0 && taken.unbind.length === 0, "a chord owned by another bind is not stolen")
    assert(taken.warnings.length === 1, "a stolen chord logs a warning")

    const browser = planHotkeys({ ...DEFAULT_SETTINGS, browserHotkey: "SUPER + ALT + B" }, [toggleBind()])
    assert(browser.bind.length === 1 && browser.bind[0]?.command === BROWSER_COMMAND, "the browser hotkey opens the browser")
    assert(browser.bind[0]?.description === BROWSER_DESCRIPTION, "the browser bind has its own description")

    const cleared = planHotkeys(DEFAULT_SETTINGS, [
      toggleBind(),
      { modmask: 72, key: "B", description: BROWSER_DESCRIPTION },
    ])
    assert(cleared.unbind.join(",") === "SUPER + ALT + B", "an empty browser hotkey removes the browser bind")
    assert(cleared.bind.length === 0, "clearing the browser does not rebind the toggle")

    const same = planHotkeys(
      { ...DEFAULT_SETTINGS, browserHotkey: DEFAULT_SETTINGS.toggleHotkey },
      [toggleBind()],
    )
    assert(same.bind.length === 0, "the browser does not reuse the toggle chord")
    assert(same.warnings.length === 1, "a shared chord logs a warning")

    const parsedBinds = parseLiveBinds(
      JSON.stringify([{ modmask: 65, key: "h", description: TOGGLE_DESCRIPTION, mouse: false }]),
    )
    assert(parsedBinds !== null && parsedBinds[0]?.key === "H", "hyprctl binds accept the toggle key")
    assert(parseLiveBinds("{") === null, "a bad binds payload is rejected")

    const script = fileURLToPath(new URL("../scripts/paper-fetch", import.meta.url))
    const cli = spawnSync(script, ["settings"], {
      encoding: "utf8",
      env: { ...process.env, PAPER_PEEK_SETTINGS: join(absentDir, "cli.json"), PAPER_MCP_URL: "" },
    })
    assert(cli.status === 0, "settings exits 0 when the file is missing")
    const payload = JSON.parse(cli.stdout) as { source: string; drawerSide: string; warnings: string[] }
    assert(payload.source === "absent" && payload.drawerSide === "right" && payload.warnings.length === 0, "settings prints the defaults")
    await writeFile(join(absentDir, "cli.json"), "{")
    const warned = spawnSync(script, ["settings"], {
      encoding: "utf8",
      env: { ...process.env, PAPER_PEEK_SETTINGS: join(absentDir, "cli.json") },
    })
    assert(warned.status === 0 && warned.stderr.startsWith("paper-peek:"), "invalid settings log a paper-peek warning")
    const warnedPayload = JSON.parse(warned.stdout) as { drawerSide: string; warnings: string[] }
    assert(warnedPayload.drawerSide === "right" && warnedPayload.warnings.length === 1, "the warning is also in the settings reply")
  } finally {
    if (previous === undefined) delete process.env.PAPER_PEEK_SETTINGS
    else process.env.PAPER_PEEK_SETTINGS = previous
    if (previousUrl === undefined) delete process.env.PAPER_MCP_URL
    else process.env.PAPER_MCP_URL = previousUrl
    await rm(absentDir, { recursive: true, force: true })
  }

  console.log("settings.test.ts: ok")
}

runTests().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
