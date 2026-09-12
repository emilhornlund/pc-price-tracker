import { fetchPrisjaktProductPage } from '../src/prisjakt';

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
