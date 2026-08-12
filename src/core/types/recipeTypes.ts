/* ------------------------------------------------------------------ */
/* 配方                                                                */
/* ------------------------------------------------------------------ */

export interface RecipeIngredient {
  itemId: string;
  count: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  outputItemId: string;
  outputCount: number;
  description: string;
}
