import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MeshData } from '../core/shapes';

export interface SceneItem {
  mesh: MeshData;
  color: number;
  opacity?: number;
  /** Half turn about the vertical axis, then translation. */
  turn?: boolean;
  position?: [number, number, number];
}

export class View3D {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  private controls: OrbitControls;
  private group = new THREE.Group();
  private framedKey = '';

  constructor(private host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.render());
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-1, 2, 3);
    this.scene.add(sun, this.group);
    new ResizeObserver(() => this.resize()).observe(host);
  }

  /** `key` identifies the view; the camera is re-framed only when it changes. */
  show(key: string, items: SceneItem[]) {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh | THREE.LineSegments;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
    }
    for (const it of items) {
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.BufferAttribute(it.mesh.positions, 3));
      indexed.setIndex(new THREE.BufferAttribute(it.mesh.indices, 1));
      // Un-indexed so every triangle gets its own normal (flat shading).
      const geo = indexed.toNonIndexed();
      indexed.dispose();
      geo.computeVertexNormals();
      const transparent = (it.opacity ?? 1) < 1;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.8, transparent, opacity: it.opacity ?? 1 }),
      );
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0x3a2f22 })));
      if (it.turn) mesh.rotation.y = Math.PI;
      if (it.position) mesh.position.set(...it.position);
      this.group.add(mesh);
    }
    if (key !== this.framedKey) {
      this.framedKey = key;
      this.frame();
    }
    this.resize();
  }

  private frame() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    this.camera.position.copy(center).add(new THREE.Vector3(0.55, 0.45, 0.7).normalize().multiplyScalar(dist));
    this.controls.target.copy(center);
    this.controls.update();
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
