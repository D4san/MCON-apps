import codecs
import re
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

text = re.sub(r'className=\{\x0clex-1 accent--500\\?\} />', 'className={lex-1 accent--500} />', text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
