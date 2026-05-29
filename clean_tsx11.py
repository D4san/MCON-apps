import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
text = re.sub(r'\{isDiag \? .*?</span', '{isDiag ? \"\u03c3_\" + key : \"\u03c4_\" + key}</span', text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
