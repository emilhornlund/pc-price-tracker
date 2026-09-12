import type { PriceDecrease } from './price-changes';

export interface EmailContent {
  subject: string;
  text: string;
}

export function buildPriceDecreaseEmail(
  decreases: readonly PriceDecrease[],
): EmailContent {
  const count = decreases.length;
  const subject = `PC Price Tracker — ${count} price decrease${
    count === 1 ? '' : 's'
  }`;
  const lines = [
    'PC Price Tracker',
    '',
    `${count} price${count === 1 ? '' : 's'} ${
      count === 1 ? 'has' : 'have'
    } decreased.`,
    '',
  ];

  decreases.forEach((decrease, index) => {
    if (index > 0) {
      lines.push('');
    }
    lines.push(
      decrease.product,
      '',
      decrease.store,
      `New price: ${formatSek(decrease.newPrice)}`,
      `Decrease: ${formatSek(decrease.decrease)}`,
    );
  });

  return { subject, text: lines.join('\n') };
}

export const generateEmailContent = buildPriceDecreaseEmail;

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
