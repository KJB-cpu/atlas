"""BodyParts3D STL → 웹용 GLB 변환.

사용법: python3 tools/build_models.py tools/parts-lower.json
  1) 필요한 STL을 tools/.cache 에 내려받고
  2) 정점 병합 + 폴리곤 감소(fast-simplification)
  3) 파트별 이름이 붙은 노드로 GLB 하나를 tools/.cache/<name>.raw.glb 로 저장
이후 npm run models:compress 로 meshopt 압축 (public/models/<name>.glb).

원본: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP
STL 변환본: https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh

RAW = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/{}.stl'
ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.cache'
OUT = ROOT.parent / 'public' / 'models'

# 파트 종류별 목표 face 수 (원본 face 수에 비례하되 상·하한)
BUDGET = {'muscles': (0.12, 600, 7000), 'bones': (0.10, 300, 6000), 'connective': (0.10, 300, 3000)}


def fetch(fma: str) -> Path:
    path = CACHE / f'{fma}.stl'
    if not path.exists():
        tmp = path.with_suffix('.part')
        urllib.request.urlretrieve(RAW.format(fma), tmp)
        tmp.rename(path)
    return path


def simplify(mesh: trimesh.Trimesh, kind: str) -> trimesh.Trimesh:
    ratio, lo, hi = BUDGET[kind]
    n = len(mesh.faces)
    target = int(min(hi, max(lo, n * ratio)))
    if target >= n:
        return mesh
    v, f = fast_simplification.simplify(
        mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), target_reduction=1 - target / n
    )
    return trimesh.Trimesh(v, f, process=True)


def main(spec_path: str) -> None:
    spec = json.loads(Path(spec_path).read_text())
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    parts = [(kind, name, fmas) for kind in BUDGET for name, fmas in spec.get(kind, {}).items()]
    all_fma = sorted({f for _, _, fmas in parts for f in fmas})
    print(f'fetching {len(all_fma)} STL files…')
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(fetch, all_fma))

    scene = trimesh.Scene()
    before = after = 0
    for kind, name, fmas in parts:
        meshes = [trimesh.load_mesh(fetch(f), process=True) for f in fmas]
        mesh = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        before += len(mesh.faces)
        mesh = simplify(mesh, kind)
        after += len(mesh.faces)
        # mm → m, BodyParts3D(Z-up) → glTF(Y-up)
        mesh.apply_scale(0.001)
        mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        mesh.metadata = {}
        scene.add_geometry(mesh, node_name=f'{kind}__{name}', geom_name=f'{kind}__{name}')

    out = CACHE / f"{spec['name']}.raw.glb"
    scene.export(out)
    print(f'{len(parts)} parts, faces {before:,} → {after:,}, wrote {out} ({out.stat().st_size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main(sys.argv[1])
