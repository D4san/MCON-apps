import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
text = re.sub(r'className=\{\\w-full bg-', 'className={w-full bg-', text)
text = re.sub(r'border \\ rounded', 'border  rounded'.replace('$', 'build').replace('{', '{{').replace('}', '}}'), text) 
# I do not want to use backticks because it uses $. No I must replace the end brace too.
# Let's read the section and replace it perfectly.
text = re.sub(r'className=\{\\w-full bg-slate-800 border \\ rounded px-1 py-1 text-center font-mono text-sm\s*.*\}', 'className=\"w-full bg-slate-800 border-slate-700 rounded px-1 py-1 text-center font-mono text-sm\"', text)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
