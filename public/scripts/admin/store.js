export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispatch(action) {
    const previousState = state;
    const nextState = reducer(state, action);
    if (nextState === state) return state;
    state = nextState;
    listeners.forEach((listener) => listener(state, previousState, action));
    return state;
  }

  return { getState, subscribe, dispatch };
}
