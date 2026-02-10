import { API_ADMIN_TESTS_BASE, API_TESTS_BASE } from "./state.js";

export function fetchJson(url, options) {
  return fetch(url, options).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || "요청 실패");
    }
    return body;
  });
}

export function fetchTestsIndex() {
  return fetchJson(API_TESTS_BASE);
}

export function fetchTestDetail(testId) {
  return fetchJson(`${API_TESTS_BASE}/${encodeURIComponent(testId)}`);
}

export function saveTest(testId, payload) {
  return fetchJson(`${API_ADMIN_TESTS_BASE}/${encodeURIComponent(testId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchImageList(testId) {
  return fetchJson(
    `${API_ADMIN_TESTS_BASE}/${encodeURIComponent(testId)}/images`,
  );
}

export function uploadTestImage(testId, file, name) {
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);
  return fetchJson(
    `${API_ADMIN_TESTS_BASE}/${encodeURIComponent(testId)}/images`,
    {
      method: "PUT",
      body: formData,
    },
  );
}

export function uploadResultImage(testId, code, file) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchJson(
    `${API_ADMIN_TESTS_BASE}/${encodeURIComponent(testId)}/results/${encodeURIComponent(code)}/image`,
    {
      method: "PUT",
      body: formData,
    },
  );
}
