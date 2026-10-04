/**
 * Isolation Forest — unsupervised, machine-specific anomaly detector.
 * Trained only on THIS machine's PRODUCING samples. No generic factory model.
 */

export interface IsoNode {
  kind: "leaf" | "split";
  size: number;
  feature?: number;
  threshold?: number;
  left?: IsoNode;
  right?: IsoNode;
}

export interface FittedForest {
  trees: IsoNode[];
  sampleSize: number;
  nTrees: number;
  mean: number[];
  std: number[];
  cAvg: number;
}

function harmonicC(n: number) {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function subsample(X: number[][], k: number, rng: () => number) {
  const n = X.length;
  if (n <= k) return X.slice();
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  return idx.slice(0, k).map((i) => X[i]!);
}

function build(
  data: number[][],
  depth: number,
  maxDepth: number,
  rng: () => number,
): IsoNode {
  const size = data.length;
  if (size <= 1 || depth >= maxDepth) return { kind: "leaf", size };
  const dim = data[0]!.length;
  const feature = Math.floor(rng() * dim);
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    const v = row[feature]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return { kind: "leaf", size };
  const threshold = min + rng() * (max - min);
  const left: number[][] = [];
  const right: number[][] = [];
  for (const row of data) {
    if (row[feature]! < threshold) left.push(row);
    else right.push(row);
  }
  if (left.length === 0 || right.length === 0) return { kind: "leaf", size };
  return {
    kind: "split",
    size,
    feature,
    threshold,
    left: build(left, depth + 1, maxDepth, rng),
    right: build(right, depth + 1, maxDepth, rng),
  };
}

function pathLength(x: number[], node: IsoNode, d: number): number {
  if (node.kind === "leaf" || !node.left || !node.right) {
    return d + harmonicC(node.size);
  }
  const f = node.feature!;
  if (x[f]! < node.threshold!) return pathLength(x, node.left, d + 1);
  return pathLength(x, node.right, d + 1);
}

export function fitIsolationForest(
  X: number[][],
  rng: () => number,
  nTrees = 80,
  sampleSize = 256,
): FittedForest {
  const dim = X[0]!.length;
  const mean = Array.from({ length: dim }, () => 0);
  for (const row of X) {
    for (let i = 0; i < dim; i++) mean[i]! += row[i]!;
  }
  for (let i = 0; i < dim; i++) mean[i]! /= X.length;
  const std = Array.from({ length: dim }, () => 0);
  for (const row of X) {
    for (let i = 0; i < dim; i++) {
      const d = row[i]! - mean[i]!;
      std[i]! += d * d;
    }
  }
  for (let i = 0; i < dim; i++) {
    std[i] = Math.sqrt(std[i]! / Math.max(1, X.length - 1)) || 1;
  }
  const scaled = X.map((row) => row.map((v, i) => (v - mean[i]!) / std[i]!));
  const psi = Math.min(sampleSize, scaled.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, psi)));
  const trees: IsoNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    trees.push(build(subsample(scaled, psi, rng), 0, maxDepth, rng));
  }
  return {
    trees,
    sampleSize: psi,
    nTrees,
    mean,
    std,
    cAvg: harmonicC(psi),
  };
}

export function anomalyScore(forest: FittedForest, x: number[]): number {
  const z = x.map((v, i) => (v - forest.mean[i]!) / forest.std[i]!);
  let sum = 0;
  for (const tree of forest.trees) sum += pathLength(z, tree, 0);
  const E = sum / forest.trees.length;
  return Math.pow(2, -E / forest.cAvg);
}

/** Typical: ~0.5 normal, ≥0.65 unusual, ≥0.75 strong anomaly. */
export const ML_THRESHOLD = 0.55;
