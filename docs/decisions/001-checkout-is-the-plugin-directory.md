# Checkout is the plugin directory

The git working tree is the real directory `~/.config/omarchy/plugins/fmchale.paper-peek`. `/home/fred/Projects/omarchy-paper-peek` is a symlink to that directory so the existing Cursor workspace still opens the same files.

`inotifywait -r` on `~/.config/omarchy/plugins` does not walk a symlink. FMC-666 saved `BarWidget.qml` while the plugins entry was a symlink to the checkout. The bar stayed on the old label, and `journalctl --user -t omarchy-shell` did not print `Local plugin changed, reloading: fmchale.paper-peek`.

The same save, after the checkout was the real directory, printed that line. The bar still showed the previous label. `omarchy-shell shell rescanPlugins` did not change it. `omarchy restart shell` loaded the file from disk. A QML edit becomes visible by restarting the shell.

`omarchy plugin validate` runs `find` and rejects a symlink. Find reports `/home/fred/Projects/omarchy-paper-peek` when that path is the symlink, so validate that command against the real directory.

`omarchy plugin remove fmchale.paper-peek` deletes a plugin directory that contains `.git`, after confirmation. Disable the plugin to take the label off the bar.

A second clone, a bind mount, and a watcher were rejected. One real directory puts the file inodes where the watch can see a save. The shell still needs a restart before the bar paints the new QML.
