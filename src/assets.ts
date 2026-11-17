import { AnimationGroup, AbstractMesh, AssetContainer, LoadAssetContainerAsync, Node, Scene, TransformNode } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export interface ModelInstance {
  root: TransformNode;
  anims: Map<string, AnimationGroup>;
  meshes: AbstractMesh[];
  find(name: string): Node | undefined;
  dispose(): void;
}

export interface AssetEntry { key: string; url: string; keepAnims?: Set<string> }

export class Assets {
  private containers = new Map<string, AssetContainer>();
  constructor(private scene: Scene) {}

  async load(list: AssetEntry[], onProgress: (p: number) => void) {
    let done = 0;
    await Promise.all(list.map(async it => {
      const c = await LoadAssetContainerAsync(it.url, this.scene);
      if (it.keepAnims) {
        const keep = it.keepAnims;
        c.animationGroups.filter(g => !keep.has(g.name)).forEach(g => g.dispose());
        c.animationGroups = c.animationGroups.filter(g => keep.has(g.name));
      }
      c.animationGroups.forEach(g => g.stop());
      this.containers.set(it.key, c);
      onProgress(++done / list.length);
    }));
  }

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
    e.animationGroups.forEach(g => anims.set(g.name.replace(/^Clone of /, ''), g));
    return {
      root: holder,
      anims,
      meshes: holder.getChildMeshes(false),
      find: name => holder.getDescendants(false).find(d => d.name === name),
      dispose: () => { e.dispose(); holder.dispose(); },
    };
  }
}
