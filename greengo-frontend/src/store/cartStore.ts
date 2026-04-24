// src/store/cartStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "../services/api";

export interface CartItem extends Product {
  cartQuantity: number;
}

// ── Unit step config — how much each +/- press increments ────────────────────
export type UnitStep = 0.25 | 0.5 | 1;

export function getUnitStep(unit: string | undefined): UnitStep {
  const u = (unit ?? "").toLowerCase().trim();
  if (u === "kg" || u === "kilo" || u === "kilogram") return 0.5;
  if (u === "g"  || u === "gram")                      return 0.25;
  return 1;
}

export function formatQuantity(qty: number, unit: string | undefined): string {
  const u = (unit ?? "").toLowerCase().trim();
  if (u === "kg" || u === "kilo" || u === "kilogram") {
    return qty % 1 === 0 ? qty.toFixed(0) + " kg" : qty.toFixed(2).replace(/\.?0+$/, "") + " kg";
  }
  if (u === "g" || u === "gram") {
    return qty % 1 === 0 ? qty.toFixed(0) + " g" : qty.toFixed(2).replace(/\.?0+$/, "") + " g";
  }
  return qty % 1 === 0 ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, "");
}

interface CartState {
  cart: CartItem[];
  addToCart:      (product: Product, step?: number) => void;
  removeFromCart: (productName: string, step?: number) => void;
  clearCart:      () => void;
  totalPrice:     () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (product: Product, step?: number) => {
        const s = step ?? getUnitStep(product.unit);
        set((state) => {
          const existing = state.cart.find((i) => i.name === product.name);
          if (existing) {
            const next = Math.round((existing.cartQuantity + s) * 1000) / 1000;
            return { cart: state.cart.map((i) => i.name === product.name ? { ...i, cartQuantity: next } : i) };
          }
          return { cart: [...state.cart, { ...product, cartQuantity: s }] };
        });
      },

      removeFromCart: (productName: string, step?: number) => {
        set((state) => {
          const existing = state.cart.find((i) => i.name === productName);
          if (!existing) return state;
          const s    = step ?? getUnitStep(existing.unit);
          const next = Math.round((existing.cartQuantity - s) * 1000) / 1000;
          if (next <= 0) {
            return { cart: state.cart.filter((i) => i.name !== productName) };
          }
          return { cart: state.cart.map((i) => i.name === productName ? { ...i, cartQuantity: next } : i) };
        });
      },

      clearCart: () => set({ cart: [] }),

      totalPrice: (): number => {
        const { cart } = get();
        const raw = cart.reduce((sum, i) => sum + (i.price_per_unit || 0) * (i.cartQuantity || 0), 0);
        return Math.round(raw * 100) / 100;
      },
    }),
    {
      name:       "greengo-cart",
      storage:    createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);