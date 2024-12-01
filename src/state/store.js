import { createContext } from 'solid-js';

const widths = new WeakMap();

export const nodeBindings = new WeakMap();

export const defaultState = {
  selectionState: 'none',
  dragTarget: null,
  editing: false,
  doubleClickTarget: null,
  doubleClickRange: null,
};

export const StoreContext = createContext();

export const BABLRContext = createContext();

export const DocumentContext = createContext();

export const SelectionContext = createContext();

export const SumContext = createContext({ widths });
