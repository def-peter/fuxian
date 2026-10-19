// Public releases accept stable versions and one deliberately supported prerelease channel.
const releaseSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;

export const parseReleaseVersion = (version) => {
  const match = releaseSemver.exec(version);
  if (
    !match ||
    match.slice(1).some((part) => part !== undefined && !Number.isSafeInteger(Number(part)))
  ) {
    throw new Error(`Version ${version} is not a stable SemVer or numbered Beta version.`);
  }
  return { base: match.slice(1, 4).map(Number), beta: match[4] ? Number(match[4]) : undefined };
};

export const releaseChannel = (version) => (parseReleaseVersion(version).beta ? 'beta' : 'latest');
