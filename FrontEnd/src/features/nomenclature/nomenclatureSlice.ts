import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  ApiErrorResponse,
  NomenclatureItem,
  NomenclatureResponse,
} from "./types";

const API_URL = "/api/nomenclature/request/";

type Status = "idle" | "loading" | "succeeded" | "failed";

interface NumericRange {
  min: string;
  max: string;
}

interface DateRange {
  from: string; // формат "YYYY-MM-DD"
  to: string;
}

interface NomenclatureState {
  items: NomenclatureItem[];
  status: Status;
  error: string | null;
  searchQuery: string;
  columnFilters: Record<string, string>;
  numericFilters: Record<string, NumericRange>;
  dateFilters: Record<string, DateRange>;
}

const initialState: NomenclatureState = {
  items: [],
  status: "idle",
  error: null,
  searchQuery: "",
  columnFilters: {},
  numericFilters: {},
  dateFilters: {},
};

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorResponse>;
    if (body && typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    /* тело не JSON */
  }
  return `Ошибка сервера (HTTP ${response.status})`;
}

export const fetchNomenclature = createAsyncThunk<
  NomenclatureResponse,
  void,
  { rejectValue: string }
>("nomenclature/fetch", async (_, { rejectWithValue }) => {
  let response: Response;
  try {
    response = await fetch(API_URL, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return rejectWithValue("Не удалось соединиться с сервером.");
  }
  if (!response.ok) {
    return rejectWithValue(await extractErrorMessage(response));
  }
  try {
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      return rejectWithValue("Некорректный формат данных от сервера.");
    }
    return data as NomenclatureResponse;
  } catch {
    return rejectWithValue("Не удалось разобрать ответ сервера.");
  }
});

const nomenclatureSlice = createSlice({
  name: "nomenclature",
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setColumnFilter(
      state,
      action: PayloadAction<{ column: string; value: string }>,
    ) {
      const { column, value } = action.payload;
      if (value) state.columnFilters[column] = value;
      else delete state.columnFilters[column];
    },
    setNumericFilter(
      state,
      action: PayloadAction<{
        column: string;
        bound: "min" | "max";
        value: string;
      }>,
    ) {
      const { column, bound, value } = action.payload;
      const current = state.numericFilters[column] ?? { min: "", max: "" };
      const updated = { ...current, [bound]: value };
      if (!updated.min && !updated.max) delete state.numericFilters[column];
      else state.numericFilters[column] = updated;
    },
    setDateFilter(
      state,
      action: PayloadAction<{
        column: string;
        bound: "from" | "to";
        value: string;
      }>,
    ) {
      const { column, bound, value } = action.payload;
      const current = state.dateFilters[column] ?? { from: "", to: "" };
      const updated = { ...current, [bound]: value };
      if (!updated.from && !updated.to) delete state.dateFilters[column];
      else state.dateFilters[column] = updated;
    },
    clearFilters(state) {
      state.searchQuery = "";
      state.columnFilters = {};
      state.numericFilters = {};
      state.dateFilters = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNomenclature.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(
        fetchNomenclature.fulfilled,
        (state, action: PayloadAction<NomenclatureResponse>) => {
          state.status = "succeeded";
          state.items = action.payload;
          state.error = null;
        },
      )
      .addCase(fetchNomenclature.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          action.payload ?? action.error.message ?? "Неизвестная ошибка";
      });
  },
});

export const {
  setSearchQuery,
  setColumnFilter,
  setNumericFilter,
  setDateFilter,
  clearFilters,
} = nomenclatureSlice.actions;

export default nomenclatureSlice.reducer;
