import { buildPriceEventsEmail, formatSek } from '../src/email';

describe('buildPriceEventsEmail', () => {
  it('builds one consolidated message containing every decrease', () => {
    expect(
      buildPriceEventsEmail([
        {
          type: 'PRICE_DECREASE',
          product: 'Corsair Vengeance DDR5 32GB',
          store: 'Inet',
          previousPrice: 159_900,
          newPrice: 149_900,
          decrease: 10_000,
        },
        {
          type: 'PRICE_DECREASE',
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
        'Previous price: 1 599 SEK',
        'New price: 1 499 SEK',
        'Decrease: 100 SEK',
        '',
        'AMD Ryzen 7 9800X3D',
        '',
        'Proshop',
        'Previous price: 4 999 SEK',
        'New price: 4 799 SEK',
        'Decrease: 200 SEK',
      ].join('\n'),
    });
  });

  it('makes first-observed status and current price clear', () => {
    const content = buildPriceEventsEmail([
      {
        type: 'FIRST_OBSERVED',
        product: 'Product',
        store: 'Store',
        currentPrice: 100_050,
      },
    ]);

    expect(content.subject).toBe('PC Price Tracker — 1 first observation');
    expect(content.text).toContain('1 price was first observed.');
    expect(content.text).toContain('Current price: 1 000,50 SEK');
    expect(content.text).toContain('Status: First observed');
    expect(formatSek(100)).toBe('1 SEK');
  });

  it('uses one mixed subject for first observations and decreases', () => {
    expect(
      buildPriceEventsEmail([
        {
          type: 'FIRST_OBSERVED',
          product: 'New product',
          store: 'New store',
          currentPrice: 99_900,
        },
        {
          type: 'PRICE_DECREASE',
          product: 'Tracked product',
          store: 'Tracked store',
          previousPrice: 159_900,
          newPrice: 149_900,
          decrease: 10_000,
        },
      ]),
    ).toEqual(
      expect.objectContaining({
        subject: 'PC Price Tracker — 2 price notifications',
        text: expect.stringContaining(
          '2 price notifications: 1 first observed, 1 decreased.',
        ),
      }),
    );
  });
});
