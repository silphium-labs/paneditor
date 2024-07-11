import { createContext } from 'solid-js';

export const defaultState = {
  selectedRange: [null, null],
};

export const StoreContext = createContext();

export const AgastContext = createContext();

export const SelectionContext = createContext();
