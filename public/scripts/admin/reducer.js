export const initialAdminState = {
  tests: [],
  loadedTests: {},
  activeTestId: null,
  imageList: [],
  ui: {
    isSaving: false,
    saveMessage: "",
    saveError: false,
    loading: {
      meta: false,
      questions: false,
      results: false,
    },
    metaHydrationKey: 0,
  },
};

function syncMetaList(tests, test) {
  const exists = tests.some((item) => item.id === test.id);
  if (!exists) return tests;
  return tests.map((item) => {
    if (item.id !== test.id) return item;
    return {
      ...item,
      title: test.title ?? item.title,
      thumbnail: test.thumbnail ?? item.thumbnail,
      tags: Array.isArray(test.tags) ? [...test.tags] : [...(item.tags ?? [])],
      path: test.path ?? item.path,
      createdAt: test.createdAt ?? item.createdAt,
      updatedAt: test.updatedAt ?? item.updatedAt,
      isPublished: Boolean(test.isPublished),
    };
  });
}

export function adminReducer(state, action) {
  switch (action.type) {
    case "SET_TESTS":
      return { ...state, tests: action.tests };
    case "SET_ACTIVE_TEST":
      return { ...state, activeTestId: action.testId || null };
    case "SET_LOADED_TEST":
      return {
        ...state,
        loadedTests: {
          ...state.loadedTests,
          [action.test.id]: action.test,
        },
      };
    case "SET_IMAGE_LIST":
      return { ...state, imageList: action.items };
    case "SET_SAVE_STATUS":
      return {
        ...state,
        ui: {
          ...state.ui,
          saveMessage: action.message,
          saveError: Boolean(action.isError),
        },
      };
    case "SET_IS_SAVING":
      return {
        ...state,
        ui: { ...state.ui, isSaving: Boolean(action.value) },
      };
    case "SET_PANEL_LOADING":
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: {
            ...state.ui.loading,
            [action.panelKey]: Boolean(action.value),
          },
        },
      };
    case "REQUEST_META_HYDRATE":
      return {
        ...state,
        ui: {
          ...state.ui,
          metaHydrationKey: state.ui.metaHydrationKey + 1,
        },
      };
    case "SYNC_TEST_META_FROM_TEST":
      return {
        ...state,
        tests: syncMetaList(state.tests, action.test),
      };
    case "ADD_TEST":
      return {
        ...state,
        tests: [...state.tests, action.meta],
        loadedTests: {
          ...state.loadedTests,
          [action.test.id]: action.test,
        },
        activeTestId: action.test.id,
        ui: {
          ...state.ui,
          metaHydrationKey: state.ui.metaHydrationKey + 1,
        },
      };
    default:
      return state;
  }
}
