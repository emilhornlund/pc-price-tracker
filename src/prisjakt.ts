export const DEFAULT_PRODUCT_PAGE_TIMEOUT_MS = 10_000;

export class PrisjaktProductFetchError extends Error {
  constructor(
    public readonly productUrl: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(
      `Failed to fetch Prisjakt product page ${productUrl}: ${reason}`,
      options,
    );
    this.name = 'PrisjaktProductFetchError';
  }
}

export async function fetchPrisjaktProductPage(
  productUrl: string,
  timeoutMs = DEFAULT_PRODUCT_PAGE_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(productUrl, { signal: controller.signal });

    if (!response.ok) {
      const status = response.statusText
        ? `${response.status} ${response.statusText}`
        : `${response.status}`;
      throw new PrisjaktProductFetchError(productUrl, `HTTP ${status}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof PrisjaktProductFetchError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new PrisjaktProductFetchError(
        productUrl,
        `request timed out after ${timeoutMs} ms`,
        { cause: error },
      );
    }

    const reason = error instanceof Error ? error.message : String(error);
    throw new PrisjaktProductFetchError(productUrl, reason, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
