import { createContext } from 'solid-js';

const widths = new WeakMap();

const editStates = new WeakMap();

export const nodeBindings = new WeakMap();

export const defaultState = {
  selectionState: 'none',
  dragTarget: null,
  editing: false,
  touchTarget: null,
  touchTimeout: null,
  doubleTouchTarget: null,
  doubleTouchTimeout: null,
  doubleTouchRange: null,
  doubleClickTarget: null,
  doubleClickTimeout: null,
  doubleClickRange: null,
};

export const StoreContext = createContext();

export const BABLRContext = createContext();

export const DocumentContext = createContext();

export const SelectionContext = createContext();

export const EditContext = createContext({ widths, editStates });
