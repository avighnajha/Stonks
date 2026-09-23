import { BadRequestException } from '@nestjs/common';

/** Prices are cents, quantities are 1/10000 shares, cash is millionths.
 * Never round an incoming order silently or calculate settlement with floats. */
export function units(value: unknown, scale: number, positive = true): bigint {
  const text = String(value);
  if (text.length > 32)
    throw new BadRequestException('Decimal outside supported range');
  if (!/^\d+(\.\d+)?$/.test(text))
    throw new BadRequestException('Invalid decimal');
  const [whole, fraction = ''] = text.split('.');
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > scale)
    throw new BadRequestException(`Maximum ${scale} decimal places`);
  const result =
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, '0'));
  if ((positive && result <= 0n) || result > 999999999999n)
    throw new BadRequestException('Decimal outside supported range');
  return result;
}

export function decimal(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value)
    .toString()
    .padStart(scale + 1, '0');
  return scale
    ? `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    : `${sign}${digits}`;
}

// Database balances may be larger than a single permitted order.
export function balanceUnits(value: string | number, scale: number): bigint {
  const [whole, fraction = ''] = String(value).split('.');
  if (!/^\d+$/.test(whole) || /[1-9]/.test(fraction.slice(scale)))
    throw new Error('Invalid persisted precision');
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, '0'))
  );
}
