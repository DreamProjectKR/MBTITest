import { chromium } from "playwright";

function assetPath(u) {
  const i = u.indexOf("/assets/");
  return i >= 0 ? u.split("?")[0].slice(i) : null;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});
const introPaths = new Map(); // file -> Set(widths)

page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("test-summer/images")) return;
  const p = assetPath(u);
  if (!p || !/q\d+\.png|[EI][NS][FT][JP]\.png/i.test(p)) return;
  const w = (u.match(/width=(\d+)/) || [])[1] || "?";
  if (!introPaths.has(p)) introPaths.set(p, new Set());
  introPaths.get(p).add(w);
});

await page.goto("https://dreamp.org/testintro.html?testId=test-summer", {
  waitUntil: "load",
  timeout: 90000,
});
await page.waitForTimeout(16000);

const introFiles = [...introPaths.keys()].sort();
const introWidthsOnly320 = [...introPaths.values()].every((s) =>
  [...s].every((w) => w === "320"),
);

page.removeAllListeners("request");
const qW = [];
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("test-summer/images/q") || !u.includes("cdn-cgi")) return;
  const w = (u.match(/width=(\d+)/) || [])[1];
  const fm = u.match(/format=(webp|auto|avif)/);
  const f = fm ? fm[1] : "?";
  qW.push(`${w}|${f}`);
});

await page.goto("https://dreamp.org/testquiz.html?testId=test-summer", {
  waitUntil: "load",
  timeout: 90000,
});
await page.waitForTimeout(7000);

await browser.close();

const uniqQuiz = [...new Set(qW)];
console.log(
  JSON.stringify(
    {
      intro: {
        distinctQuizAssetFiles: introFiles.length,
        files: introFiles,
        preloadOnly320Widths: introWidthsOnly320,
        widthSetsSample: Object.fromEntries(
          [...introPaths.entries()].slice(0, 6).map(([k, v]) => [k, [...v]]),
        ),
      },
      testquiz: {
        questionCdnRequests: qW.length,
        uniqueWidthFormat: uniqQuiz,
        passSingle480Webp: uniqQuiz.length === 1 && uniqQuiz[0] === "480|webp",
      },
      consoleErrorsSample: consoleErrors.slice(0, 6),
    },
    null,
    2,
  ),
);
