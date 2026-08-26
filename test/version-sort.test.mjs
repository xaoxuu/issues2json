import test from 'node:test';
import assert from 'node:assert/strict';

import { sortIssuesByVersionDesc } from '../src/version-sort.mjs';

test('sorts a v2 prerelease ahead of v1 releases', () => {
  const issues = [
    { number: 114, labels: [{ name: 'v1.44.0' }] },
    { number: 1, labels: [{ name: 'v2.0.0-alpha.1' }] },
    { number: 8, labels: [{ name: 'v1.43.1' }] },
  ];

  assert.deepEqual(
    sortIssuesByVersionDesc(issues).map(issue => issue.number),
    [1, 114, 8],
  );
});

test('uses standard SemVer precedence for releases and prereleases', () => {
  const issues = [
    { number: 1, labels: [{ name: 'v2.0.0-alpha.1' }] },
    { number: 2, labels: [{ name: '2.0.0' }] },
    { number: 3, labels: [{ name: 'v2.0.0-beta.1' }] },
    { number: 4, labels: [{ name: 'v2.0.0-rc.1' }] },
    { number: 5, labels: [{ name: 'v2.0.0-alpha.2' }] },
  ];

  assert.deepEqual(
    sortIssuesByVersionDesc(issues).map(issue => issue.number),
    [2, 4, 3, 5, 1],
  );
});

test('supports multi-digit versions and ignores build metadata for precedence', () => {
  const issues = [
    { number: 1, labels: [{ name: 'v2.9.0' }] },
    { number: 2, labels: [{ name: 'v10.0.0+build.2' }] },
    { number: 3, labels: [{ name: '10.0.0+build.1' }] },
  ];

  assert.deepEqual(
    sortIssuesByVersionDesc(issues).map(issue => issue.number),
    [2, 3, 1],
  );
});

test('puts invalid or missing versions last and preserves their order', () => {
  const issues = [
    { number: 1, labels: [{ name: 'not-a-version' }] },
    { number: 2, labels: [{ name: 'v1.2.3' }] },
    { number: 3, labels: [] },
    { number: 4 },
  ];

  assert.deepEqual(
    sortIssuesByVersionDesc(issues).map(issue => issue.number),
    [2, 1, 3, 4],
  );
});

test('uses the first valid version label and preserves equal-version order', () => {
  const issues = [
    { number: 1, labels: [{ name: 'invalid' }, { name: 'v2.0.0' }, { name: 'v3.0.0' }] },
    { number: 2, labels: [{ name: '2.0.0+other-build' }] },
    { number: 3, labels: [{ name: 'v1.9.9' }] },
  ];

  assert.deepEqual(
    sortIssuesByVersionDesc(issues).map(issue => issue.number),
    [1, 2, 3],
  );
});
