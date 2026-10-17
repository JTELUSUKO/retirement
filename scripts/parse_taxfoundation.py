# Parse the TablePress table(s) in the Tax Foundation page into rows of cell text.
import html, json, re, sys
src = open(sys.argv[1], encoding='utf-8').read()
tables = re.findall(r'<table[^>]*>(.*?)</table>', src, re.S)
out = []
for t in tables:
    rows = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S):
        cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', tr, re.S)]
        rows.append(cells)
    out.append(rows)
json.dump(out, open(sys.argv[2], 'w'), indent=0)
print([len(t) for t in out])
