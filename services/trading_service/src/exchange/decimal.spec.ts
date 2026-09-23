import { balanceUnits, decimal, units } from './decimal';

describe('exchange decimal contract', () => {
  it('settles fractional shares exactly without cent rounding', () => {
    expect(decimal(units('0.01', 2) * units('0.0001', 4), 6)).toBe('0.000001');
    expect(decimal(units('90', 2) * units('10', 4), 6)).toBe('900.000000');
  });
  it.each(['NaN', 'Infinity', '-1', '0', '0.001', '1e2', '', undefined])(
    'rejects invalid prices %s',
    (value) => {
      expect(() => units(value, 2)).toThrow();
    },
  );
  it('accepts padded database values but never truncates a real fraction', () => {
    expect(balanceUnits('123.45000000', 6)).toBe(123450000n);
    expect(() => balanceUnits('0.00000001', 6)).toThrow();
  });
});
