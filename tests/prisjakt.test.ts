import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  fetchPrisjaktProductPage,
  parsePrisjaktProductTitle,
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
