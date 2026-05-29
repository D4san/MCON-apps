import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
# Check for literal 
text = re.sub(r'\{isDiag \? .*?</span', '{isDiag ? \\sigma_build{key} : \\tau_build{key}}</span'.replace('build', '{'), text)

# Just hardcode the text string
text = text.replace('{isDiag ? σ_{key{ : τ_{key{}</span>', '{isDiag ? \\u03C3_build{key} : \\u03C4_build{key}}</span'.replace('build', '{'))

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
