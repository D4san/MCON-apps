import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

text = text.replace('{isDiag ? σ_{{key} : τ_{{key}}', '{isDiag ? σ_build{key} : τ_build{key}}'.replace('build', '{'))

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
