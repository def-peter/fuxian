# ADR 0025: Persist versioned update reminders

## Status

Accepted

## Decision

Packaged Windows and macOS builds check the stable update channel after a short startup delay and
every 24 hours while the application remains open. Timers do not keep the process alive, concurrent
checks remain coalesced by the update service, and failures never interrupt reading or stop later
scheduled checks.

Each newly available version produces one non-modal reminder in the main reader window. The renderer
acknowledges the reminder only after it has been displayed. The main process then stores the version
in the versioned `app-update-state.json` file under Electron's user-data directory. Missing, corrupt,
or unsupported state safely falls back to no acknowledgement. A later version is eligible for a new
reminder.

Dismissing the reminder does not dismiss the update itself. The document-session Settings action
continues to show update availability until the user installs the Windows update or follows the macOS
release-page flow. No background check downloads software.

## Consequences

Long-running and frequently restarted applications both discover stable releases without repeatedly
interrupting the reader for the same version. Update reminder state remains separate from reader
preferences because it is application lifecycle metadata, not a user-selected reading preference.
If persistence fails, the current process still suppresses duplicate reminders and logs the failure;
a later application launch may remind again.
