/**
 * API: `POST /api/tests/:id/evaluate`
 *
 * Body:
 * - { answers: ["answer_id", ...] }  OR
 * - { selections: [{ questionId, answerId }, ...] }
 *
 * Runs `tests.rules_json` (DSL) against selected `answers.payload_json` and returns an outcome.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function withCacheHeaders(headers, { maxAge = 0 } = {}) {
  const h = new Headers(headers);
  h.set("Cache-Control", `no-store, max-age=${maxAge}`);
  return h;
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
  });
}

export async function onRequestPost(context) {
  const db = context.env.MBTI_DB;
  if (!db) return json(500, { error: "D1 binding MBTI_DB is missing." });

  const testId = context.params?.id ? String(context.params.id) : "";
  if (!testId) return json(400, { error: "Missing test id." });

  let body = null;
  try {
    body = await context.request.json();
  } catch (e) {
    return json(400, { error: "Request body must be valid JSON." });
  }

  const answerIds = normalizeAnswerIds(body);
  if (!answerIds.length) return json(400, { error: "No answers provided." });
  if (answerIds.length > 200)
    return json(400, { error: "Too many answers." });

  const testRow = await db
    .prepare(`SELECT id, title, type, rules_json FROM tests WHERE id = ?`)
    .bind(testId)
    .first();
  if (!testRow) return json(404, { error: "Test not found: " + testId });

  const rules = safeJsonParse(testRow.rules_json) || {};
  const mode = String(rules.mode || "").trim() || inferModeFromType(testRow.type);

  const payloads = await loadAnswerPayloads(db, testId, answerIds);
  if (!payloads.length) return json(400, { error: "No valid answers found." });

  let outcomeCode = "";
  try {
    if (mode === "mbtiAxes") {
      outcomeCode = evaluateMbtiAxes(payloads, rules);
    } else if (mode === "scoreOutcomes") {
      outcomeCode = evaluateScoreOutcomes(payloads, rules);
    } else if (mode === "custom") {
      // Minimal: allow custom to delegate to one of the built-ins.
      const delegate = String(rules.delegate || rules.strategy || "").trim();
      if (delegate === "mbtiAxes") outcomeCode = evaluateMbtiAxes(payloads, rules);
      else outcomeCode = evaluateScoreOutcomes(payloads, rules);
    } else {
      return json(400, { error: "Unsupported rules mode.", mode });
    }
  } catch (e) {
    return json(400, {
      error: "Failed to evaluate test rules.",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (!outcomeCode)
    return json(400, { error: "Could not determine outcome." });

  const outRow = await db
    .prepare(
      `SELECT code, title, image, summary, meta_json
       FROM outcomes
       WHERE test_id = ? AND code = ?`,
    )
    .bind(testId, outcomeCode)
    .first();

  if (!outRow) {
    return json(404, {
      error: "Outcome not found for computed code.",
      code: outcomeCode,
    });
  }

  const payload = {
    id: testRow.id,
    title: testRow.title ?? "",
    type: testRow.type ?? "generic",
    outcome: {
      code: outRow.code,
      title: outRow.title ?? "",
      image: outRow.image ?? "",
      summary: outRow.summary ?? "",
      meta: outRow.meta_json ? safeJsonParse(outRow.meta_json) : null,
    },
  };

  return json(200, payload);
}

function normalizeAnswerIds(body) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.answers)) {
    return body.answers
      .map((v) => String(v || "").trim())
      .filter((v) => v.length > 0);
  }
  if (Array.isArray(body.selections)) {
    return body.selections
      .map((s) => (s ? String(s.answerId || "").trim() : ""))
      .filter((v) => v.length > 0);
  }
  return [];
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
}

function inferModeFromType(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("mbti")) return "mbtiAxes";
  return "scoreOutcomes";
}

async function loadAnswerPayloads(db, testId, answerIds) {
  const uniq = Array.from(new Set(answerIds));
  const placeholders = uniq.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT answer_id, payload_json
     FROM answers
     WHERE test_id = ? AND answer_id IN (${placeholders})`,
  );
  const bound = stmt.bind(testId, ...uniq);
  const res = await bound.all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  return rows
    .map((r) => safeJsonParse(r.payload_json))
    .filter((v) => v && typeof v === "object");
}

function evaluateMbtiAxes(payloads, rules) {
  const axisOrder = Array.isArray(rules.axisOrder)
    ? rules.axisOrder
    : ["EI", "SN", "TF", "JP"];
  const axisDefaults = rules.axisDefaults || { EI: "I", SN: "S", TF: "T", JP: "J" };

  const totals = {};
  axisOrder.forEach((ax) => {
    totals[ax] = {};
  });

  payloads.forEach((p) => {
    const axis = String(p.axis || p.mbtiAxis || "").trim();
    const dir = String(p.dir || p.direction || "").trim();
    if (!axis || !dir) return;
    const weight = Number.isFinite(Number(p.weight)) ? Number(p.weight) : 1;
    if (!totals[axis]) totals[axis] = {};
    totals[axis][dir] = (totals[axis][dir] || 0) + weight;
  });

  const letters = axisOrder.map((ax) => {
    const m = totals[ax] || {};
    const dirs = Object.keys(m);
    if (dirs.length === 0) return String(axisDefaults?.[ax] || "").trim() || "";
    // pick highest count; stable tie-break via axisDefaults
    let bestDir = dirs[0];
    let bestScore = m[bestDir] || 0;
    for (let i = 1; i < dirs.length; i += 1) {
      const d = dirs[i];
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

function evaluateScoreOutcomes(payloads, rules) {
  const totals = {};
  payloads.forEach((p) => {
    const scores = p.scores || p.score || null;
    if (!scores || typeof scores !== "object") return;
    Object.keys(scores).forEach((k) => {
      const v = Number(scores[k]);
      if (!Number.isFinite(v)) return;
      totals[k] = (totals[k] || 0) + v;
    });
  });

  const keys = Object.keys(totals);
  if (!keys.length) throw new Error("No scores found in answer payloads.");

  const tieOrder = Array.isArray(rules.tieBreakOrder) ? rules.tieBreakOrder : [];
  let best = keys[0];
  let bestScore = totals[best] || 0;
  for (let i = 1; i < keys.length; i += 1) {
    const k = keys[i];
    const sc = totals[k] || 0;
    if (sc > bestScore) {
      best = k;
      bestScore = sc;
    } else if (sc === bestScore) {
      // Prefer earlier in tieBreakOrder if present.
      const a = tieOrder.indexOf(best);
      const b = tieOrder.indexOf(k);
      if (b !== -1 && (a === -1 || b < a)) best = k;
    }
  }

  return String(best).trim();
}


