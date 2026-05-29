import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
text = re.sub(r'\{isDiag \? .*?</span', '{isDiag ? \u03c3_buildbuild$ : \u03c4_buildbuild$}</span'.replace('build$', '{').replace('build$', '}'), text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
