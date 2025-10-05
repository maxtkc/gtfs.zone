#!/usr/bin/env tsx
import gitDescribe from 'git-describe';
import { execSync } from 'child_process';

/**
 * Gets the current version from git tags and commits
 * - On a tag: returns the tag version (e.g., "0.0.18")
 * - Between tags: returns tag + commits + hash (e.g., "0.0.18-12-ga1b2c3d")
 * - No tags: returns development version with hash (e.g., "0.0.0-dev.a1b2c3d")
 */
function getVersion(): string {
  try {
    const gitInfo = gitDescribe.gitDescribeSync({
      longSemver: true,
      dirtySemver: false,
    });

    // If we're exactly on a tag, return the clean version
    if (gitInfo.distance === 0) {
      return gitInfo.tag.replace(/^v/, '');
    }

    // Otherwise, return tag + commits + hash
    return `${gitInfo.tag.replace(/^v/, '')}-${gitInfo.distance}-g${gitInfo.hash}`;
  } catch (error) {
    // No git tags found, use development version with commit hash
    try {
      const hash = execSync('git rev-parse --short HEAD').toString().trim();
      return `0.0.0-dev.${hash}`;
    } catch {
      return '0.0.0-development';
    }
  }
}

// If run directly, output the version
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(getVersion());
}

export { getVersion };
