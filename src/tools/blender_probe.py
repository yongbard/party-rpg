# Blender 로 모델 크기와 뼈 위치를 본다 (조사용)
# 실행: blender -b -P src/tools/blender_probe.py -- {모델.glb} {뼈대 원본.gltf}
import sys
import bpy
from mathutils import Vector

model, skel_src = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


m = load(model)
lo, hi = bbox(m)
print('MODEL', [o.name for o in m], 'min', tuple(round(v, 3) for v in lo), 'max', tuple(round(v, 3) for v in hi))
# 높이 구간마다 x 폭: 팔·날개가 어디에 있는지
mesh = next(o for o in m if o.type == 'MESH')
vs = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
for i in range(10):
    z0 = lo.z + (hi.z - lo.z) * i / 10
    z1 = lo.z + (hi.z - lo.z) * (i + 1) / 10
    band = [v for v in vs if z0 <= v.z < z1]
    if band:
        print(f'  z {z0:.2f}~{z1:.2f}: n {len(band)} x {min(v.x for v in band):.2f}~{max(v.x for v in band):.2f} y {min(v.y for v in band):.2f}~{max(v.y for v in band):.2f}')

s = load(skel_src)
arm = next(o for o in s if o.type == 'ARMATURE')
lo2, hi2 = bbox(s)
print('SKEL mesh min', tuple(round(v, 3) for v in lo2), 'max', tuple(round(v, 3) for v in hi2), 'arm scale', tuple(arm.scale))
for b in ['root', 'pelvis', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'hand_l', 'thigh_l', 'calf_l', 'foot_l']:
    bone = arm.data.bones.get(b)
    if bone:
        print('  ', b, tuple(round(v, 3) for v in arm.matrix_world @ bone.head_local), '->', tuple(round(v, 3) for v in arm.matrix_world @ bone.tail_local))
