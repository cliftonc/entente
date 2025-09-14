import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function getGitSha(): string | null {
  try {
    // First check environment variables (common in CI/CD)
    if (process.env.COMMIT_SHA) {
      return process.env.COMMIT_SHA;
    }
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA;
    }
    if (process.env.GIT_COMMIT) {
      return process.env.GIT_COMMIT;
    }

    // Find git directory starting from current working directory
    let gitDir = findGitDirectory(process.cwd());
    if (!gitDir) {
      return null;
    }

    // Read .git/HEAD file
    const headPath = join(gitDir, 'HEAD');
    if (!existsSync(headPath)) {
      return null;
    }

    const head = readFileSync(headPath, 'utf8').trim();

    // If HEAD is a reference to a branch, follow it
    if (head.startsWith('ref: ')) {
      const refPath = join(gitDir, head.substring(5));
      if (!existsSync(refPath)) {
        return null;
      }
      return readFileSync(refPath, 'utf8').trim();
    }

    // HEAD contains a direct SHA
    return head;
  } catch (error) {
    return null;
  }
}

// Find the .git directory by walking up the directory tree
function findGitDirectory(startPath: string): string | null {
  let currentPath = startPath;
  const root = '/';

  while (currentPath !== root) {
    const gitPath = join(currentPath, '.git');
    if (existsSync(gitPath)) {
      return gitPath;
    }
    currentPath = join(currentPath, '..');
  }

  return null;
}