import { comparePrices, detectPriceDecrease } from '../src/price-changes';

describe('detectPriceDecrease', () => {
  it('establishes a baseline when there is no previous observation', () => {
    expect(
      detectPriceDecrease('Product', 'Store', undefined, 149_900),
    ).toBeUndefined();
  });

  it.each([
    [149_900, 149_900],
    [149_900, 159_900],
  ])('does not detect a decrease from %i to %i', (previous, current) => {
    expect(
      detectPriceDecrease('Product', 'Store', previous, current),
    ).toBeUndefined();
  });

  it('returns the complete change when the price decreases', () => {
    expect(detectPriceDecrease('Product', 'Store', 159_900, 149_900)).toEqual({
      product: 'Product',
      store: 'Store',
      previousPrice: 159_900,
      newPrice: 149_900,
      decrease: 10_000,
    });
  });

  it('also exposes the numeric decrease comparison', () => {
    expect(comparePrices(undefined, 100)).toBeUndefined();
    expect(comparePrices(100, 100)).toBeUndefined();
    expect(comparePrices(100, 110)).toBeUndefined();
    expect(comparePrices(100, 90)).toBe(10);
  });
});
