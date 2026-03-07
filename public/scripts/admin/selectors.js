export function getActiveTest(state) {
  const activeId = state.activeTestId;
  if (!activeId) return null;
  return state.loadedTests[activeId] ?? null;
}

export function getSaveStatus(state) {
  return {
    message: state.ui.saveMessage,
    isError: Boolean(state.ui.saveError),
  };
}

export function shouldHydrateMeta(state, previousState) {
  if (!previousState) return true;
  return (
    state.activeTestId !== previousState.activeTestId ||
    state.ui.metaHydrationKey !== previousState.ui.metaHydrationKey
  );
}
