import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

prefix = 'className={\x0clex-1'
if prefix in text:
    print('Found prefix')
    start = text.find(prefix)
    end = text.find('/>', start) + 2
    part = text[start:end]
    print('Replacing:', repr(part))
    text = text.replace(part, 'className={lex-1 accent--500} />')

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
