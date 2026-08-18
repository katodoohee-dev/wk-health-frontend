import { apiFetch } from "@/lib/api";

export type MealSaveInput = {
  name?: string;
  foodName?: string;
  kcal?: number;
  calories?: number;
  protein?: number;
  carb?: number;
  carbs?: number;
  fat?: number;
  sodium?: number;
  fiber?: number;
  slot?: string;
  meal?: string;
  mealType?: string;
  photoUrl?: string | null;
  description?: string;
  source?: "manual" | "vision" | "nlp" | "barcode";
};

function normalizeMeal(value?: string) {
  const v = String(value ?? "").trim().toLowerCase();
  if (["breakfast", "เช้า", "มื้อเช้า"].includes(v)) return "breakfast";
  if (["lunch", "กลางวัน", "มื้อกลางวัน"].includes(v)) return "lunch";
  if (["dinner", "เย็น", "มื้อเย็น"].includes(v)) return "dinner";
  if (["snack", "ของว่าง"].includes(v)) return "snack";
  return "snack";
}

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Single canonical client entry point for saving any food into the diary. */
export async function apiSaveMeal(input: MealSaveInput) {
  const foodName = String(input.foodName ?? input.name ?? "").trim();
  const calories = finite(input.calories ?? input.kcal, -1);
  if (!foodName) throw new Error("กรุณาระบุชื่อเมนูอาหาร");
  if (calories < 0) throw new Error("กรุณาระบุจำนวนแคลอรี");

  return apiFetch("/api/scan/save", {
    method: "POST",
    body: {
      foodName,
      name: foodName,
      calories,
      kcal: calories,
      protein: finite(input.protein),
      carbs: finite(input.carbs ?? input.carb),
      carb: finite(input.carbs ?? input.carb),
      fat: finite(input.fat),
      sodium: finite(input.sodium),
      fiber: finite(input.fiber),
      mealType: normalizeMeal(input.mealType ?? input.slot ?? input.meal),
      slot: input.slot,
      meal: input.meal,
      photoUrl: input.photoUrl ?? null,
      description: input.description,
      source: input.source ?? "manual",
    },
  });
}
