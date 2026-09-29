"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  variantId: string;
  handle: string;
  title: string;
  variantTitle: string;
  image: string | null;
  price: string;
  quantity: number;
  /** Upper bound from stock, when known */
  maxQuantity: number | null;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  addLine: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "sask-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

const clamp = (qty: number, max: number | null) => Math.max(1, max == null ? qty : Math.min(qty, max));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser storage once
      if (stored) setLines(JSON.parse(stored));
    } catch {
      // storage unavailable (private mode) — start with an empty cart
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // ignore
    }
  }, [lines, ready]);

  const addLine = useCallback((line: CartLine) => {
    setLines((current) => {
      const existing = current.find((l) => l.variantId === line.variantId);
      if (!existing) return [...current, { ...line, quantity: clamp(line.quantity, line.maxQuantity) }];
      return current.map((l) =>
        l.variantId === line.variantId
          ? { ...l, quantity: clamp(l.quantity + line.quantity, line.maxQuantity) }
          : l,
      );
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) =>
      current.map((l) => (l.variantId === variantId ? { ...l, quantity: clamp(quantity, l.maxQuantity) } : l)),
    );
  }, []);

  const removeLine = useCallback((variantId: string) => {
    setLines((current) => current.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0),
      addLine,
      setQuantity,
      removeLine,
      clear,
    }),
    [lines, ready, addLine, setQuantity, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
