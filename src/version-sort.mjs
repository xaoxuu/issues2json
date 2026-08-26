import semver from 'semver';

function getVersionLabel(issue) {
  for (const label of issue.labels ?? []) {
    const version = label.name.replace(/^v/, '');
    if (semver.valid(version)) {
      return version;
    }
  }
  return null;
}

export function sortIssuesByVersionDesc(issues) {
  return issues.sort((a, b) => {
    const versionA = getVersionLabel(a);
    const versionB = getVersionLabel(b);

    if (versionA === null && versionB === null) return 0;
    if (versionA === null) return 1;
    if (versionB === null) return -1;
    return semver.rcompare(versionA, versionB);
  });
}
