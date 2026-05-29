import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

text = text.replace('ration-300 \\}>\\n', 'ration-300\">\\n')
text = text.replace('duration-300 \\}>', 'duration-300\">')
text = text.replace('flex-shrink-0 transition-transform duration-300 \\}>', 'flex-shrink-0 transition-transform duration-300\">')

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
