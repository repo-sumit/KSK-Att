// Builds with NEXT_PUBLIC_DEMO_MODE=false into a separate dist dir and fails if
// any demo code (identified by its sentinel and panel strings) reached the bundle.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = '.next-nodemo';
rmSync(path.join(root, distDir), { recursive: true, force: true });
execSync('npx next build', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: 'false', KSK_DIST_DIR: distDir },
});

const needles = ['__KSK_DEMO__', 'Demo controls', 'Reset everything'];
const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (/\.(js|html)$/.test(name)) {
      const text = readFileSync(file, 'utf8');
      for (const n of needles) if (text.includes(n)) hits.push(`${path.relative(root, file)} contains "${n}"`);
    }
  }
};
walk(path.join(root, distDir, 'static'));
rmSync(path.join(root, distDir), { recursive: true, force: true });
if (hits.length) {
  console.error('Demo code found in a DEMO_MODE=false build:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('OK: no demo code in the production (demo off) bundle.');
