const cache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase();
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(key === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency: key,
        maximumFractionDigits: 0,
      });
    } catch {
      f = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      });
    }
    cache.set(key, f);
  }
  return f;
}

/** Currency-aware money formatter (client-safe). */
export function formatMoney(amount: number, currency = "INR"): string {
  return formatter(currency).format(amount);
}

/** Back-compat INR helper. */
export function formatINR(amount: number): string {
  return formatMoney(amount, "INR");
}
