# BUG-0053: Antigravity Bridge Test Failures

## Summary

29 pre-existing test failures across 3 test files caused by the Antigravity bridge integration (REQ-0032). All failures are related to `.antigravity/` symlink creation (EEXIST errors) and an export count mismatch from the bridge's added `symlink` function.

## Affected Files

- `lib/installer.test.js` — 4 failures (EEXIST when creating `.antigravity/` symlinks)
- `lib/updater.test.js` — 24 failures (EEXIST when creating `.antigravity/` symlinks)
- `lib/fs-helpers.test.js` — 1 failure (export count mismatch — bridge added `symlink` function)

## Root Cause Hypothesis

The Antigravity bridge added symlink creation logic to the installer and updater flows. The test mocks/fixtures don't properly handle the case where `.antigravity/` symlinks already exist, causing EEXIST errors. The fs-helpers test has a hardcoded export count that wasn't updated when the `symlink` function was added.

## Source

Manual observation of test suite output.
