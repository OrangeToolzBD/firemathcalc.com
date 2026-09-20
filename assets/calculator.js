/* calculator.js — firemathcalc.com
 * Tools: fire · coastFire · compound · dividend · inflation · investment · retirement · k401 · rothIra ·
 *        savings · annuity · netWorth · cagr · roi · rule72 · drip
 *
 * DATA (all fetched 2026-09-16, nothing typed from memory):
 *   · assets/cpi-data.js (window.CPIDATA) — BLS CPI-U, U.S. city average, all items, NSA (CUUR0000SA0),
 *     annual averages 1913–2025 + the latest 2026 months, from download.bls.gov.
 *   · 2026 contribution limits — IRS newsroom "401(k) limit increases to $24,500 for 2026, IRA limit increases to
 *     $7,500": 401(k) $24,500; catch-up 50+ $8,000; ages 60–63 $11,250; IRA $7,500; IRA catch-up $1,100;
 *     Roth phase-out $153,000–$168,000 single/HoH, $242,000–$252,000 joint, $0–$10,000 married filing separately.
 *     Update LIMITS every November when the IRS announces the next year.
 *
 * NO MARKET FIGURES ARE CLAIMED. The withdrawal rate (default 4%) and the real return (default 5%) are the
 * user's assumptions, labelled as such on the page. Content that discusses the "4% rule" must cite the original
 * research by name and date (Bengen, Journal of Financial Planning, 1994; the Trinity study, 1998) after a
 * writer has opened and read the source — VERIFY_BEFORE_PUBLISHING in the content, not in this file.
 * All maths is deterministic; "real return" means after inflation, so outputs are in today's dollars.
 * Not investment advice — the page says so above the tool.
 */
(function (root, factory) {
  const C = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = C; else root.CALCS = C;
})(typeof self !== 'undefined' ? self : this, function (root) {
  const r2 = n => Math.round(n * 100) / 100;
  let CPI = root && root.CPIDATA;
  const LIMITS = { year: 2026, k401: 24500, catchUp50: 8000, catchUp60to63: 11250, ira: 7500, iraCatchUp50: 1100,
    rothPhaseout: { single: [153000, 168000], mfj: [242000, 252000], mfs: [0, 10000] },
    source: 'IRS newsroom, 401(k) limit increases to $24,500 for 2026, IRA limit increases to $7,500' };

  /** Years until balance ≥ target with a yearly contribution added at year end; interpolated inside the crossing year. */
  function yearsToFi(balance, contribution, ratePct, target, cap = 100) {
    const r = ratePct / 100;
    if (balance >= target) return 0;
    for (let t = 0; t < cap; t++) {
      const next = balance * (1 + r) + contribution;
      if (next >= target) return t + (target - balance) / (next - balance);
      if (next <= balance) return null;                       // not growing: never reaches target
      balance = next;
    }
    return null;
  }
  const futureValue = (principal, monthly, ratePct, years) => {
    const i = ratePct / 100 / 12, n = Math.round(years * 12);
    if (i === 0) return principal + monthly * n;
    return principal * Math.pow(1 + i, n) + monthly * (Math.pow(1 + i, n) - 1) / i;
  };

  const assumptionInputs = [
    { id: 'withdrawal', label: 'Withdrawal rate (your assumption)', type: 'number', suffix: '%', default: 4, min: 1, max: 10, step: 0.1, help: 'The share of your portfolio you plan to spend each year in retirement.' },
    { id: 'realReturn', label: 'Yearly return after inflation (your assumption)', type: 'number', suffix: '%', default: 5, min: -2, max: 12, step: 0.1 },
  ];

  const fire = {
    title: 'FIRE calculator',
    inputs: [
      { id: 'spending', label: 'Yearly spending in retirement', type: 'number', prefix: '$', default: 40000, min: 0 },
      { id: 'savings', label: 'Invested today', type: 'number', prefix: '$', default: 100000, min: 0 },
      { id: 'contribution', label: 'You invest per year', type: 'number', prefix: '$', default: 30000, min: 0 },
      { id: 'age', label: 'Your age', type: 'number', default: 32, min: 16, max: 90 },
      ...assumptionInputs,
    ],
    compute(v, fmt) {
      const target = v.withdrawal > 0 ? (v.spending || 0) / (v.withdrawal / 100) : NaN;
      const years = yearsToFi(v.savings || 0, v.contribution || 0, v.realReturn || 0, target);
      return {
        raw: { target: r2(target), years: years === null ? null : r2(years) },
        warnings: years === null ? ['At these inputs the portfolio never reaches the target within 100 years.'] : [],
        summary: [
          { label: 'Your FIRE number', value: fmt.money0(target), strong: true },
          { label: 'Years to financial independence', value: years === null ? 'Not reached' : `${r2(years).toFixed(1)} years` },
          { label: 'Age at FI', value: years === null ? '—' : `${Math.floor((v.age || 0) + years)}` },
        ],
        notes: [`FIRE number = yearly spending ÷ withdrawal rate = ${fmt.money0(v.spending || 0)} ÷ ${v.withdrawal}%.`,
          'Figures are in today’s dollars because the return is after inflation. Taxes and fees are not included. Not investment advice.'],
      };
    },
  };

  const coastFire = {
    title: 'Coast FIRE calculator',
    inputs: [
      { id: 'age', label: 'Your age', type: 'number', default: 30, min: 16, max: 80 },
      { id: 'retireAge', label: 'Age you want to retire', type: 'number', default: 60, min: 30, max: 90 },
      { id: 'spending', label: 'Yearly spending in retirement', type: 'number', prefix: '$', default: 40000, min: 0 },
      { id: 'savings', label: 'Invested today', type: 'number', prefix: '$', default: 150000, min: 0 },
      ...assumptionInputs,
    ],
    compute(v, fmt) {
      const years = Math.max(0, (v.retireAge || 0) - (v.age || 0));
      const target = (v.spending || 0) / (v.withdrawal / 100);
      const coast = target / Math.pow(1 + (v.realReturn || 0) / 100, years);
      const reached = (v.savings || 0) >= coast;
      return {
        raw: { target: r2(target), coast: r2(coast), reached },
        summary: [
          { label: 'Your Coast FIRE number today', value: fmt.money0(coast), strong: true },
          { label: reached ? 'You have reached Coast FIRE' : 'Still to invest', value: reached ? `+${fmt.money0((v.savings || 0) - coast)} ahead` : fmt.money0(coast - (v.savings || 0)) },
          { label: `FIRE number at ${v.retireAge}`, value: fmt.money0(target) },
        ],
        notes: ['Coast FIRE = the amount that, left to grow with no more contributions, reaches your FIRE number by your retirement age.', 'Not investment advice.'],
      };
    },
  };

  const compound = {
    title: 'Compound interest calculator',
    inputs: [
      { id: 'principal', label: 'Starting amount', type: 'number', prefix: '$', default: 10000, min: 0 },
      { id: 'monthly', label: 'Monthly contribution', type: 'number', prefix: '$', default: 500, min: 0 },
      { id: 'rate', label: 'Yearly return (your assumption)', type: 'number', suffix: '%', default: 7, min: -5, max: 30, step: 0.1 },
      { id: 'years', label: 'Years', type: 'number', default: 10, min: 1, max: 60 },
    ],
    compute(v, fmt) {
      const fv = futureValue(v.principal || 0, v.monthly || 0, v.rate || 0, v.years || 0);
      const contributed = (v.principal || 0) + (v.monthly || 0) * Math.round((v.years || 0) * 12);
      const rows = [];
      for (let y = 1; y <= (v.years || 0); y++) rows.push({ label: `Year ${y}`, value: fmt.money0(futureValue(v.principal || 0, v.monthly || 0, v.rate || 0, y)) });
      return {
        raw: { fv: r2(fv), contributed, growth: r2(fv - contributed) },
        summary: [
          { label: 'Future value', value: fmt.money0(fv), strong: true },
          { label: 'You contribute', value: fmt.money0(contributed) },
          { label: 'Growth', value: fmt.money0(fv - contributed) },
        ],
        rows,
        notes: ['Compounded monthly; contributions at the end of each month. Not investment advice.'],
      };
    },
  };

  const dividend = {
    title: 'Dividend calculator',
    inputs: [
      { id: 'portfolio', label: 'Portfolio value', type: 'number', prefix: '$', default: 500000, min: 0 },
      { id: 'yieldPct', label: 'Dividend yield', type: 'number', suffix: '%', default: 3.5, min: 0, max: 20, step: 0.01 },
      { id: 'growthPct', label: 'Yearly dividend growth (your assumption)', type: 'number', suffix: '%', default: 5, min: -10, max: 20, step: 0.1 },
      { id: 'years', label: 'Years ahead', type: 'number', default: 10, min: 0, max: 50 },
    ],
    compute(v, fmt) {
      const now = (v.portfolio || 0) * (v.yieldPct || 0) / 100;
      const later = now * Math.pow(1 + (v.growthPct || 0) / 100, v.years || 0);
      return {
        raw: { now: r2(now), later: r2(later) },
        summary: [
          { label: 'Yearly dividend income now', value: fmt.money0(now), strong: true },
          { label: 'Per month', value: fmt.money0(now / 12) },
          { label: `Yearly income in ${v.years} years`, value: fmt.money0(later) },
        ],
        notes: ['Assumes dividends are paid out, not reinvested, and the portfolio value stays the same. Before tax. Not investment advice.'],
      };
    },
  };

  // ── inflation (BLS CPI-U) ────────────────────────────────────────────────
  const cpiYears = () => CPI ? Object.keys(CPI.annual).sort() : [];
  const cpiFor = y => {
    if (!CPI) return null;
    if (CPI.annual[y] != null) return { value: CPI.annual[y], label: `${y} annual average` };
    const L = CPI.latest_year_months;
    if (L && String(L.year) === String(y)) {
      const last = Object.keys(L.months).sort().pop();
      return { value: L.months[last], label: `${['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(last.slice(1))]} ${y} (latest month)` };
    }
    return null;
  };
  const yearOptions = () => {
    const ys = cpiYears();
    const L = CPI && CPI.latest_year_months;
    return (L ? [String(L.year), ...ys.slice().reverse()] : ys.slice().reverse()).map(y => ({ value: y, label: y }));
  };
  const inflation = {
    title: 'Inflation calculator',
    inputs: [
      { id: 'amount', label: 'Amount', type: 'number', prefix: '$', default: 100, min: 0 },
      { id: 'from', label: 'In year', type: 'select', default: '2000', options: yearOptions },
      { id: 'to', label: 'Is worth this much in', type: 'select', default: '2025', options: yearOptions },
    ],
    compute(v, fmt) {
      const a = cpiFor(v.from), b = cpiFor(v.to);
      if (!a || !b) return { warnings: ['CPI data for that year is not available.'] };
      const value = (v.amount || 0) * b.value / a.value;
      const years = Math.abs(Number(v.to) - Number(v.from));
      const cumulative = (b.value / a.value - 1) * 100;
      const annual = years ? (Math.pow(b.value / a.value, 1 / years) - 1) * 100 : 0;
      return {
        raw: { value: r2(value), cumulative: r2(cumulative), annual: Math.round(annual * 1000) / 1000 },
        summary: [
          { label: `${fmt.money(v.amount || 0)} in ${v.from} equals`, value: `${fmt.money(value)} in ${v.to}`, strong: true },
          { label: 'Cumulative price change', value: fmt.pct(cumulative) },
          { label: 'Average per year', value: `${annual.toFixed(2)}%` },
        ],
        rows: [{ label: `CPI-U, ${a.label}`, value: String(a.value) }, { label: `CPI-U, ${b.label}`, value: String(b.value) }],
        notes: [`Source: U.S. Bureau of Labor Statistics, CPI-U (all items, U.S. city average, not seasonally adjusted), fetched ${CPI.fetched}.`],
      };
    },
  };

  // ── investment growth ────────────────────────────────────────────────────
  const investment = {
    title: 'Investment calculator',
    inputs: [
      { id: 'initial', label: 'Starting amount', type: 'number', prefix: '$', default: 10000, min: 0 },
      { id: 'monthly', label: 'Monthly contribution', type: 'number', prefix: '$', default: 300, min: 0 },
      { id: 'rate', label: 'Yearly return (your assumption)', type: 'number', suffix: '%', default: 7, min: -10, max: 30, step: 0.1 },
      { id: 'years', label: 'Years invested', type: 'number', default: 20, min: 1, max: 70 },
      { id: 'inflation', label: 'Inflation to show today’s dollars (your assumption)', type: 'number', suffix: '%', default: 0, min: 0, max: 15, step: 0.1 },
    ],
    compute(v, fmt) {
      const fv = futureValue(v.initial || 0, v.monthly || 0, v.rate || 0, v.years || 0);
      const contributed = (v.initial || 0) + (v.monthly || 0) * Math.round((v.years || 0) * 12);
      const real = fv / Math.pow(1 + (v.inflation || 0) / 100, v.years || 0);
      return {
        raw: { fv: r2(fv), contributed, growth: r2(fv - contributed), real: r2(real) },
        summary: [
          { label: `Value after ${v.years} years`, value: fmt.money0(fv), strong: true },
          { label: 'Total you put in', value: fmt.money0(contributed) },
          { label: 'Investment growth', value: fmt.money0(fv - contributed) },
          ...(v.inflation ? [{ label: 'In today’s dollars', value: fmt.money0(real) }] : []),
        ],
        rows: Array.from({ length: Math.min(v.years || 0, 70) }, (_, k) => ({ label: `Year ${k + 1}`, value: fmt.money0(futureValue(v.initial || 0, v.monthly || 0, v.rate || 0, k + 1)) })),
        notes: ['Compounded monthly, contributions at month end, no taxes or fees. Returns are not guaranteed. Not investment advice.'],
      };
    },
  };

  // ── retirement ───────────────────────────────────────────────────────────
  const pvAnnuity = (payment, ratePct, years) => { const r = ratePct / 100; return r === 0 ? payment * years : payment * (1 - Math.pow(1 + r, -years)) / r; };
  const retirement = {
    title: 'Retirement calculator',
    inputs: [
      { id: 'age', label: 'Your age', type: 'number', default: 35, min: 16, max: 80 },
      { id: 'retireAge', label: 'Retirement age', type: 'number', default: 65, min: 30, max: 90 },
      { id: 'savings', label: 'Retirement savings today', type: 'number', prefix: '$', default: 50000, min: 0 },
      { id: 'monthly', label: 'You save per month', type: 'number', prefix: '$', default: 1000, min: 0 },
      { id: 'preReturn', label: 'Return before retirement (your assumption)', type: 'number', suffix: '%', default: 6, min: -5, max: 15, step: 0.1 },
      { id: 'spending', label: 'Yearly spending in retirement', type: 'number', prefix: '$', default: 60000, min: 0 },
      { id: 'otherIncome', label: 'Yearly Social Security, pension or other income', type: 'number', prefix: '$', default: 20000, min: 0, help: 'Your Social Security statement at ssa.gov shows your estimate.' },
      { id: 'years', label: 'Years in retirement', type: 'number', default: 25, min: 1, max: 50 },
      { id: 'postReturn', label: 'Return during retirement (your assumption)', type: 'number', suffix: '%', default: 4, min: -5, max: 12, step: 0.1 },
    ],
    compute(v, fmt) {
      const yrs = Math.max(0, (v.retireAge || 0) - (v.age || 0));
      const atRetirement = futureValue(v.savings || 0, v.monthly || 0, v.preReturn || 0, yrs);
      const gapPerYear = Math.max(0, (v.spending || 0) - (v.otherIncome || 0));
      const needed = pvAnnuity(gapPerYear, v.postReturn || 0, v.years || 0);
      const diff = atRetirement - needed;
      return {
        raw: { atRetirement: r2(atRetirement), needed: r2(needed), diff: r2(diff) },
        warnings: diff < 0 ? [`At these assumptions you would be about ${fmt.money0(-diff)} short.`] : [],
        summary: [
          { label: `Savings at ${v.retireAge}`, value: fmt.money0(atRetirement), strong: true },
          { label: 'Needed to fund retirement', value: fmt.money0(needed) },
          { label: diff >= 0 ? 'Surplus' : 'Shortfall', value: fmt.money0(Math.abs(diff)) },
        ],
        notes: ['Needed = the amount that pays (spending − other income) each year for your years in retirement at the return you chose, withdrawals at year end. Before taxes; not adjusted for inflation unless you use real returns. Not investment advice.'],
      };
    },
  };

  // ── 401(k) ───────────────────────────────────────────────────────────────
  const deferralLimit = age => LIMITS.k401 + (age >= 60 && age <= 63 ? LIMITS.catchUp60to63 : age >= 50 ? LIMITS.catchUp50 : 0);
  function k401Project({ age, retireAge, balance, salary, contribPct, matchPct, matchUpToPct, salaryGrowth, rate }) {
    let bal = balance, sal = salary, firstYear = null;
    for (let a = age; a < retireAge; a++) {
      const employee = Math.min(sal * contribPct / 100, deferralLimit(a));
      const match = sal * Math.min(contribPct, matchUpToPct) / 100 * matchPct / 100;
      if (!firstYear) firstYear = { employee, match, limit: deferralLimit(a) };
      bal = bal * (1 + rate / 100) + employee + match;
      sal *= 1 + salaryGrowth / 100;
    }
    return { balance: bal, firstYear: firstYear || { employee: 0, match: 0, limit: deferralLimit(age) } };
  }
  const k401 = {
    title: '401(k) calculator',
    inputs: [
      { id: 'age', label: 'Your age', type: 'number', default: 40, min: 16, max: 80 },
      { id: 'retireAge', label: 'Retirement age', type: 'number', default: 65, min: 30, max: 90 },
      { id: 'balance', label: 'Current 401(k) balance', type: 'number', prefix: '$', default: 50000, min: 0 },
      { id: 'salary', label: 'Yearly salary', type: 'number', prefix: '$', default: 80000, min: 0 },
      { id: 'contribPct', label: 'You contribute', type: 'number', suffix: '% of pay', default: 10, min: 0, max: 100, step: 0.5 },
      { id: 'matchPct', label: 'Employer matches', type: 'number', suffix: '% of your contribution', default: 50, min: 0, max: 200 },
      { id: 'matchUpToPct', label: '…up to', type: 'number', suffix: '% of pay', default: 6, min: 0, max: 100, step: 0.5 },
      { id: 'salaryGrowth', label: 'Yearly raise (your assumption)', type: 'number', suffix: '%', default: 0, min: 0, max: 15, step: 0.1 },
      { id: 'rate', label: 'Yearly return (your assumption)', type: 'number', suffix: '%', default: 6, min: -5, max: 15, step: 0.1 },
    ],
    compute(v, fmt) {
      const p = k401Project(v);
      const w = [];
      if ((v.salary || 0) * (v.contribPct || 0) / 100 > p.firstYear.limit) w.push(`Your contribution is capped at the ${LIMITS.year} limit of ${fmt.money0(p.firstYear.limit)} for your age.`);
      return {
        raw: { balance: r2(p.balance), employee: r2(p.firstYear.employee), match: r2(p.firstYear.match), limit: p.firstYear.limit },
        warnings: w,
        summary: [
          { label: `Balance at ${v.retireAge}`, value: fmt.money0(p.balance), strong: true },
          { label: 'You contribute this year', value: fmt.money0(p.firstYear.employee) },
          { label: 'Employer match this year', value: fmt.money0(p.firstYear.match) },
          { label: `${LIMITS.year} limit at your age`, value: fmt.money0(p.firstYear.limit) },
        ],
        notes: [`Limits from the IRS for ${LIMITS.year}: ${fmt.money0(LIMITS.k401)}, plus ${fmt.money0(LIMITS.catchUp50)} catch-up at 50+ or ${fmt.money0(LIMITS.catchUp60to63)} at ages 60–63. Future years are held at ${LIMITS.year} limits. Contributions added at year end; before taxes and fees. Not investment advice.`],
      };
    },
  };

  // ── Roth IRA ─────────────────────────────────────────────────────────────
  function rothAllowed(age, magi, status) {
    const limit = LIMITS.ira + (age >= 50 ? LIMITS.iraCatchUp50 : 0);
    const [lo, hi] = LIMITS.rothPhaseout[status] || LIMITS.rothPhaseout.single;
    if (magi < lo) return { limit, allowed: limit, zone: 'full' };
    if (magi >= hi) return { limit, allowed: 0, zone: 'none' };
    return { limit, allowed: limit * (hi - magi) / (hi - lo), zone: 'partial' };
  }
  const rothIra = {
    title: 'Roth IRA calculator',
    inputs: [
      { id: 'age', label: 'Your age', type: 'number', default: 30, min: 16, max: 90 },
      { id: 'retireAge', label: 'Age you plan to withdraw', type: 'number', default: 65, min: 40, max: 95 },
      { id: 'balance', label: 'Current Roth IRA balance', type: 'number', prefix: '$', default: 10000, min: 0 },
      { id: 'contribution', label: 'You plan to contribute each year', type: 'number', prefix: '$', default: 7500, min: 0 },
      { id: 'status', label: 'Filing status', type: 'select', default: 'single', options: [{ value: 'single', label: 'Single / head of household' }, { value: 'mfj', label: 'Married filing jointly' }, { value: 'mfs', label: 'Married filing separately' }] },
      { id: 'magi', label: 'Modified AGI', type: 'number', prefix: '$', default: 90000, min: 0 },
      { id: 'rate', label: 'Yearly return (your assumption)', type: 'number', suffix: '%', default: 6, min: -5, max: 15, step: 0.1 },
    ],
    compute(v, fmt) {
      const a = rothAllowed(v.age || 0, v.magi || 0, v.status);
      const contrib = Math.min(v.contribution || 0, a.allowed);
      const yrs = Math.max(0, (v.retireAge || 0) - (v.age || 0));
      let bal = v.balance || 0;
      for (let k = 0; k < yrs; k++) bal = bal * (1 + (v.rate || 0) / 100) + contrib;
      const w = [];
      if (a.zone === 'partial') w.push('Your income is inside the Roth IRA phase-out range, so only part of the limit is allowed. The figure shown is a straight-line estimate; confirm the exact amount with the IRS worksheet in Publication 590-A.');
      if (a.zone === 'none') w.push('Your income is above the Roth IRA limit for your filing status, so direct Roth contributions are not allowed.');
      if ((v.contribution || 0) > a.allowed) w.push(`Contributions are capped at ${fmt.money0(a.allowed)} for ${LIMITS.year}.`);
      return {
        raw: { limit: a.limit, allowed: r2(a.allowed), zone: a.zone, balance: r2(bal), contributed: r2(contrib * yrs + (v.balance || 0)) },
        warnings: w,
        summary: [
          { label: `Tax-free balance at ${v.retireAge}`, value: fmt.money0(bal), strong: true },
          { label: `Your ${LIMITS.year} contribution limit`, value: fmt.money0(a.allowed) },
          { label: 'Total contributed', value: fmt.money0(contrib * yrs + (v.balance || 0)) },
        ],
        notes: [`IRS ${LIMITS.year}: ${fmt.money0(LIMITS.ira)} limit, ${fmt.money0(LIMITS.iraCatchUp50)} extra at 50+. Contributions added at year end; qualified withdrawals are tax-free under IRS rules. Not tax or investment advice.`],
      };
    },
  };

  // ── savings interest (APY) ───────────────────────────────────────────────
  const savings = {
    title: 'Savings interest calculator',
    inputs: [
      { id: 'deposit', label: 'Starting deposit', type: 'number', prefix: '$', default: 5000, min: 0 },
      { id: 'monthly', label: 'Monthly deposit', type: 'number', prefix: '$', default: 200, min: 0 },
      { id: 'apy', label: 'APY (from your bank)', type: 'number', suffix: '%', default: 4.5, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Years', type: 'number', default: 5, min: 0.25, max: 50, step: 0.25 },
    ],
    compute(v, fmt) {
      const m = Math.pow(1 + (v.apy || 0) / 100, 1 / 12) - 1;
      const n = Math.round((v.years || 0) * 12);
      const fv = m === 0 ? (v.deposit || 0) + (v.monthly || 0) * n : (v.deposit || 0) * Math.pow(1 + m, n) + (v.monthly || 0) * (Math.pow(1 + m, n) - 1) / m;
      const interest = fv - (v.deposit || 0) - (v.monthly || 0) * n;
      return {
        raw: { fv: r2(fv), interest: r2(interest) },
        summary: [{ label: 'Balance', value: fmt.money(fv), strong: true }, { label: 'Interest earned', value: fmt.money(interest) }, { label: 'You deposit', value: fmt.money((v.deposit || 0) + (v.monthly || 0) * n) }],
        notes: ['APY already includes compounding; the monthly rate here is (1 + APY)^(1/12) − 1. Rates can change; interest is taxable. Not financial advice.'],
      };
    },
  };

  // ── annuity payout / accumulation ────────────────────────────────────────
  const annuity = {
    title: 'Annuity calculator',
    inputs: [
      { id: 'mode', label: 'Calculate', type: 'radio', default: 'payout', options: [{ value: 'payout', label: 'Payout from a lump sum' }, { value: 'grow', label: 'Value of regular payments' }] },
      { id: 'principal', label: 'Lump sum', type: 'number', prefix: '$', default: 300000, min: 0, showIf: s => s.mode !== 'grow' },
      { id: 'payment', label: 'Payment each period', type: 'number', prefix: '$', default: 500, min: 0, showIf: s => s.mode === 'grow' },
      { id: 'rate', label: 'Yearly rate (your assumption or the contract rate)', type: 'number', suffix: '%', default: 5, min: 0, max: 20, step: 0.01 },
      { id: 'years', label: 'Years', type: 'number', default: 20, min: 1, max: 60 },
      { id: 'freq', label: 'Payments per year', type: 'select', default: '12', options: [{ value: '12', label: 'Monthly' }, { value: '4', label: 'Quarterly' }, { value: '1', label: 'Yearly' }] },
    ],
    compute(v, fmt) {
      const f = Number(v.freq), r = (v.rate || 0) / 100 / f, n = (v.years || 0) * f;
      if (v.mode === 'grow') {
        const fv = r === 0 ? (v.payment || 0) * n : (v.payment || 0) * (Math.pow(1 + r, n) - 1) / r;
        return { raw: { fv: r2(fv) }, summary: [{ label: 'Future value', value: fmt.money0(fv), strong: true }, { label: 'You pay in', value: fmt.money0((v.payment || 0) * n) }] };
      }
      const pmt = r === 0 ? (v.principal || 0) / n : (v.principal || 0) * r / (1 - Math.pow(1 + r, -n));
      return {
        raw: { payment: r2(pmt), total: r2(pmt * n) },
        summary: [{ label: `Payout per ${f === 12 ? 'month' : f === 4 ? 'quarter' : 'year'}`, value: fmt.money(pmt), strong: true }, { label: 'Total paid out', value: fmt.money0(pmt * n) }],
        notes: ['Fixed-period annuity, payments at the end of each period, before taxes and fees. A real contract’s payout depends on the insurer’s terms and, for lifetime annuities, your age. Not financial advice.'],
      };
    },
  };

  // ── net worth ────────────────────────────────────────────────────────────
  const netWorth = {
    title: 'Net worth calculator',
    inputs: [
      { id: 'assets', label: 'What you own', type: 'repeater', addLabel: '+ Add asset', columns: [{ id: 'name', label: 'Asset' }, { id: 'value', label: 'Value $', type: 'number' }],
        default: [{ name: 'Checking and savings', value: 15000 }, { name: 'Retirement accounts', value: 85000 }, { name: 'Home value', value: 350000 }, { name: 'Car', value: 18000 }] },
      { id: 'debts', label: 'What you owe', type: 'repeater', addLabel: '+ Add debt', columns: [{ id: 'name', label: 'Debt' }, { id: 'value', label: 'Balance $', type: 'number' }],
        default: [{ name: 'Mortgage', value: 240000 }, { name: 'Car loan', value: 9000 }, { name: 'Credit cards', value: 3000 }] },
    ],
    compute(v, fmt) {
      const a = (v.assets || []).reduce((s, x) => s + (Number(x.value) || 0), 0);
      const d = (v.debts || []).reduce((s, x) => s + (Number(x.value) || 0), 0);
      return {
        raw: { assets: a, debts: d, netWorth: a - d, ratio: d ? r2(a / d) : null },
        summary: [{ label: 'Net worth', value: fmt.money0(a - d), strong: true }, { label: 'Total assets', value: fmt.money0(a) }, { label: 'Total debts', value: fmt.money0(d) }],
      };
    },
  };

  // ── CAGR, ROI, rule of 72 ────────────────────────────────────────────────
  const cagr = {
    title: 'CAGR calculator',
    inputs: [
      { id: 'begin', label: 'Starting value', type: 'number', prefix: '$', default: 10000, min: 0 },
      { id: 'end', label: 'Ending value', type: 'number', prefix: '$', default: 25000, min: 0 },
      { id: 'years', label: 'Years', type: 'number', default: 7, min: 0.1, step: 0.1 },
    ],
    compute(v, fmt) {
      const ok = v.begin > 0 && v.years > 0;
      const g = ok ? (Math.pow((v.end || 0) / v.begin, 1 / v.years) - 1) * 100 : NaN;
      return { raw: { cagr: Math.round(g * 1000) / 1000 }, warnings: ok ? [] : ['Enter a starting value and years above zero.'],
        summary: [{ label: 'Compound annual growth rate', value: `${g.toFixed(2)}%`, strong: true }, { label: 'Total change', value: fmt.pct(((v.end || 0) / (v.begin || 1) - 1) * 100) }],
        notes: ['CAGR = (ending ÷ starting)^(1 ÷ years) − 1. It smooths the path: the real year-to-year returns varied.'] };
    },
  };
  const roi = {
    title: 'ROI calculator',
    inputs: [
      { id: 'cost', label: 'Amount invested', type: 'number', prefix: '$', default: 5000, min: 0 },
      { id: 'value', label: 'Amount returned (value now plus income received)', type: 'number', prefix: '$', default: 7500, min: 0 },
      { id: 'years', label: 'Years held (for annualized ROI)', type: 'number', default: 3, min: 0, step: 0.1 },
    ],
    compute(v, fmt) {
      const roiPct = v.cost ? ((v.value || 0) - v.cost) / v.cost * 100 : NaN;
      const ann = v.cost && v.years > 0 ? (Math.pow((v.value || 0) / v.cost, 1 / v.years) - 1) * 100 : NaN;
      return { raw: { roi: r2(roiPct), annualized: Math.round(ann * 1000) / 1000, gain: (v.value || 0) - (v.cost || 0) },
        summary: [{ label: 'ROI', value: fmt.pct(roiPct), strong: true }, { label: 'Annualized ROI', value: isNaN(ann) ? '—' : `${ann.toFixed(2)}%` }, { label: 'Gain', value: fmt.money((v.value || 0) - (v.cost || 0)) }] };
    },
  };
  const rule72 = {
    title: 'Rule of 72 calculator',
    inputs: [{ id: 'rate', label: 'Yearly return or interest rate', type: 'number', suffix: '%', default: 8, min: 0.1, max: 100, step: 0.1 }],
    compute(v) {
      const est = 72 / (v.rate || 1);
      const exact = Math.log(2) / Math.log(1 + (v.rate || 0) / 100);
      return { raw: { estimate: r2(est), exact: r2(exact) },
        summary: [{ label: 'Years to double (rule of 72)', value: est.toFixed(1), strong: true }, { label: 'Exact years to double', value: exact.toFixed(2) }],
        notes: ['Rule of 72: years ≈ 72 ÷ rate. Exact: ln 2 ÷ ln(1 + rate). The shortcut is closest for rates around 8%.'] };
    },
  };

  // ── dividend reinvestment ────────────────────────────────────────────────
  function drip({ shares, price, yieldPct, divGrowth, priceGrowth, years, reinvest }) {
    let sh = shares, p = price, y = yieldPct / 100, income = 0;
    const rows = [];
    for (let k = 1; k <= years; k++) {
      const div = sh * p * y;
      income += div;
      p *= 1 + priceGrowth / 100;
      if (reinvest) sh += div / p;
      y = y * (1 + divGrowth / 100) / (1 + priceGrowth / 100);   // dividend per share grows at divGrowth; yield moves with price
      rows.push({ k, sh, value: sh * p, div });
    }
    return { shares: sh, value: sh * p, income, rows };
  }
  const dripCalc = {
    title: 'Dividend reinvestment calculator',
    inputs: [
      { id: 'shares', label: 'Shares owned', type: 'number', default: 100, min: 0 },
      { id: 'price', label: 'Share price', type: 'number', prefix: '$', default: 50, min: 0.01 },
      { id: 'yieldPct', label: 'Dividend yield', type: 'number', suffix: '%', default: 4, min: 0, max: 30, step: 0.01 },
      { id: 'divGrowth', label: 'Yearly dividend growth (your assumption)', type: 'number', suffix: '%', default: 0, min: -20, max: 30, step: 0.1 },
      { id: 'priceGrowth', label: 'Yearly share price growth (your assumption)', type: 'number', suffix: '%', default: 0, min: -30, max: 30, step: 0.1 },
      { id: 'years', label: 'Years', type: 'number', default: 10, min: 1, max: 50 },
      { id: 'reinvest', label: 'Reinvest dividends', type: 'checkbox', default: true },
    ],
    compute(v, fmt) {
      const d = drip(v);
      return {
        raw: { shares: Math.round(d.shares * 10000) / 10000, value: r2(d.value), income: r2(d.income) },
        summary: [{ label: `Value after ${v.years} years`, value: fmt.money0(d.value), strong: true }, { label: 'Shares owned', value: d.shares.toFixed(2) }, { label: 'Dividends received', value: fmt.money0(d.income) }],
        rows: d.rows.map(r => ({ label: `Year ${r.k}`, value: `${r.sh.toFixed(2)} shares · ${fmt.money0(r.value)}` })),
        notes: ['Dividends paid and reinvested once a year at the year-end price; before taxes. Not investment advice.'],
      };
    },
  };

  return {
    fire, coastFire, compound, dividend, inflation, investment, retirement, k401, rothIra, savings, annuity, netWorth, cagr, roi, rule72, drip: dripCalc,
    __setData: d => { CPI = d; },
    __testData: { fetched: 'fixture', annual: { 2000: 172.2, 2025: 321.943 }, latest_year_months: { year: 2026, months: { M01: 330.0, M08: 334.98 } } },
    __pure: { yearsToFi, futureValue, k401Project, rothAllowed, drip },
    __tests: [
      // Expected values computed independently in build/tests/investing_expected.py.
      { calc: 'fire', name: '$40k spend at 4% → $1,000,000; $100k + $30k/yr at 5% → 16.94 years',
        input: { spending: 40000, savings: 100000, contribution: 30000, age: 32, withdrawal: 4, realReturn: 5 }, expect: { target: 1000000, years: 16.94 } },
      { calc: 'fire', name: '$50k spend at 4% from zero, $20k/yr at 7% → 24.85 years',
        input: { spending: 50000, savings: 0, contribution: 20000, age: 25, withdrawal: 4, realReturn: 7 }, expect: { target: 1250000, years: 24.85 } },
      { calc: 'fire', name: 'no growth and no contribution never reaches the target',
        input: { spending: 40000, savings: 1000, contribution: 0, age: 30, withdrawal: 4, realReturn: 0 }, expect: { years: null } },
      { calc: 'coastFire', name: '$1M target, 30 years at 5% → $231,377.45',
        input: { age: 30, retireAge: 60, spending: 40000, savings: 150000, withdrawal: 4, realReturn: 5 }, expect: { target: 1000000, coast: 231377.45, reached: false } },
      { calc: 'compound', name: '$10k + $500/mo at 7% for 10 years → $106,639.02',
        input: { principal: 10000, monthly: 500, rate: 7, years: 10 }, expect: { fv: 106639.02, contributed: 70000 } },
      { calc: 'dividend', name: '$500k at 3.5% → $17,500; +5%/yr for 10 years → $28,505.66',
        input: { portfolio: 500000, yieldPct: 3.5, growthPct: 5, years: 10 }, expect: { now: 17500, later: 28505.66 } },
      // Expected values below: build/tests/investing2_expected.py (independent arithmetic, real CPI values)
      { calc: 'inflation', name: '$100 in 2000 → $186.96 in 2025 (CPI 172.2 → 321.943)', input: { amount: 100, from: '2000', to: '2025' }, expect: { value: 186.96, cumulative: 86.96, annual: 2.534 } },
      { calc: 'inflation', name: 'latest partial year uses the latest month', input: { amount: 100, from: '2025', to: '2026' }, expect: { value: 104.05 } },
      { calc: 'investment', name: '$10k + $300/mo at 7% for 20 years → $196,665.39', input: { initial: 10000, monthly: 300, rate: 7, years: 20, inflation: 0 }, expect: { fv: 196665.39, contributed: 82000 } },
      { calc: 'retirement', name: '35→65, $50k + $1k/mo at 6%; $40k/yr gap for 25 yrs at 4%', input: { age: 35, retireAge: 65, savings: 50000, monthly: 1000, preReturn: 6, spending: 60000, otherIncome: 20000, years: 25, postReturn: 4 },
        expect: { atRetirement: 1305643.8, needed: 624883.2, diff: 680760.61 } },
      { calc: 'k401', name: '$80k, 10%, 50% match up to 6%, 40→65 at 6% from $50k → $785,184.46', input: { age: 40, retireAge: 65, balance: 50000, salary: 80000, contribPct: 10, matchPct: 50, matchUpToPct: 6, salaryGrowth: 0, rate: 6 },
        expect: { balance: 785184.46, employee: 8000, match: 2400, limit: 24500 } },
      { calc: 'k401', name: 'contribution capped at the 2026 limit', input: { age: 45, retireAge: 46, balance: 0, salary: 300000, contribPct: 15, matchPct: 0, matchUpToPct: 0, salaryGrowth: 0, rate: 0 }, expect: { employee: 24500 } },
      { calc: 'k401', name: 'age 61 gets the $11,250 catch-up', input: { age: 61, retireAge: 62, balance: 0, salary: 500000, contribPct: 50, matchPct: 0, matchUpToPct: 0, salaryGrowth: 0, rate: 0 }, expect: { limit: 35750, employee: 35750 } },
      { pure: 'rothAllowed', name: 'Roth: under / inside / above the 2026 single phase-out', run: P => ({ a: P.rothAllowed(30, 100000, 'single').zone, b: Math.round(P.rothAllowed(30, 160500, 'single').allowed), c: P.rothAllowed(30, 170000, 'single').allowed, d: P.rothAllowed(55, 50000, 'single').limit }),
        expect: { a: 'full', b: 3750, c: 0, d: 8600 } },
      { calc: 'savings', name: '$5,000 + $200/mo at 4.5% APY for 5 years → $19,629.26', input: { deposit: 5000, monthly: 200, apy: 4.5, years: 5 }, expect: { fv: 19629.26, interest: 2629.26 } },
      { calc: 'annuity', name: '$300k at 5% over 20 years → $1,979.87/month', input: { mode: 'payout', principal: 300000, rate: 5, years: 20, freq: '12' }, expect: { payment: 1979.87, total: 475168.13 } },
      { calc: 'netWorth', name: 'default household → $216,000', input: {}, expect: { assets: 468000, debts: 252000, netWorth: 216000 } },
      { calc: 'cagr', name: '$10k → $25k in 7 years → 13.985%', input: { begin: 10000, end: 25000, years: 7 }, expect: { cagr: 13.985 } },
      { calc: 'roi', name: '$5k → $7.5k in 3 years → 50%, 14.471%/yr', input: { cost: 5000, value: 7500, years: 3 }, expect: { roi: 50, annualized: 14.471 } },
      { calc: 'rule72', name: '8% → 9 years (exact 9.01)', input: { rate: 8 }, expect: { estimate: 9, exact: 9.01 } },
      { calc: 'drip', name: '100 shares @ $50, 4% yield, reinvested 10 years → 148.0244 shares', input: { shares: 100, price: 50, yieldPct: 4, divGrowth: 0, priceGrowth: 0, years: 10, reinvest: true }, expect: { shares: 148.0244, value: 7401.22 } },
    ],
  };
});
