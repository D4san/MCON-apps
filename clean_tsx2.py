import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
# The literal text has an actual form-feed char or something \x0C
text = text.replace('className={\\x0C', 'className=\"f')
text = text.replace('className={\\\x0C', 'className=\"f')
text = text.replace('className={\\f', 'className=\"f')
text = text.replace('className={\\ \nlex', 'className=\"flex')

text = re.sub(r'className=\{\\.*?lex', 'className=\"flex', text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
