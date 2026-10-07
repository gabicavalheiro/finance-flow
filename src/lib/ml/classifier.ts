// src/lib/ml/classifier.ts — TF-IDF + Regressão Logística multinomial (softmax)
// Implementação própria em TypeScript: roda no navegador, sem servidor.
//
//  texto → atributos (text.ts) → vetor TF-IDF (tf sublinear, idf suavizado, norma L2)
//        → logits = W·x + b → softmax → probabilidades (a "confiança" mostrada na tela)
//
// Treino: gradiente descendente com Adam sobre a perda de entropia cruzada ponderada
// + regularização L2. É convexo, então converge sempre para o mesmo resultado.

import { extractFeatures } from './text';

export interface TrainingExample {
  text: string;
  label: string;
  /** Peso do exemplo (correções do usuário valem mais). Padrão 1. */
  weight?: number;
}

export interface Prediction {
  label: string;
  /** Probabilidade (0–1) da classe prevista. */
  confidence: number;
  /** Todas as classes, da mais para a menos provável. */
  probabilities: { label: string; p: number }[];
  /** false se nenhum atributo do texto foi visto no treino (palpite sem base). */
  known: boolean;
}

export interface FitOptions {
  /** Inverso da regularização (como o C do scikit-learn). Maior = menos regularizado. */
  C?: number;
  maxIter?: number;
  learningRate?: number;
  /** Peso por classe inversamente proporcional à frequência. */
  balanceClasses?: boolean;
  /** Fallback quando o texto não tem nenhum atributo conhecido. */
  fallbackLabel?: string;
}

const DEFAULTS: Required<Omit<FitOptions, 'fallbackLabel'>> = {
  C: 30,
  maxIter: 250,
  learningRate: 0.15,
  balanceClasses: true,
};

interface SparseVec { idx: Int32Array; val: Float64Array }

export class TextClassifier {
  private constructor(
    private readonly vocab: Map<string, number>,
    private readonly idf: Float64Array,
    readonly labels: string[],
    private readonly W: Float64Array, // labels.length × nFeatures (linha = classe)
    private readonly b: Float64Array,
    private readonly fallbackLabel: string,
  ) {}

  get nFeatures(): number { return this.idf.length; }

  // ── vetorização ────────────────────────────────────────────────────────────
  private static vectorize(
    feats: Map<string, number>,
    vocab: Map<string, number>,
    idf: Float64Array,
  ): SparseVec {
    const idx: number[] = [];
    const val: number[] = [];
    let norm = 0;
    feats.forEach((count, key) => {
      const j = vocab.get(key);
      if (j === undefined) return;
      const v = (1 + Math.log(count)) * idf[j];
      idx.push(j); val.push(v); norm += v * v;
    });
    norm = Math.sqrt(norm) || 1;
    return { idx: Int32Array.from(idx), val: Float64Array.from(val, (v) => v / norm) };
  }

  // ── treino ─────────────────────────────────────────────────────────────────
  static fit(examples: TrainingExample[], options: FitOptions = {}): TextClassifier {
    const opt = { ...DEFAULTS, ...options };
    if (examples.length === 0) throw new Error('Sem exemplos para treinar');

    const labels = [...new Set(examples.map((e) => e.label))].sort();
    const labelIdx = new Map(labels.map((l, i) => [l, i]));
    const K = labels.length;

    // vocabulário + document frequency
    const docFeats = examples.map((e) => extractFeatures(e.text));
    const vocab = new Map<string, number>();
    const dfList: number[] = [];
    for (const feats of docFeats) {
      feats.forEach((_, key) => {
        let j = vocab.get(key);
        if (j === undefined) { j = vocab.size; vocab.set(key, j); dfList.push(0); }
        dfList[j]++;
      });
    }
    const F = vocab.size;
    const N = examples.length;
    const idf = Float64Array.from(dfList, (df) => Math.log((1 + N) / (1 + df)) + 1);

    const X = docFeats.map((f) => TextClassifier.vectorize(f, vocab, idf));
    const y = examples.map((e) => labelIdx.get(e.label)!);

    // pesos: do exemplo × balanceamento de classes
    const classCount = new Array(K).fill(0);
    examples.forEach((e, i) => { classCount[y[i]] += e.weight ?? 1; });
    const total = classCount.reduce((a, c) => a + c, 0);
    const sw = examples.map((e, i) => {
      const base = e.weight ?? 1;
      const bal = opt.balanceClasses ? total / (K * classCount[y[i]]) : 1;
      return base * bal;
    });
    const swSum = sw.reduce((a, c) => a + c, 0);
    const lambda = 1 / (opt.C * swSum);

    const W = new Float64Array(K * F);
    const b = new Float64Array(K);
    const gW = new Float64Array(K * F);
    const gb = new Float64Array(K);
    const mW = new Float64Array(K * F), vW = new Float64Array(K * F);
    const mb = new Float64Array(K), vb = new Float64Array(K);
    const logits = new Float64Array(K);
    const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
    let prevLoss = Infinity;

    for (let it = 1; it <= opt.maxIter; it++) {
      gW.fill(0); gb.fill(0);
      let loss = 0;

      for (let i = 0; i < N; i++) {
        const { idx, val } = X[i];
        for (let k = 0; k < K; k++) {
          let s = b[k];
          const off = k * F;
          for (let t = 0; t < idx.length; t++) s += W[off + idx[t]] * val[t];
          logits[k] = s;
        }
        let max = -Infinity;
        for (let k = 0; k < K; k++) if (logits[k] > max) max = logits[k];
        let sum = 0;
        for (let k = 0; k < K; k++) { logits[k] = Math.exp(logits[k] - max); sum += logits[k]; }
        loss -= sw[i] * Math.log(Math.max(logits[y[i]] / sum, 1e-12));
        for (let k = 0; k < K; k++) {
          const err = (logits[k] / sum - (k === y[i] ? 1 : 0)) * sw[i] / swSum;
          gb[k] += err;
          const off = k * F;
          for (let t = 0; t < idx.length; t++) gW[off + idx[t]] += err * val[t];
        }
      }

      let reg = 0;
      for (let j = 0; j < W.length; j++) { gW[j] += lambda * W[j]; reg += W[j] * W[j]; }
      loss = loss / swSum + 0.5 * lambda * reg;

      // Adam
      const c1 = 1 - Math.pow(beta1, it), c2 = 1 - Math.pow(beta2, it);
      for (let j = 0; j < W.length; j++) {
        mW[j] = beta1 * mW[j] + (1 - beta1) * gW[j];
        vW[j] = beta2 * vW[j] + (1 - beta2) * gW[j] * gW[j];
        W[j] -= opt.learningRate * (mW[j] / c1) / (Math.sqrt(vW[j] / c2) + eps);
      }
      for (let k = 0; k < K; k++) {
        mb[k] = beta1 * mb[k] + (1 - beta1) * gb[k];
        vb[k] = beta2 * vb[k] + (1 - beta2) * gb[k] * gb[k];
        b[k] -= opt.learningRate * (mb[k] / c1) / (Math.sqrt(vb[k] / c2) + eps);
      }

      if (Math.abs(prevLoss - loss) < 1e-7) break;
      prevLoss = loss;
    }

    return new TextClassifier(vocab, idf, labels, W, b, options.fallbackLabel ?? labels[0]);
  }

  // ── predição ───────────────────────────────────────────────────────────────
  predict(text: string): Prediction {
    const x = TextClassifier.vectorize(extractFeatures(text), this.vocab, this.idf);
    const K = this.labels.length, F = this.nFeatures;

    if (x.idx.length === 0) {
      return {
        label: this.fallbackLabel, confidence: 0, known: false,
        probabilities: this.labels.map((label) => ({ label, p: 0 })),
      };
    }

    const z = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let s = this.b[k];
      const off = k * F;
      for (let t = 0; t < x.idx.length; t++) s += this.W[off + x.idx[t]] * x.val[t];
      z[k] = s;
    }
    let max = -Infinity;
    for (let k = 0; k < K; k++) if (z[k] > max) max = z[k];
    let sum = 0;
    for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - max); sum += z[k]; }

    const probabilities = this.labels
      .map((label, k) => ({ label, p: z[k] / sum }))
      .sort((a, b) => b.p - a.p);
    return { label: probabilities[0].label, confidence: probabilities[0].p, probabilities, known: true };
  }
}
