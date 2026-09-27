import { validateManifest } from './manifest';
const valid = () => ({
  version: 1,
  durationMs: 10000,
  stepMs: 1000,
  seed: 42,
  assets: [
    {
      id: 'a',
      name: 'Asset A',
      sector: 'Sports',
      subsector: 'Football',
      price: '100.00',
      marketWeight: 0.01,
      sectorWeight: 0.02,
      subsectorWeight: 0.02,
      idiosyncraticWeight: 0.01,
    },
  ],
  groups: [
    {
      id: 'g',
      strategy: 'idle',
      count: 2,
      cash: '1000.00',
      inventory: '10.0000',
      wakeMs: 1000,
      delayMs: 0,
      signalNoise: 0,
      parameters: {},
    },
  ],
  events: [],
});
test('freezes a valid bounded manifest and rejects unknown strategies and oversized runs', () => {
  const value = valid();
  expect(validateManifest(value).seed).toBe(42);
  for (const change of [
    { durationMs: 0 },
    { stepMs: 0 },
    { seed: 1.1 },
    { extra: true },
    { groups: [{ ...value.groups[0], count: 10001 }] },
    { groups: [{ ...value.groups[0], strategy: 'os.system' }] },
  ])
    expect(() => validateManifest({ ...value, ...change })).toThrow();
});
test('rejects inconsistent scope, duplicate identities, precision loss and nonfinite values', () => {
  const v = valid();
  for (const change of [
    { assets: [v.assets[0], v.assets[0]] },
    { assets: [{ ...v.assets[0], price: '1.001' }] },
    { assets: [{ ...v.assets[0], marketWeight: NaN }] },
    {
      events: [
        {
          atMs: 20000,
          assetId: 'a',
          shock: 0.1,
          releaseDelayMs: 0,
          headline: 'News',
          signal: 1,
        },
      ],
    },
    {
      events: [
        {
          atMs: 1000,
          assetId: 'missing',
          shock: 0.1,
          releaseDelayMs: 0,
          headline: 'News',
          signal: 1,
        },
      ],
    },
  ])
    expect(() => validateManifest({ ...v, ...change })).toThrow();
});
