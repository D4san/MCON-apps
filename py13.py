import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
text = re.sub(r'className=\{w-full bg-slate-', 'className=\"w-full bg-slate-', text)
text = re.sub(r'rounded px-1 py-1 text-center font-mono text-sm \\', 'rounded px-1 py-1 text-center font-mono text-sm\"', text)
text = re.sub(r'rounded px-1 py-1 text-center text-slate-200 outline-none focus:border-blue-500 transition-colors.*?\}', 'rounded px-1 py-1 text-center text-slate-200 outline-none focus:border-blue-500 transition-colors\"', text)
text = text.replace('className={w-full bg-slate-800 border  rounded px-1 py-1 text-center text-slate-200 outline-none focus:border-blue-500 transition-colors}', 'className=\"w-full bg-slate-800 border-slate-700 rounded px-1 py-1 text-center text-slate-200 outline-none focus:border-blue-500 transition-colors\"')

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
