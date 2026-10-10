// claude.ai Artifact(온라인 링크)용 빌드.
//  1) VITE_TARGET=artifact 로 빌드 → WebAssembly 디코더 없이 동작
//  2) public/models의 meshopt 압축 GLB를 풀어 양자화(KHR_mesh_quantization)만 남기고,
//     Artifact가 .glb를 서빙하지 않으므로 { glb: base64 } 형태의 .glb.json으로 저장
//  3) Artifact 규칙에 맞게 <html>/<head> 없는 페이지 조각(artifact.html) 생성
// 결과: dist-artifact/ (artifact.html + assets/ + models/)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const OUT = 'dist-artifact';
const TITLE = 'Atlas Anatomy';

execFileSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_TARGET: 'artifact' },
});

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const file of readdirSync('public/models').filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(join('public/models', file));
  doc.getRoot().listExtensionsUsed().filter((e) => e instanceof EXTMeshoptCompression).forEach((e) => e.dispose());
  rmSync(join(OUT, 'models', file), { force: true });
  const bin = await io.writeBinary(doc);
  const out = join(OUT, 'models', `${file}.json`);
  writeFileSync(out, JSON.stringify({ glb: Buffer.from(bin).toString('base64') }));
  console.log(`model ${file}.json: ${(readFileSync(out).length / 1e6).toFixed(2)} MB (quantized, base64)`);
}

const html = readFileSync(join(OUT, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"/g)].map((m) => m[1]);
if (!js.length) throw new Error('entry script not found in index.html');
const fragment = [
  `<title>${TITLE}</title>`,
  ...css.map((h) => `<link rel="stylesheet" href="${h}">`),
  '<div id="root"></div>',
  ...js.map((s) => `<script type="module" src="${s}"></script>`),
  '',
].join('\n');
writeFileSync(join(OUT, 'artifact.html'), fragment);
rmSync(join(OUT, 'index.html'));
console.log(`\nwrote ${OUT}/artifact.html`);
for (const f of readdirSync(join(OUT, 'assets'))) console.log('asset', f);
