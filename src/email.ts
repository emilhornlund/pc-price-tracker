import type { PriceEvent } from './price-changes';

export interface EmailContent {
  subject: string;
  text: string;
}

export function buildPriceEventsEmail(
  priceEvents: readonly PriceEvent[],
): EmailContent {
  const firstObservedCount = priceEvents.filter(
    (event) => event.type === 'FIRST_OBSERVED',
  ).length;
  const decreaseCount = priceEvents.length - firstObservedCount;
  const subject = getSubject(
    priceEvents.length,
    firstObservedCount,
    decreaseCount,
  );
  const lines = [
    'PC Price Tracker',
    '',
    getSummary(priceEvents.length, firstObservedCount, decreaseCount),
    '',
  ];

  priceEvents.forEach((event, index) => {
    if (index > 0) {
      lines.push('');
    }
    lines.push(event.product, '', event.store);
    if (event.type === 'FIRST_OBSERVED') {
      lines.push(
        `Current price: ${formatSek(event.currentPrice)}`,
        'Status: First observed',
      );
    } else {
      lines.push(
        `Previous price: ${formatSek(event.previousPrice)}`,
        `New price: ${formatSek(event.newPrice)}`,
        `Decrease: ${formatSek(event.decrease)}`,
      );
    }
  });

  return { subject, text: lines.join('\n') };
}

export const generateEmailContent = buildPriceEventsEmail;

function getSubject(
  count: number,
  firstObservedCount: number,
  decreaseCount: number,
): string {
  if (decreaseCount === 0) {
    return `PC Price Tracker — ${count} first observation${count === 1 ? '' : 's'}`;
  }
  if (firstObservedCount === 0) {
    return `PC Price Tracker — ${count} price decrease${count === 1 ? '' : 's'}`;
  }
  return `PC Price Tracker — ${count} price notification${count === 1 ? '' : 's'}`;
}

function getSummary(
  count: number,
  firstObservedCount: number,
  decreaseCount: number,
): string {
  if (decreaseCount === 0) {
    return `${count} price${count === 1 ? '' : 's'} ${
      count === 1 ? 'was' : 'were'
    } first observed.`;
  }
  if (firstObservedCount === 0) {
    return `${count} price${count === 1 ? '' : 's'} ${
      count === 1 ? 'has' : 'have'
    } decreased.`;
  }
  return `${count} price notification${count === 1 ? '' : 's'}: ${
    firstObservedCount
  } first observed, ${decreaseCount} decreased.`;
}

export function formatSek(priceInOre: number): string {
  if (!Number.isSafeInteger(priceInOre) || priceInOre < 0) {
    throw new Error('Price must be a non-negative integer in öre');
  }

  const formatted = new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
    minimumFractionDigits: priceInOre % 100 === 0 ? 0 : 2,
  }).format(priceInOre / 100);

  return `${formatted.replace(/\u00a0/g, ' ')} SEK`;
}
