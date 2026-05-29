import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

text = text.replace('\\σ_\\', '\"σ_\"')
text = text.replace('\\τ_\\', '\"τ_\"')
text = text.replace('{isDiag ? \"σ_\" : \"τ_\"}', '{isDiag ? σ_build{key} : τ_build{key}}'.replace('build', '{'))

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
