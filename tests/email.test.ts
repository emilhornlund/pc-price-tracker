import { buildPriceDecreaseEmail, formatSek } from '../src/email';

describe('buildPriceDecreaseEmail', () => {
  it('builds one consolidated message containing every decrease', () => {
    expect(
      buildPriceDecreaseEmail([
        {
          product: 'Corsair Vengeance DDR5 32GB',
          store: 'Inet',
          previousPrice: 159_900,
          newPrice: 149_900,
          decrease: 10_000,
        },
        {
          product: 'AMD Ryzen 7 9800X3D',
          store: 'Proshop',
          previousPrice: 499_900,
          newPrice: 479_900,
          decrease: 20_000,
        },
      ]),
    ).toEqual({
      subject: 'PC Price Tracker — 2 price decreases',
      text: [
        'PC Price Tracker',
        '',
        '2 prices have decreased.',
        '',
        'Corsair Vengeance DDR5 32GB',
        '',
        'Inet',
        'New price: 1 499 SEK',
        'Decrease: 100 SEK',
        '',
        'AMD Ryzen 7 9800X3D',
        '',
        'Proshop',
        'New price: 4 799 SEK',
        'Decrease: 200 SEK',
      ].join('\n'),
    });
  });

  it('formats a singular notification correctly', () => {
    const content = buildPriceDecreaseEmail([
      {
        product: 'Product',
        store: 'Store',
        previousPrice: 100_050,
        newPrice: 99_950,
        decrease: 100,
      },
    ]);

    expect(content.subject).toBe('PC Price Tracker — 1 price decrease');
    expect(content.text).toContain('1 price has decreased.');
    expect(content.text).toContain('New price: 999,50 SEK');
    expect(formatSek(100)).toBe('1 SEK');
  });
});
