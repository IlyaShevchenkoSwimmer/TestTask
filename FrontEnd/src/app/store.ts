import { configureStore } from "@reduxjs/toolkit";
import nomenclatureReducer from "../features/nomenclature/nomenclatureSlice";

export const store = configureStore({
  reducer: {
    nomenclature: nomenclatureReducer,
  },
});

// Типы для типизированных хуков.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
