// Copies the MediaPipe Tasks Vision wasm runtime from node_modules into public/,
// under a versioned path, so the face-detection check loads from this app's own
// origin (no third-party CDN at runtime) and can be cached as immutable.
// Runs before `next dev` and `next build` (predev / prebuild). The BlazeFace
// model is committed in public/models/ (Apache-2.0, see docs/ARCHITECTURE.md).
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkgDir = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
// Keep in step with MEDIAPIPE_VERSION in src/services/camera/face-detector.ts.
const EXPECTED = '0.10.35';

const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
if (version !== EXPECTED) {
  console.error(`@mediapipe/tasks-vision is ${version}; expected ${EXPECTED}. 1.0.x sends usage metrics to Google (docs/DECISIONS.md D-049). Pin the version or update both constants.`);
  process.exit(1);
}

const out = path.join(root, 'public', 'vendor', 'mediapipe', version);
mkdirSync(out, { recursive: true });
// SIMD build for almost every device, and the non-SIMD fallback the loader picks on the rest.
const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
let copied = 0;
for (const name of files) {
  const from = path.join(pkgDir, 'wasm', name);
  const to = path.join(out, name);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  copied++;
}

const model = path.join(root, 'public', 'models', 'blaze_face_short_range_f16_v1.tflite');
if (!existsSync(model)) {
  console.error('Missing public/models/blaze_face_short_range_f16_v1.tflite (see docs/ARCHITECTURE.md → Face capture).');
  process.exit(1);
}
console.log(`MediaPipe ${version}: ${copied ? `copied ${copied} file(s)` : 'up to date'} in public/vendor/mediapipe/${version}`);
