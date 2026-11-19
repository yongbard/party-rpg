# AI 로 만든 통짜 모델(Tripo 등)에 영웅 공용 뼈대(Quaternius 65관절, UE 마네킹 이름)를 심는다
# - 뼈대 원본의 뼈를 모델의 다리·몸통·팔·머리 위치로 옮긴다. 뼈 방향·회전(roll)은 그대로 둬서
#   UAL 동작의 회전 키가 그대로 맞게 한다 (게임에서는 이 몸의 위치 키를 뺀다: heroModel.ts POSE_ONLY)
# - 자동 가중치(Bone Heat)로 피부를 입히고 GLB 로 내보낸다 (애니메이션 없음)
# 실행: blender -b --factory-startup -P src/tools/blender_rig.py -- {모델.glb} {뼈대 원본.gltf} {출력.glb} {키(m)} {랜드마크}
#   랜드마크: 모델 키를 1 로 본 비율 "hip,shoulder,neck,hand,leg,front"
#     hip 골반 높이, shoulder 어깨 높이, neck 목 높이, hand 손끝 x, leg 다리 x, front 몸통 중심 y(앞이 -)
import sys
import bpy
from mathutils import Vector

src, skel_src, out, height, marks = sys.argv[sys.argv.index('--') + 1:][:5]
height = float(height)
hip, shoulder, neck, hand, leg, front = map(float, marks.split(','))
bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


# 1. 모델: 키를 height 로 맞추고 변환을 굳힌다
model = [o for o in load(src) if o.type == 'MESH']
mesh = model[0]
if len(model) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for o in model: o.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()
zs = [(mesh.matrix_world @ v.co).z for v in mesh.data.vertices]
k = height / (max(zs) - min(zs))
mesh.scale *= k
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
H = height

# 2. 뼈대: 원본 사람(키 약 1.8)의 뼈를 랜드마크로 옮긴다
skel = load(skel_src)
arm = next(o for o in skel if o.type == 'ARMATURE')
for o in skel:
    if o.type == 'MESH': bpy.data.objects.remove(o)
# 사람 뼈대의 기준 높이 (블렌더 Z 위)
HUMAN = {'hip': 0.949, 'shoulder': 1.456, 'neck': 1.6, 'top': 1.81, 'hand': 0.766, 'clav': 0.212}


def lerp_z(z):
    pts = [(0, 0), (HUMAN['hip'], hip * H), (HUMAN['shoulder'], shoulder * H), (HUMAN['neck'], neck * H), (HUMAN['top'], H)]
    for (a, a2), (b, b2) in zip(pts, pts[1:]):
        if z <= b: return a2 + (z - a) / (b - a) * (b2 - a2)
    a, a2 = pts[-2]; b, b2 = pts[-1]
    return a2 + (z - a) / (b - a) * (b2 - a2)


ARM_BONE = ('clavicle', 'upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky')


def place(p, name):
    x = p.x
    if any(name.startswith(n) for n in ARM_BONE):
        x = x * (hand * H / HUMAN['hand'])   # 팔은 손끝 x 에 맞춘다
    else:
        x = x * (leg * H / 0.114)
    return Vector((x, p.y * (H / HUMAN['top']) + front * H, lerp_z(p.z)))


bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
old = {b.name: (b.head.copy(), b.tail.copy(), b.roll) for b in eb}
for b in eb: b.use_connect = False
for b in eb:
    h, t, roll = old[b.name]
    nh, nt = place(h, b.name), place(t, b.name)
    d = (t - h).normalized()
    b.head = nh
    b.tail = nh + d * max((nt - nh).length, 0.01)   # 방향은 원본 그대로, 길이만 바꾼다
    b.roll = roll
bpy.ops.object.mode_set(mode='OBJECT')

# 3. 자동 가중치: AI 메시는 구멍·겹침이 많아 Bone Heat 가 바로는 실패한다.
#    물 샐 틈 없는 복셀 복사본에서 가중치를 구한 뒤 원본의 가장 가까운 면에서 옮겨 받는다
#    뼈만 있는 해골처럼 틈이 많으면 그래도 실패하므로, 실패하면 복셀을 키워(틈을 메워) 다시 한다
def make_proxy(div):
    p = mesh.copy()
    p.data = mesh.data.copy()
    bpy.context.collection.objects.link(p)
    rm = p.modifiers.new('remesh', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = H / div
    bpy.ops.object.select_all(action='DESELECT')
    p.select_set(True)
    bpy.context.view_layer.objects.active = p
    bpy.ops.object.modifier_apply(modifier='remesh')
    p.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bad = sum(1 for v in p.data.vertices if not v.groups)
    print('PROXY voxel H/%d verts' % div, len(p.data.vertices), 'unweighted', bad)
    return p, bad / max(1, len(p.data.vertices))


for div in (90, 45, 25):
    proxy, bad = make_proxy(div)
    if bad < 0.05 or div == 25: break   # 마지막 것은 실패해도 쓴다
    bpy.data.objects.remove(proxy)
for g in proxy.vertex_groups: mesh.vertex_groups.new(name=g.name)
dt = mesh.modifiers.new('weights', 'DATA_TRANSFER')
dt.object = proxy
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'
dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.modifier_apply(modifier='weights')
bpy.data.objects.remove(proxy)
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_NAME')   # 이름이 같은 그룹을 그대로 쓴다 (빈 그룹을 새로 만들지 않음)
groups = {g.index: g.name for g in mesh.vertex_groups}
unweighted = sum(1 for v in mesh.data.vertices if not any(g.weight > 0 for g in v.groups))
print('RIG', 'verts', len(mesh.data.vertices), 'unweighted', unweighted, 'groups', len(groups))

# 4. 내보내기
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB', export_animations=False, export_yup=True)
print('OUT', out)
