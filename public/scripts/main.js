// src/scripts/legacy/main.js
var header = document.getElementById("header");
var headerScroll = document.getElementById("headerScroll");
var MainTop = document.getElementById("MainTop");
var ASSETS_BASE = window.ASSETS_BASE || "";
var assetUrl = window.assetUrl || ((path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  let clean = String(path).replace(/^\.?\/+/, "");
  clean = clean.replace(/^assets\/+/i, "");
  return `${ASSETS_BASE}/${clean}`.replace(/\/{2,}/g, "/");
});
var headerOffset = header.offsetTop;
window.addEventListener("scroll", () => {
  if (window.scrollY > headerOffset) {
    header.classList.add("fixed-header", "bg-on");
  } else {
    header.classList.remove("fixed-header", "bg-on");
  }
});
function resolveThumbnailPath(thumbnail) {
  if (!thumbnail) return "#";
  if (thumbnail.startsWith("http")) return thumbnail;
  return assetUrl(thumbnail);
}
function createTestCard(test, variantClass) {
  const shell = document.createElement("div");
  shell.className = `NewTestShell ${variantClass}`;
  const card = document.createElement("div");
  card.className = "NewTest";
  const img = document.createElement("img");
  img.src = resolveThumbnailPath(test.thumbnail);
  img.alt = test.title || "\uD14C\uC2A4\uD2B8 \uC774\uBBF8\uC9C0";
  const title = document.createElement("h4");
  title.textContent = test.title || "\uD14C\uC2A4\uD2B8 \uC774\uB984";
  const tagBox = document.createElement("div");
  tagBox.className = "NewTestHashTag";
  const tags = Array.isArray(test.tags) ? test.tags : [];
  tagBox.innerHTML = tags.slice(0, 3).map((tag) => `<span class="HashTag">#${tag}</span>`).join("");
  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(tagBox);
  shell.appendChild(card);
  shell.onclick = () => {
    const dest = `testintro.html?testId=${encodeURIComponent(test.id || "")}`;
    window.location.href = dest;
  };
  return shell;
}
async function fetchTestsAjax() {
  const apiBase = window.API_TESTS_BASE || "/api/tests";
  try {
    const res = await fetch(apiBase);
    if (!res.ok) throw new Error(apiBase + " \uC694\uCCAD \uC2E4\uD328: " + res.status);
    const data = await res.json();
    return Array.isArray(data?.tests) ? data.tests : [];
  } catch (err) {
    // Fallback (legacy): R2-backed index.json
    if (typeof window.getTestIndex === "function") {
      const data2 = await window.getTestIndex();
      return Array.isArray(data2?.tests) ? data2.tests : [];
    }
    const url = window.TEST_INDEX_URL || "/assets/index.json";
    const res2 = await fetch(url);
    if (!res2.ok) throw new Error(url + " \uC694\uCCAD \uC2E4\uD328: " + res2.status);
    const data3 = await res2.json();
    return Array.isArray(data3?.tests) ? data3.tests : [];
  }
}
function normalizeTests(tests) {
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const t of tests) {
    const key = `${t.id}-${t.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }
  deduped.sort((a, b) => {
    const ad = new Date(a.updatedAt || a.createdAt || 0);
    const bd = new Date(b.updatedAt || b.createdAt || 0);
    return bd - ad;
  });
  return deduped.map((t) => ({
    ...t,
    thumbnail: resolveThumbnailPath(t.thumbnail)
  }));
}
function renderSections(tests) {
  const newTestLists = document.querySelectorAll(".NewTestList");
  const newSection = newTestLists[0];
  const topSection = newTestLists[1];
  if (!newSection || !topSection) return;
  const newShellContainer = newSection.querySelector(".NewTestListShell");
  const topShellContainer = topSection.querySelector(".NewTestListShell");
  if (newShellContainer) newShellContainer.innerHTML = "";
  if (topShellContainer) topShellContainer.innerHTML = "";
  const newTests = tests.slice(0, Math.min(4, tests.length));
  newTests.forEach((test) => {
    if (newShellContainer) {
      newShellContainer.appendChild(createTestCard(test, "newtest"));
    }
  });
  const topTests = tests.slice(0, Math.min(8, tests.length));
  topTests.forEach((test) => {
    if (topShellContainer) {
      topShellContainer.appendChild(createTestCard(test, "toptest"));
    }
  });
}
function initTestSectionsAjax() {
  fetchTestsAjax().then(normalizeTests).then(renderSections).catch((err) => console.error("\uD14C\uC2A4\uD2B8 \uBAA9\uB85D \uB85C\uB529 \uC2E4\uD328:", err));
}
document.addEventListener("DOMContentLoaded", initTestSectionsAjax);
//# sourceMappingURL=main.js.map
