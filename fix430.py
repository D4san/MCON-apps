import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
# We just find the exact piece
idx = text.find('const isZero = Math.abs(val) < 0.1;')
if idx != -1:
    end_idx = text.find(');', idx) + 2
    part = text[idx:end_idx]
    
    new_part = '''const isZero = Math.abs(val) < 0.1;
                    return (
                      <div key={prime-} className={px-1 py-1 text-center text-xs font-mono rounded  bg-slate-900/80 border border-slate-800/80}>
                        {isZero ? '0' : val.toFixed(1)}
                      </div>
                    );'''
    
    text = text.replace(part, new_part)

    with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
        f.write(text)
    print("Replaced!")
else:
    print("Not found")
