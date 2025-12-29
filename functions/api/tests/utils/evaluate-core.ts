import { isRecord, readNumber, readString } from "../../utils/guards.js";

export type MbtiAxis = "EI" | "SN" | "TF" | "JP";
export type MbtiLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export type MbtiRules = {
  mode: "mbtiAxes";
  axisOrder: MbtiAxis[];
  axisDefaults: Record<MbtiAxis, MbtiLetter>;
};

export type MbtiAxisSummary = {
  plusLetter: MbtiLetter;
  minusLetter: MbtiLetter;
  plus: number;
  minus: number;
  plusPct: number;
  minusPct: number;
  winner: MbtiLetter;
};

export type MbtiAnalysis = {
  code: string;
  axes: Record<MbtiAxis, MbtiAxisSummary>;
  typeProbs: Record<string, number>;
};

export type ScoreRules = {
  mode: "scoreOutcomes";
  tieBreakOrder?: string[];
};

export type MbtiScoringItem =
  | { axis: MbtiAxis; delta: number }
  | { mbtiAxis: MbtiAxis; delta: number }
  | { mbtiAxis: MbtiAxis; weight: number; direction: MbtiLetter }
  | { axis: MbtiAxis; weight: number; dir: MbtiLetter };

export type ScoreItem = { scores: Record<string, number> };

export function normalizeAnswerIds(body: unknown): string[] {
  if (!isRecord(body)) return [];
  const answersVal = body.answers;
  if (Array.isArray(answersVal)) {
    return answersVal
      .map((v) => readString(v).trim())
      .filter((v) => v.length > 0);
  }
  const selectionsVal = body.selections;
  if (Array.isArray(selectionsVal)) {
    return selectionsVal
      .map((s) => (isRecord(s) ? readString(s.answerId).trim() : ""))
      .filter((v) => v.length > 0);
  }
  return [];
}

export function inferModeFromType(type: unknown): string {
  const t = String(type || "").toLowerCase();
  if (t.includes("mbti")) return "mbtiAxes";
  return "scoreOutcomes";
}

export function safeJsonParse(raw: unknown): unknown {
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
}

const AXIS_LETTERS: Record<MbtiAxis, [MbtiLetter, MbtiLetter]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

export function summarizeMbtiPlusMinus(
  items: MbtiScoringItem[],
  rules: MbtiRules,
): MbtiAnalysis {
  const axisOrder: MbtiAxis[] = Array.isArray(rules?.axisOrder) ? rules.axisOrder : ["EI", "SN", "TF", "JP"];
  const axisDefaults = rules?.axisDefaults || {
    EI: "I",
    SN: "S",
    TF: "T",
    JP: "J",
  };

  const totals: Record<MbtiAxis, { plus: number; minus: number }> = {
    EI: { plus: 0, minus: 0 },
    SN: { plus: 0, minus: 0 },
    TF: { plus: 0, minus: 0 },
    JP: { plus: 0, minus: 0 },
  };
  axisOrder.forEach((ax) => {
    totals[ax] = { plus: 0, minus: 0 };
  });

  (Array.isArray(items) ? items : []).forEach((p) => {
    const axisRaw = readString((p as { axis?: unknown }).axis) || readString((p as { mbtiAxis?: unknown }).mbtiAxis);
    const axis = axisRaw.trim().toUpperCase() as MbtiAxis;
    if (!axis || !(axis in totals)) return;

    // Prefer signed delta if present; otherwise infer from direction/dir letters.
    const delta = readNumber((p as { delta?: unknown }).delta, Number.NaN);
    if (Number.isFinite(delta)) {
      const d = delta;
      if (d >= 0) totals[axis] = { ...totals[axis], plus: totals[axis].plus + d };
      else totals[axis] = { ...totals[axis], minus: totals[axis].minus + Math.abs(d) };
      return;
    }

    const weight = Math.max(1, Math.floor(readNumber((p as { weight?: unknown }).weight, 1)));
    const dir = readString((p as { dir?: unknown }).dir || (p as { direction?: unknown }).direction)
      .trim()
      .toUpperCase() as MbtiLetter;
    if (!dir) return;
    const [pos, neg] = AXIS_LETTERS[axis] || ["", ""];
    if (!pos || !neg) return;
    if (dir === pos) totals[axis].plus += weight;
    else if (dir === neg) totals[axis].minus += weight;
  });

  const axes = {} as Record<MbtiAxis, MbtiAxisSummary>;

  axisOrder.forEach((ax) => {
    const [pos, neg] = AXIS_LETTERS[ax] || ["", ""];
    const plus = totals[ax]?.plus || 0;
    const minus = totals[ax]?.minus || 0;
    const denom = plus + minus;
    const plusPct = denom > 0 ? plus / denom : 0.5;
    const minusPct = 1 - plusPct;
    const pref = String(axisDefaults?.[ax] || "").trim().toUpperCase() as MbtiLetter;
    const winner: MbtiLetter =
      plus > minus
        ? pos
        : minus > plus
          ? neg
          : pref && [pos, neg].includes(pref)
            ? pref
            : neg;
    axes[ax] = { plusLetter: pos, minusLetter: neg, plus, minus, plusPct, minusPct, winner };
  });

  const code = axisOrder.map((ax) => axes[ax]?.winner || "").join("").toUpperCase();

  // 16-type distribution (assumes axis independence; good UX approximation)
  const typeProbs: Record<string, number> = {};
  const lettersByAxis: Array<[string, string]> = axisOrder.map((ax) => AXIS_LETTERS[ax] || ["", ""]);
  const ax0 = axisOrder[0];
  const ax1 = axisOrder[1];
  const ax2 = axisOrder[2];
  const ax3 = axisOrder[3];
  if (ax0 && ax1 && ax2 && ax3 && lettersByAxis.every(([a, b]) => a && b)) {
    const [a0, b0] = lettersByAxis[0]!;
    const [a1, b1] = lettersByAxis[1]!;
    const [a2, b2] = lettersByAxis[2]!;
    const [a3, b3] = lettersByAxis[3]!;
    const p0 = (l: string) => (l === a0 ? axes[ax0].plusPct : axes[ax0].minusPct);
    const p1 = (l: string) => (l === a1 ? axes[ax1].plusPct : axes[ax1].minusPct);
    const p2 = (l: string) => (l === a2 ? axes[ax2].plusPct : axes[ax2].minusPct);
    const p3 = (l: string) => (l === a3 ? axes[ax3].plusPct : axes[ax3].minusPct);
    const l0 = [a0, b0];
    const l1 = [a1, b1];
    const l2 = [a2, b2];
    const l3 = [a3, b3];
    for (const x0 of l0) for (const x1 of l1) for (const x2 of l2) for (const x3 of l3) {
      const t = `${x0}${x1}${x2}${x3}`;
      typeProbs[t] = p0(x0) * p1(x1) * p2(x2) * p3(x3);
    }
  }

  return { code, axes, typeProbs };
}

export function evaluateScoreOutcomes(payloads: ScoreItem[], rules: ScoreRules): string {
  const totals: Record<string, number> = {};
  (Array.isArray(payloads) ? payloads : []).forEach((p) => {
    const scores = p?.scores || null;
    if (!scores || typeof scores !== "object") return;
    Object.keys(scores).forEach((k) => {
      const v = Number(scores[k]);
      if (!Number.isFinite(v)) return;
      totals[k] = (totals[k] || 0) + v;
    });
  });

  const keys = Object.keys(totals);
  if (!keys.length) throw new Error("No scores found in answer payloads.");

  const tieOrder: string[] = Array.isArray(rules?.tieBreakOrder) ? rules.tieBreakOrder : [];
  let best = keys[0]!;
  let bestScore = totals[best] || 0;
  for (let i = 1; i < keys.length; i += 1) {
    const k = keys[i]!;
    const sc = totals[k] || 0;
    if (sc > bestScore) {
      best = k;
      bestScore = sc;
    } else if (sc === bestScore) {
      const a = tieOrder.indexOf(best);
      const b = tieOrder.indexOf(k);
      if (b !== -1 && (a === -1 || b < a)) best = k;
    }
  }
  return String(best).trim();
}


