import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  ApiErrorResponse,
  NomenclatureItem,
  NomenclatureResponse,
} from "../nomenclature/types";

const API_URL = "http://localhost:5000/api/nomenclature/remains";

type Status = "idle" | "loading" | "succeeded" | "failed";

interface RemainsState {
  items: NomenclatureItem[];
  status: Status;
  error: string | null;
}

const initialState: RemainsState = {
  items: [],
  status: "idle",
  error: null,
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

export const fetchRemains = createAsyncThunk<
  NomenclatureResponse,
  void,
  { rejectValue: string }
>("remains/fetch", async (_, { rejectWithValue }) => {
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

const remainsSlice = createSlice({
  name: "remains",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRemains.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(
        fetchRemains.fulfilled,
        (state, action: PayloadAction<NomenclatureResponse>) => {
          state.status = "succeeded";
          state.items = action.payload;
          state.error = null;
        },
      )
      .addCase(fetchRemains.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          action.payload ?? action.error.message ?? "Неизвестная ошибка";
      });
  },
});

export default remainsSlice.reducer;
