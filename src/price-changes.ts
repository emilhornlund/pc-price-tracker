export interface PriceDecrease {
  product: string;
  store: string;
  previousPrice: number;
  newPrice: number;
  decrease: number;
}

export function detectPriceDecrease(
  product: string,
  store: string,
  previousPrice: number | undefined,
  newPrice: number,
): PriceDecrease | undefined {
  validatePrice(newPrice, 'new price');

  if (previousPrice === undefined) {
    return undefined;
  }

  validatePrice(previousPrice, 'previous price');
  if (newPrice >= previousPrice) {
    return undefined;
  }

  return {
    product,
    store,
    previousPrice,
    newPrice,
    decrease: previousPrice - newPrice,
  };
}

export function comparePrices(
  previousPrice: number | undefined,
  newPrice: number,
): number | undefined {
  validatePrice(newPrice, 'new price');
  if (previousPrice === undefined) {
    return undefined;
  }

  validatePrice(previousPrice, 'previous price');
  return newPrice < previousPrice ? previousPrice - newPrice : undefined;
}

function validatePrice(price: number, label: string): void {
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new Error(`${label} must be a non-negative integer in öre`);
  }
}
