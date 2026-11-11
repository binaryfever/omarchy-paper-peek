# The id carries the org, not a person

The plugin id was `fmchale.paper-peek`. The prefix on a third-party plugin id
is there to stop two authors colliding on one plugin name, not to credit
anyone, and an org handle does that job without putting a personal name into
every install of the plugin. It is now `binaryfever.paper-peek`.

## The prefix is a convention, not a rule

`omarchy-plugin-validate` only requires that an id is non-empty, matches
`^[A-Za-z0-9][A-Za-z0-9._-]*$`, contains no `..`, and does not start with
`omarchy.`, which is reserved for first-party plugins. Nothing requires a dot
or a prefix at all. Of the three third-party plugins installed on this machine,
`07dcolem.appimages` and `jankeesvw.meeting-recorder` use a handle and
`superwhisper-panel` has no prefix. The handle form is the common one, so this
keeps it and only changes whose handle it is.

## Nothing had to migrate

`~/.config/paper-peek/`, `~/.cache/paper-peek/` and
`~/.local/state/paper-peek/` are named for the plugin, not for its id. The
settings file, every cached shot and the remembered artboard were untouched by
the rename. The only directory that had to move is the checkout itself, because
the plugins directory keys on the id.

## Enable state is keyed by the id

Changing the id in the manifest was enough for `omarchy plugin list` to show
the new one immediately, before the directory had even moved, so the loader
reads the manifest rather than the folder name. It listed the plugin as
`disabled`, because the enable record belongs to the old id and the new id had
none. A rename therefore needs `omarchy plugin enable` after it, which is easy
to mistake for the rename having gone wrong.

## The old decision records still say fmchale

Records 001 through 027 name `fmchale.paper-peek` and keep it. They are an
account of what was true when they were written, and editing them would make
them lie about their own history. Only the files that instruct — `AGENTS.md`,
`README.md`, the `.cursor` skill — carry the new id. The rule in `AGENTS.md`
that said the id must never change is rewritten rather than deleted: it now
says the id is settled and names this as the one time it moved.

## Proof

`omarchy plugin validate` exits 0, `omarchy plugin list` shows
`binaryfever.paper-peek` enabled, the bar draws its dot, Super+Shift+H still
toggles the drawer, and the artboard the drawer opens on is the one that was
cached before the rename. Every `src/*.test.ts` prints `ok`.
