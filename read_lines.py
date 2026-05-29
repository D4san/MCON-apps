import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.readlines()

for i, line in enumerate(text[355:360]):
    print(f"{i+356}: {repr(line)}")
