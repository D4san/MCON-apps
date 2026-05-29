import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
# Oh god, wait, the text is "{isDiag ? σ_{{key} : : τ_{{key}</span>"
text = re.sub(r'\{isDiag \? .*?</span', '{isDiag ? σ_buildkeybuild : τ_buildkeybuild}</span'.replace('build', '{').replace('build', '}'), text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
