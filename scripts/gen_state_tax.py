# Convert the parsed Tax Foundation 2026 table into a TypeScript config file, with sanity checks.
import json, re, sys
tables = json.load(open(sys.argv[1]))
rows = max(tables, key=len)[1:]
CODES = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','Washington DC':'DC'}
def money(s):
    s = s.strip()
    if not s or s.lower() in ('n.a.', 'none', ''): return ('amount', 0)
    credit = 'credit' in s.lower()
    m = re.search(r'\$?([\d,]+(?:\.\d+)?)', s)
    if not m: return ('amount', 0)
    v = float(m.group(1).replace(',', ''))
    return ('credit' if credit else 'amount', v)
def rate(s):
    m = re.match(r'([\d.]+)%', s.strip()); return float(m.group(1)) / 100 if m else None
states, current = {}, None
for r in rows:
    if len(r) < 12: continue
    name = re.sub(r'\s*\(.*\)$', '', r[0].lstrip('- ').strip())
    if name not in CODES: raise SystemExit(f'unknown state {name!r}')
    code = CODES[name]
    if not r[0].startswith('-'):
        current = states.setdefault(code, {'name': name, 'single': [], 'married': [], 'none': r[1].strip().lower() == 'none',
            'std': [money(r[7]), money(r[8])], 'ex': [money(r[9]), money(r[10])]})
    for col, key in ((1, 'single'), (4, 'married')):
        rt = rate(r[col])
        if rt is not None:
            current[key].append((money(r[col + 2])[1], rt))
# Washington taxes capital gains only (not modeled): treat as no income tax
states['WA']['none'] = True
taxed = {c: s for c, s in states.items() if not s['none']}
none = sorted(c for c, s in states.items() if s['none'])
assert len(states) == 51, len(states)
assert len(taxed) == 42, (len(taxed), sorted(taxed))  # 41 states + DC
for c, s in taxed.items():
    for k in ('single', 'married'):
        b = s[k]; assert b, (c, k)
        assert all(b[i][0] < b[i+1][0] for i in range(len(b)-1)), (c, k, b)
        assert all(0 <= rt < 0.15 for _, rt in b) and b[-1][1] > 0, (c, k, b)
# Retirement-income treatment (sources: Kiplinger / 401(k) Specialist, 2026) and Social Security taxation
TAXES_SS = {'CO','CT','MN','MT','NM','RI','UT','VT'}
EXEMPT_RETIREMENT = {'IL': 0, 'IA': 55, 'MS': 59, 'PA': 59}   # value = minimum age (approx.)
def fmt(v): return str(int(v)) if v == int(v) else str(v)
out = ['// Generated from the Tax Foundation table "State Individual Income Tax Rates and Brackets, 2026"',
       '// (taxfoundation.org/data/all/state/state-income-tax-rates-2026/). Do not edit by hand: regenerate.',
       '// Brackets: [threshold, rate] = rate applies to taxable income above threshold.',
       '// Deductions/exemptions are subtracted from income; "credit" amounts are subtracted from tax.', '',
       "export type FilingKey = 'single' | 'married'", '',
       'export interface StateTaxRule {',
       '  name: string',
       '  brackets: Record<FilingKey, [number, number][]>',
       '  standardDeduction: Record<FilingKey, number>',
       '  exemption: Record<FilingKey, number>',
       '  credit: Record<FilingKey, number>',
       '  /** Taxes (part of) Social Security benefits */',
       '  taxesSocialSecurity: boolean',
       '  /** Fully exempts retirement income (IRA/401k/pension) from this age; null = no full exemption */',
       '  exemptRetirementIncomeFromAge: number | null',
       '}', '',
       'export const NO_INCOME_TAX_STATES: Record<string, string> = { ' + ', '.join(c + ': ' + json.dumps(states[c]['name']) for c in none) + ' }', '',
       'export const STATE_TAX_2026: Record<string, StateTaxRule> = {']
for c in sorted(taxed):
    s = taxed[c]
    std = {k: (v if t == 'amount' else 0) for k, (t, v) in zip(('single','married'), s['std'])}
    ex = {k: (v if t == 'amount' else 0) for k, (t, v) in zip(('single','married'), s['ex'])}
    cr = {k: (v if t == 'credit' else 0) for k, (t, v) in zip(('single','married'), s['std'])}
    for k, (t, v) in zip(('single','married'), s['ex']):
        if t == 'credit': cr[k] += v
    br = lambda k: '[' + ', '.join(f'[{fmt(t)}, {fmt(round(r, 5))}]' for t, r in s[k]) + ']'
    out.append(f"  {c}: {{")
    out.append(f"    name: {json.dumps(s['name'])},")
    out.append(f"    brackets: {{ single: {br('single')}, married: {br('married')} }},")
    out.append(f"    standardDeduction: {{ single: {fmt(std['single'])}, married: {fmt(std['married'])} }},")
    out.append(f"    exemption: {{ single: {fmt(ex['single'])}, married: {fmt(ex['married'])} }},")
    out.append(f"    credit: {{ single: {fmt(cr['single'])}, married: {fmt(cr['married'])} }},")
    out.append(f"    taxesSocialSecurity: {'true' if c in TAXES_SS else 'false'},")
    out.append(f"    exemptRetirementIncomeFromAge: {EXEMPT_RETIREMENT.get(c, 'null')},")
    out.append('  },')
out.append('}')
open(sys.argv[2], 'w').write('\n'.join(out) + '\n')
print('taxed:', len(taxed), 'no-tax:', none)
for c in ['CA', 'NJ', 'UT', 'DE', 'OH', 'CT']:
    s = taxed[c]; print(c, s['single'][:3], '| married', s['married'][:3], '| std', s['std'], '| ex', s['ex'])
