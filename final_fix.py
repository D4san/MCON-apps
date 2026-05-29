with open('src/apps/StressTensor/StressTensor.tsx', 'rb') as f:
    data = f.read()

idx = data.find(b'accent')
target = data[idx-20:idx+20]
print("Target to replace:", repr(target))

replacement = b"} className={lex-1 accent--500} />\n   "
# We must avoid powershell eating the dollar. Oh wait, I am in python now. But what about the here string.

data = data.replace(target, b"} className={\"flex-1 accent-\" + color + \"-500\"} />\n   ")

with open('src/apps/StressTensor/StressTensor.tsx', 'wb') as f:
    f.write(data)
