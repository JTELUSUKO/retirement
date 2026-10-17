# Data scripts

## Regenerate state income tax data (each January)

1. Download the Tax Foundation table for the new year, e.g.
   `curl -sL -A "Mozilla/5.0" https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/ -o /tmp/taxfdn/page.html`
2. Parse the table: `python3 -I scripts/parse_taxfoundation.py /tmp/taxfdn/page.html /tmp/taxfdn/tables.json`
3. Generate: `python3 -I scripts/gen_state_tax.py /tmp/taxfdn/tables.json src/engine/config/stateTax2026.ts`
   (rename the output and the import for a new year).
4. Re-check `TAXES_SS` and `EXEMPT_RETIREMENT` in `gen_state_tax.py` against current sources, then run `npm test`.

The generator fails loudly if the table shape changes (state count, bracket order, rate range).
