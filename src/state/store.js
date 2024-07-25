import { createContext } from 'solid-js';

const widths = new WeakMap();

export const defaultState = {
  selectionState: 'none',
  dragState: 'none',
  editing: false,
  doubleClickTarget: null,
  doubleClickRange: null,
};

export const StoreContext = createContext();

export const AgastContext = createContext();

export const SelectionContext = createContext();

export const SumContext = createContext({ widths });
