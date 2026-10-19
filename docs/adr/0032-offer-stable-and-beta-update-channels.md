# ADR 0032: Offer Stable and Beta update channels

## Status

Accepted

## Decision

Settings → About & Updates exposes Stable and Beta separately from the installed version. Stable is the default for every build, including manually installed prereleases. Beta requires an explicit selection and includes subsequent stable releases. The selection is stored in its own versioned `app-update-channel.json`, independently of reader preferences, sessions, recovery drafts, and reminder state. These existing persistence formats remain compatible when returning to the preceding stable release.

The main-process update service owns channel policy. Stable excludes prereleases; Beta accepts numbered `beta` prereleases and stable releases. Changing channel cancels and drains an active download and waits for any active check before reconfiguring electron-updater, suppressing their events in the interim. It clears all old candidates, progress, reminders, and install actions. Installation preparation prevents channel changes. No additional background timer is introduced; the existing update scheduler checks the selected channel.

A prerelease subscribing to Stable can discover a lower stable version. That candidate has a distinct rollback label and no background reminder. Downloading requires a version-bound native confirmation, followed by the existing explicit install action. Windows preserves document-state flushing before installation; macOS verifies and opens a full DMG for manual replacement. Downloaded files from an abandoned channel cannot be installed through the service.

The release helper supports `--beta` and numbered versions such as `0.1.27-beta.1`. The default next stable version promotes the current Beta base (for example `0.1.27-beta.2` → `0.1.27`). Beta publishes `beta.yml` and `beta-mac.yml`, never stable metadata, and GitHub marks it prerelease and not latest. Stable publishes the existing `latest` metadata. Both use the same complete-artifact validation and atomic draft publication pipeline. GitHub prereleases are publicly downloadable; this is an opt-in update subscription, not invitation-only access. Isolated Actions test installers remain separate from Beta releases.

## Consequences

Channel changes do not replace the installed executable by themselves. Returning to Stable may require installing a lower version, so future persistence changes must preserve compatibility or introduce an explicit migration strategy before a Beta release. Real Windows installation and real release discovery still require platform acceptance; local adapter simulations do not establish those results.
