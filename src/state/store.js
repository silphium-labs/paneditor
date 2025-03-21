import { configureStore } from '@reduxjs/toolkit';

const { freeze } = Object;

export const defaultState = freeze({
  focus: 'hierarchy',
  mode: 'select',
});

export const reducer = (state = defaultState, action) => {
  switch (action.type) {
    case 'CHANGE_MODE': {
      return freeze({ ...state, mode: action.value.mode });
    }

    case 'CHANGE_FOCUS': {
      return freeze({ ...state, focus: action.value.mode });
    }

    default:
      return state;
  }
};

export const actions = {
  changeMode: (mode) => {
    return { type: 'CHANGE_MODE', value: { mode } };
  },
  changeFocus: (mode) => {
    return { type: 'CHANGE_FOCUS', value: { mode } };
  },
};

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
