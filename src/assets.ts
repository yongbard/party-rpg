import { AnimationGroup, AbstractMesh, AssetContainer, LoadAssetContainerAsync, Node, Scene, TransformNode } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export interface ModelInstance {
  root: TransformNode;
  anims: Map<string, AnimationGroup>;
  meshes: AbstractMesh[];
  tall?: number;              // 사람보다 큰 몸이면 키 배율 (heroModel.ts BODY_TALL)
  find(name: string): Node | undefined;
  dispose(): void;
}

export class Assets {
  private containers = new Map<string, AssetContainer>();
  constructor(private scene: Scene) {}

  has(key: string) { return this.containers.has(key); }
  container(key: string) {
    const c = this.containers.get(key);
    if (!c) throw new Error(`asset not loaded: ${key}`);
    return c;
  }

  /** 아직 안 받은 키만 받는다. 키 'q/part/X' → assets/q/part/X.glb */
  async ensure(keys: string[]) {
    const need = [...new Set(keys)].filter(k => !this.containers.has(k));
    await Promise.all(need.map(async k => {
      const c = await LoadAssetContainerAsync(`assets/${k}.glb`, this.scene);
      c.animationGroups.forEach(g => g.stop());
      this.containers.set(k, c);
    }));
  }

  spawn(key: string, cloneMaterials = false): ModelInstance {
    const c = this.containers.get(key);
    if (!c) throw new Error(`asset not loaded: ${key}`);
    const e = c.instantiateModelsToScene(n => n, cloneMaterials, { doNotInstantiate: true });
    const holder = new TransformNode(key, this.scene);
    e.rootNodes.forEach(r => (r.parent = holder));
    const anims = new Map<string, AnimationGroup>();
    // Ultimate Monsters 는 'CharacterArmature|Idle' 처럼 뼈대 이름이 앞에 붙는다
    e.animationGroups.forEach(g => anims.set(g.name.replace(/^Clone of /, '').replace(/^.*\|/, ''), g));
    return {
      root: holder,
      anims,
      meshes: holder.getChildMeshes(false),
      find: name => holder.getDescendants(false).find(d => d.name === name),
      dispose: () => { e.dispose(); holder.dispose(); },
    };
  }
}
