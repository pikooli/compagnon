#!/usr/bin/env node
const path = require('path');
const { execSync } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';

    // Token count
    const cw = data.context_window || {};
    const cu = cw.current_usage || {};
    const tok = (cu.input_tokens || 0) + (cu.cache_read_input_tokens || 0) + (cu.cache_creation_input_tokens || 0);
    const tokFmt = tok.toLocaleString('en-US');

    // Context bar
    let ctx = '';
    const remaining = cw.remaining_percentage;
    if (remaining != null) {
      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));

      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      if (used < 63) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 81) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 95) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m\ud83d\udc80 ${bar} ${used}%\x1b[0m`;
      }
    }

    // Git branch + tree status
    const dir = data.workspace?.current_dir || process.cwd();
    let branchPart = '';
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 2000
      }).toString().trim();

      let gitTree = '';
      const status = execSync('git status --porcelain', {
        cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000
      }).toString().trim();

      if (status) {
        const lines = status.split('\n');
        const staged = lines.filter(l => /^[MADRC]/.test(l)).length;
        const modified = lines.filter(l => /^.[MD]/.test(l)).length;
        const untracked = lines.filter(l => l.startsWith('??')).length;
        const parts = [];
        if (staged) parts.push(`\x1b[32m+${staged}\x1b[0m`);
        if (modified) parts.push(`\x1b[33m~${modified}\x1b[0m`);
        if (untracked) parts.push(`\x1b[90m?${untracked}\x1b[0m`);
        gitTree = parts.length ? ` ${parts.join(' ')}` : '';
      } else {
        gitTree = ' \x1b[32m\u2713\x1b[0m';
      }

      branchPart = ` \u2502 \x1b[36m\ue0a0 ${branch}\x1b[0m${gitTree}`;
    } catch (e) {}

    process.stdout.write(`\x1b[2m${model}\x1b[0m \u2502 ${tokFmt} tokens${ctx}${branchPart}`);
  } catch (e) {
    process.stdout.write('\u2026 waiting');
  }
});
