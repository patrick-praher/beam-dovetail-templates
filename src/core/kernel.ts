import Module, { type ManifoldToplevel } from 'manifold-3d';

export type Kernel = ManifoldToplevel;

let kernel: Promise<Kernel> | undefined;

/** Loads the Manifold CSG kernel once. Pass the wasm URL when bundling. */
export function initKernel(wasmUrl?: string): Promise<Kernel> {
  kernel ??= (async () => {
    const k = await Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
    k.setup();
    return k;
  })();
  return kernel;
}
