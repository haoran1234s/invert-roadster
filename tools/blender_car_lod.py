import bpy, bmesh, numpy as np, sys, json
from mathutils import Vector
SRC='/home/box/Downloads/0d7ab8620ac47958a96eef11837fa0b2.glb'
L=1.183; S=4.2/L; YC=(0.628-0.555)/2  # blender: +Y=front, Z up
WR=0.098; WZ=0.098; GROUND=-0.94
HUBS={'wheel_FL':(-1,0.369),'wheel_FR':(1,0.369),'wheel_RL':(-1,-0.324),'wheel_RR':(1,-0.324)}
variant=sys.argv[-1]; cfg={'desktop':(50000,3000,2048),'mobile':(17000,900,1024)}[variant]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
body=bpy.data.objects['node_0']; bpy.context.view_layer.objects.active=body; body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.name='body'
info={}
for name,(sx,yc) in HUBS.items():
    bpy.ops.object.mode_set(mode='EDIT'); bm=bmesh.from_edit_mesh(body.data)
    bm.select_mode={'FACE'}
    for v in bm.verts: v.select=False
    for e in bm.edges: e.select=False
    for f in bm.faces:
        c=f.calc_center_median(); f.select = sx*c.x>0.138 and ((c.y-yc)**2+(c.z-WZ)**2)<0.094**2
    bm.select_flush_mode(); n=sum(f.select for f in bm.faces); print('N',name,n); bmesh.update_edit_mesh(body.data)
    bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    w=[o for o in bpy.context.selected_objects if o!=body][0]; w.name=name; w.select_set(False)
    xs=[v.co.x for v in w.data.vertices]; hx=(min(xs)+max(xs))/2
    info[name]=n
    bpy.context.scene.cursor.location=(hx,yc,WZ)
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active=w; w.select_set(True); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); w.select_set(False)
    bpy.context.view_layer.objects.active=body; body.select_set(True)
# decimate
def dec(o,target):
    t=sum(len(p.vertices)-2 for p in o.data.polygons)
    if t>target:
        m=o.modifiers.new('d','DECIMATE'); m.ratio=target/t; m.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
    return len(o.data.polygons)
tris={'body':dec(body,cfg[0])}
for n in HUBS: tris[n]=dec(bpy.data.objects[n],cfg[1])
# root transform: scale, center, ground
root=bpy.data.objects.new('roadster',None); bpy.context.scene.collection.objects.link(root)
for o in [body]+[bpy.data.objects[n] for n in HUBS]: o.parent=root
root.scale=(S,S,S); root.location=(0,-YC*S,GROUND)  # blender z -> gltf y
bpy.context.view_layer.update()
hubs={n:[round(v,3) for v in (bpy.data.objects[n].matrix_world.translation.x, bpy.data.objects[n].matrix_world.translation.z, -bpy.data.objects[n].matrix_world.translation.y)] for n in HUBS}
for img in bpy.data.images:
    if img.size[0]>cfg[2]: img.scale(cfg[2],cfg[2])
out=f'/workspace/roadster_game/app/public/models/roadster_{variant}.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_image_quality=80 if variant=='desktop' else 70,
  export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
  export_apply=True, export_yup=True)
print('RESULT',json.dumps({'variant':variant,'faces_cut':info,'tris':tris,'hubs':hubs,'radius':WR*S}))
