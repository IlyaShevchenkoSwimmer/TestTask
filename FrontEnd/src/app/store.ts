import { configureStore } from "@reduxjs/toolkit";
import nomenclatureReducer from "../features/nomenclature/nomenclatureSlice";
import remainsReducer from "../features/remains/remainsSlice";

export const store = configureStore({
  reducer: {
    nomenclature: nomenclatureReducer,
    remains: remainsReducer,
  },
});

// Типы для типизированных хуков.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
