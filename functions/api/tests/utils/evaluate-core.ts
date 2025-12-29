export function normalizeAnswerIds(body: any): string[] {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.answers)) {
    return body.answers
      .map((v: any) => String(v || "").trim())
      .filter((v: string) => v.length > 0);
  }
  if (Array.isArray(body.selections)) {
    return body.selections
      .map((s: any) => (s ? String(s.answerId || "").trim() : ""))
      .filter((v: string) => v.length > 0);
  }
  return [];
}

export function inferModeFromType(type: unknown): string {
  const t = String(type || "").toLowerCase();
  if (t.includes("mbti")) return "mbtiAxes";
  return "scoreOutcomes";
}

export function safeJsonParse(raw: unknown): any {
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
}

export function evaluateMbtiAxes(payloads: any[], rules: any): string {
  const axisOrder: string[] = Array.isArray(rules?.axisOrder)
    ? (rules.axisOrder as string[])
    : ["EI", "SN", "TF", "JP"];
  const axisDefaults: Record<string, string> =
    (rules?.axisDefaults as Record<string, string>) || {
      EI: "I",
      SN: "S",
      TF: "T",
      JP: "J",
    };

  const totals: Record<string, Record<string, number>> = {};
  axisOrder.forEach((ax: string) => {
    totals[ax] = {};
  });

  (Array.isArray(payloads) ? payloads : []).forEach((p) => {
    const axis = String(p?.axis || p?.mbtiAxis || "").trim();
    const dir = String(p?.dir || p?.direction || "").trim();
    if (!axis || !dir) return;
    const weight = Number.isFinite(Number(p?.weight)) ? Number(p.weight) : 1;
    if (!totals[axis]) totals[axis] = {};
    totals[axis][dir] = (totals[axis][dir] || 0) + weight;
  });

  const letters = axisOrder.map((ax: string) => {
    const m = totals[ax] || {};
    const dirs = Object.keys(m);
    if (dirs.length === 0) return String(axisDefaults?.[ax] || "").trim() || "";
    let bestDir = dirs[0]!;
    let bestScore = m[bestDir] || 0;
    for (let i = 1; i < dirs.length; i += 1) {
      const d = dirs[i]!;
      const sc = m[d] || 0;
      if (sc > bestScore) {
        bestScore = sc;
        bestDir = d;
      } else if (sc === bestScore) {
        const pref = String(axisDefaults?.[ax] || "").trim();
        if (pref && d === pref) bestDir = d;
      }
    }
    return bestDir;
  });

  const code = letters.join("").toUpperCase();
  if (!code || code.length < 2) throw new Error("Invalid MBTI result code.");
  return code;
}

const AXIS_LETTERS: Record<string, [string, string]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

export function summarizeMbtiPlusMinus(
  items: Array<{ axis?: string; mbtiAxis?: string; delta?: number; weight?: number; dir?: string; direction?: string }>,
  rules: any,
) {
  const axisOrder: string[] = Array.isArray(rules?.axisOrder)
    ? (rules.axisOrder as string[])
    : ["EI", "SN", "TF", "JP"];
  const axisDefaults: Record<string, string> =
    (rules?.axisDefaults as Record<string, string>) || {
      EI: "I",
      SN: "S",
      TF: "T",
      JP: "J",
    };

  const totals: Record<string, { plus: number; minus: number }> = {};
  axisOrder.forEach((ax) => {
    totals[ax] = { plus: 0, minus: 0 };
  });

  (Array.isArray(items) ? items : []).forEach((p) => {
    const axis = String(p?.axis || p?.mbtiAxis || "").trim().toUpperCase();
    if (!axis) return;

    // Prefer signed delta if present; otherwise infer from direction/dir letters.
    if (Number.isFinite(Number(p?.delta))) {
      const d = Number(p.delta);
      if (d >= 0) totals[axis] = { ...totals[axis], plus: totals[axis].plus + d };
      else totals[axis] = { ...totals[axis], minus: totals[axis].minus + Math.abs(d) };
      return;
    }

    const weight = Number.isFinite(Number(p?.weight)) ? Number(p.weight) : 1;
    const dir = String(p?.dir || p?.direction || "").trim().toUpperCase();
    if (!dir) return;
    const [pos, neg] = AXIS_LETTERS[axis] || ["", ""];
    if (!pos || !neg) return;
    if (dir === pos) totals[axis].plus += weight;
    else if (dir === neg) totals[axis].minus += weight;
  });

  const axes: Record<
    string,
    {
      plusLetter: string;
      minusLetter: string;
      plus: number;
      minus: number;
      plusPct: number; // 0..1
      minusPct: number; // 0..1
      winner: string;
    }
  > = {};

  axisOrder.forEach((ax) => {
    const [pos, neg] = AXIS_LETTERS[ax] || ["", ""];
    const plus = totals[ax]?.plus || 0;
    const minus = totals[ax]?.minus || 0;
    const denom = plus + minus;
    const plusPct = denom > 0 ? plus / denom : 0.5;
    const minusPct = 1 - plusPct;
    const pref = String(axisDefaults?.[ax] || "").trim().toUpperCase();
    const winner =
      plus > minus ? pos : minus > plus ? neg : pref && [pos, neg].includes(pref) ? pref : neg;
    axes[ax] = { plusLetter: pos, minusLetter: neg, plus, minus, plusPct, minusPct, winner };
  });

  const code = axisOrder.map((ax) => axes[ax]?.winner || "").join("").toUpperCase();

  // 16-type distribution (assumes axis independence; good UX approximation)
  const typeProbs: Record<string, number> = {};
  const lettersByAxis: Array<[string, string]> = axisOrder.map((ax) => AXIS_LETTERS[ax] || ["", ""]);
  if (lettersByAxis.every(([a, b]) => a && b)) {
    const [a0, b0] = lettersByAxis[0]!;
    const [a1, b1] = lettersByAxis[1]!;
    const [a2, b2] = lettersByAxis[2]!;
    const [a3, b3] = lettersByAxis[3]!;
    const p0 = (l: string) => (l === a0 ? axes[axisOrder[0]]!.plusPct : axes[axisOrder[0]]!.minusPct);
    const p1 = (l: string) => (l === a1 ? axes[axisOrder[1]]!.plusPct : axes[axisOrder[1]]!.minusPct);
    const p2 = (l: string) => (l === a2 ? axes[axisOrder[2]]!.plusPct : axes[axisOrder[2]]!.minusPct);
    const p3 = (l: string) => (l === a3 ? axes[axisOrder[3]]!.plusPct : axes[axisOrder[3]]!.minusPct);
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

export function evaluateScoreOutcomes(payloads: any[], rules: any): string {
  const totals: Record<string, number> = {};
  (Array.isArray(payloads) ? payloads : []).forEach((p) => {
    const scores = p?.scores || p?.score || null;
    if (!scores || typeof scores !== "object") return;
    Object.keys(scores).forEach((k) => {
      const v = Number(scores[k]);
      if (!Number.isFinite(v)) return;
      totals[k] = (totals[k] || 0) + v;
    });
  });

  const keys = Object.keys(totals);
  if (!keys.length) throw new Error("No scores found in answer payloads.");

  const tieOrder: string[] = Array.isArray(rules?.tieBreakOrder)
    ? (rules.tieBreakOrder as string[])
    : [];
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


