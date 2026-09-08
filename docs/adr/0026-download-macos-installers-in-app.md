# Download macOS installers in the application

Supersedes the macOS delivery decision in ADR 0012. Unsigned macOS builds download
the architecture-matching complete DMG inside Fuxian, report progress and speed,
and open the verified installer only on request; users drag the application into
Applications themselves. This preserves the familiar installation experience
without introducing a custom application replacement or differential updater.

Partial DMGs survive cancellation, network failure, and application restart.
The cache identity includes the stable asset URL, expected size, and SHA-512;
retry resumes through validated HTTP Range or restarts when Range is ignored.
Downloads time out after 30 seconds without network progress. A size and SHA-512
check precedes readiness, and another check precedes opening. Starting a different
artifact removes obsolete application-owned download caches. Resuming is explicit
after the next update check, never an automatic background download.

Windows retains electron-updater differential downloads and NSIS installation.
Both platforms expose a GitHub download action throughout supported update states;
it opens the detected release, or latest stable when no version is known, without
cancelling an active download. Four-connection downloads, paid mirrors, and macOS
differential downloads are outside the agreed scope of #55.
