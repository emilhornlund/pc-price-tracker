import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  fetchPrisjaktProductPage,
  parsePrisjaktProduct,
  parsePrisjaktProductOffers,
  parsePriceToOre,
  parsePrisjaktProductTitle,
  PrisjaktPriceParseError,
  PrisjaktProductParseError,
} from '../src/prisjakt';

describe('parsePrisjaktProductTitle', () => {
  it('extracts and normalizes the title from a Prisjakt fixture', () => {
    const html = readFileSync(
      path.join(__dirname, 'fixtures', 'product-13438192.html'),
      'utf8',
    );

    expect(parsePrisjaktProductTitle(html)).toBe(
      'Kingston FURY Beast RGB DDR5 Black 6000MHz 2x32GB CL30 (KF560C30BBEAK2-64)',
    );
  });

  it('collapses whitespace in the title', () => {
    expect(
      parsePrisjaktProductTitle(
        '<html><body><h1>  Kingston&nbsp; FURY\n <span>Beast</span> </h1></body></html>',
      ),
    ).toBe('Kingston FURY Beast');
  });

  it('throws a clear error when no title is present', () => {
    expect(() =>
      parsePrisjaktProductTitle('<html><body><p>Product</p></body></html>'),
    ).toThrow(PrisjaktProductParseError);
    expect(() =>
      parsePrisjaktProductTitle('<html><body><p>Product</p></body></html>'),
    ).toThrow('product title was not found in an h1 element');
  });
});

describe('parsePrisjaktProductOffers', () => {
  it('extracts every store offer from a Prisjakt fixture', () => {
    const html = readFileSync(
      path.join(__dirname, 'fixtures', 'product-13438192.html'),
      'utf8',
    );

    expect(parsePrisjaktProductOffers(html)).toEqual([
      { store: 'NetOnNet', storeId: '2', price: 1_099_000 },
      { store: 'Komplett.se', storeId: '33', price: 1_355_700 },
      { store: 'Webhallen', storeId: '113', price: 1_359_900 },
      { store: 'CS MEGASTORE', storeId: '31588', price: 1_409_700 },
      {
        store: 'CDON',
        storeId: '429',
        price: 1_409_700,
      },
      { store: 'Proshop', storeId: '12419', price: 1_481_500 },
    ]);
  });

  it('ignores list entries that are not complete store offers', () => {
    const html = `
      <div data-test="OfferListItem">
        <a data-test="OfferClickoutButton"><img alt="Missing price" /></a>
      </div>
      <div data-test="OfferListItem">
        <a data-test="OfferClickoutButton" href="/go-to-shop/12/offer/3">
          <img alt="Valid store" /><h4>1 499 kr</h4>
        </a>
      </div>
    `;

    expect(parsePrisjaktProductOffers(html)).toEqual([
      { store: 'Valid store', storeId: '12', price: 149_900 },
    ]);
  });
});

describe('parsePrisjaktProduct', () => {
  it('returns the complete parsed product representation', () => {
    const html = `
      <h1>Example product</h1>
      <div data-test="OfferListItem">
        <a data-test="OfferClickoutButton" href="/go-to-shop/2/offer/4">
          <img alt="Example store" /><h4>1 499 kr</h4>
        </a>
      </div>
    `;

    expect(parsePrisjaktProduct(html)).toEqual({
      title: 'Example product',
      offers: [{ store: 'Example store', storeId: '2', price: 149_900 }],
    });
  });
});

describe('parsePriceToOre', () => {
  it.each([
    ['1499 kr', 149_900],
    ['1 499 kr', 149_900],
    ['1\u00a0499 SEK', 149_900],
    ['1.499,50 kr', 149_950],
    ['1 499,5 kr', 149_950],
  ])('normalizes %s to %i öre', (display, expected) => {
    expect(parsePriceToOre(display)).toBe(expected);
  });

  it.each(['', '1 49 kr', '1,234 kr', '1499,999 kr', '1499 kr extra'])(
    'rejects malformed price %s',
    (display) => {
      expect(() => parsePriceToOre(display)).toThrow(PrisjaktPriceParseError);
    },
  );
});

describe('fetchPrisjaktProductPage', () => {
  const productUrl = 'https://www.prisjakt.nu/produkt.php?p=13438192';
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('returns the HTML from a successful response', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      new Response('<html>product</html>', { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    await expect(fetchPrisjaktProductPage(productUrl)).resolves.toBe(
      '<html>product</html>',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      productUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects non-success responses with the product URL and status', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      new Response('unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    globalThis.fetch = fetchMock;

    const promise = fetchPrisjaktProductPage(productUrl);

    await expect(promise).rejects.toMatchObject({
      name: 'PrisjaktProductFetchError',
      productUrl,
    });
    await expect(promise).rejects.toThrow(`HTTP 503 Service Unavailable`);
  });

  it('wraps network failures with the product URL', async () => {
    const networkError = new Error('connection refused');
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockRejectedValue(networkError);
    globalThis.fetch = fetchMock;

    await expect(fetchPrisjaktProductPage(productUrl)).rejects.toMatchObject({
      name: 'PrisjaktProductFetchError',
      productUrl,
      cause: networkError,
    });
    await expect(fetchPrisjaktProductPage(productUrl)).rejects.toThrow(
      productUrl,
    );
  });

  it('aborts requests that exceed the timeout', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    ) as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    const promise = fetchPrisjaktProductPage(productUrl, 1_000);
    jest.advanceTimersByTime(1_000);

    await expect(promise).rejects.toThrow(`request timed out after 1000 ms`);
  });
});
