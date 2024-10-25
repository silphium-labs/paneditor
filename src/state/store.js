import { embeddedSourceFrom } from '@bablr/helpers/source';
import { createContext } from 'solid-js';

const widths = new WeakMap();

export const nodeBindings = new WeakMap();

export const defaultState = {
  document: {
    source: embeddedSourceFrom(
      `'[\n  1, 2, -33,\n  444, {\n    "num": 5555,\n    "str": "hello world",\n    "gap": '<//>'\n  }\n]'`,
      // `'[]'`,
    ),
    expressions: [],
  },
  selectionState: 'none',
  dragTarget: null,
  editing: false,
  doubleClickTarget: null,
  doubleClickRange: null,
};

export const StoreContext = createContext();

export const BABLRContext = createContext();

export const SelectionContext = createContext();

export const SumContext = createContext({ widths });
