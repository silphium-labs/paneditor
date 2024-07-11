import { createSlice } from '@reduxjs/toolkit';

export const editorSlice = createSlice({
  name: 'editor',
  initialState: {
    selectedRange: [null, null],
    reducers: {
      setSelectedRange: (state, action) => {
        state.selectedRange = action.value;
      },
    },
  },
});
