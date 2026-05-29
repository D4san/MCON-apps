import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
text = re.sub(r'className=\"flex-1 accent-\\-500\\} />', 'className={lex-1 accent-
import codecs

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

index = text.find('mt-2 p-3 bg-amber-950/20')
print(repr(text[index-200:index+50]))
{color}-500} />'.replace('
import codecs

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

index = text.find('mt-2 p-3 bg-amber-950/20')
print(repr(text[index-200:index+50]))
', '{'), text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
