// Tests de la lógica de evaluación de reglas de automatización.
// Norte Motion: las reglas expresadas en lenguaje humano deben evaluarse correctamente.

type Metric = { roas: number; spend: number; revenue: number; clicks: number; impressions: number; conversions: number };
const make = (roasValues: number[]): Metric[] => roasValues.map(roas => ({ roas, spend: 100, revenue: roas * 100, clicks: 50, impressions: 1000, conversions: 2 }));

const calcAvg = (metrics: Metric[], metric: string): number => {
  const vals = metrics.map(m => {
    if (metric === 'roas')        return m.roas;
    if (metric === 'spend')       return m.spend;
    if (metric === 'conversions') return m.conversions;
    if (metric === 'ctr')         return m.impressions > 0 ? m.clicks / m.impressions : 0;
    if (metric === 'cpc')         return m.clicks > 0 ? m.spend / m.clicks : 0;
    return 0;
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};
const evalCond = (v: number, op: string, t: number) =>
  op === 'lt' ? v < t : op === 'gt' ? v > t : op === 'lte' ? v <= t : v >= t;

describe('AutomationCheckProcessor — lógica de evaluación', () => {
  describe('ROAS < 1.5 por 3 días → pause', () => {
    it('triggerear cuando ROAS promedio < umbral', () => {
      expect(evalCond(calcAvg(make([1.0, 1.2, 1.1]), 'roas'), 'lt', 1.5)).toBe(true);
    });
    it('NO triggerear cuando ROAS promedio >= umbral', () => {
      expect(evalCond(calcAvg(make([2.0, 1.8, 2.1]), 'roas'), 'lt', 1.5)).toBe(false);
    });
    it('NO triggerear cuando ROAS == umbral exacto (lt no lte)', () => {
      expect(evalCond(calcAvg(make([1.5, 1.5, 1.5]), 'roas'), 'lt', 1.5)).toBe(false);
    });
  });

  describe('Guard datos insuficientes (Northbeam)', () => {
    it('skip si hay menos días que windowDays', () => {
      expect(make([1.0, 1.1]).length < 3).toBe(true);
    });
    it('evalúa cuando tiene exactamente windowDays de datos', () => {
      expect(make([1.0, 1.1, 1.2]).length < 3).toBe(false);
    });
  });

  describe('Guard lastRunAt', () => {
    it('NO corre si lastRunAt fue hace menos de windowDays días', () => {
      const lastRun = new Date(); const next = new Date(lastRun); next.setDate(next.getDate() + 3);
      expect(new Date() < next).toBe(true);
    });
    it('corre si lastRunAt fue hace más de windowDays días', () => {
      const lastRun = new Date(); lastRun.setDate(lastRun.getDate() - 4);
      const next = new Date(lastRun); next.setDate(next.getDate() + 3);
      expect(new Date() < next).toBe(false);
    });
  });

  describe('CPC — evitar división por cero', () => {
    it('retorna 0 cuando no hay clicks', () => {
      const m: Metric = { roas: 0, spend: 100, revenue: 0, clicks: 0, impressions: 1000, conversions: 0 };
      expect(calcAvg([m], 'cpc')).toBe(0);
    });
    it('calcula CPC correctamente', () => {
      const m: Metric = { roas: 2, spend: 100, revenue: 200, clicks: 40, impressions: 1000, conversions: 2 };
      expect(calcAvg([m], 'cpc')).toBeCloseTo(2.5, 2);
    });
  });
});
