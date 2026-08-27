export interface LivePrice {
  amount: number;
  currency: string;
  interval: string | null;
}

export function formatPrice(price: LivePrice): { amount: string; detail: string } {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2,
  }).format(price.amount / 100);

  return {
    amount: formatted,
    detail: price.interval ? `/ ${price.interval}` : "",
  };
}
