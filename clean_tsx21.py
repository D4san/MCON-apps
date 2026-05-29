import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'rb') as f:
    data = f.read()

target = b'className={\\\x0clex-1 accent--500\\} />'
if target in data:
    print('Found target bytes')
    data = data.replace(target, b'className={lex-1 accent--500} />')
else:
    # try another variation
    target2 = b'className={\\\x0clex-1 accent--500}'
    if target2 in data:
        data = data.replace(target2, b'className={lex-1 accent--500}')

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'wb') as f:
    f.write(data)
