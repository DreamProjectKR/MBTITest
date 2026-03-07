/** Admin entry: bootstrap store, effects, and render subscription. */
import { elements } from "./dom.js";
import { createAdminEffects } from "./effects.js";
import { bindForms } from "./forms.js";
import { adminReducer, initialAdminState } from "./reducer.js";
import { renderAdmin, showToast } from "./render.js";
import { createStore } from "./store.js";

function wireHeaderEvents(effects) {
  elements.createTestButton?.addEventListener("click", () =>
    effects.createTest(),
  );
  elements.testSelect?.addEventListener("change", (event) => {
    effects.loadTest(event.target.value);
  });
  elements.saveButton?.addEventListener("click", () =>
    effects.saveActiveTest(),
  );
  elements.bulkUploadButton?.addEventListener("click", () =>
    effects.handleBulkResultUpload(),
  );
}

export async function initAdmin() {
  if (!elements.metaForm) return;
  const store = createStore(adminReducer, initialAdminState);
  const effects = createAdminEffects(store, { showToast });
  store.subscribe((nextState, previousState) =>
    renderAdmin(nextState, previousState),
  );
  renderAdmin(store.getState(), null);

  wireHeaderEvents(effects);
  bindForms({ store, effects });

  try {
    await effects.bootstrap();
  } catch (error) {
    showToast(error?.message || "초기 목록 로딩 실패", true);
  }
}
