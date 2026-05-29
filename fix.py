import re
with open('src/apps/StressTensor/StressTensor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'mainGroupRef\.current\.visible = viewMode === \'cube\';', '', text)
text = re.sub(r'ellipsoidMeshRef\.current\.visible = viewMode === \'ellipsoid\';', '', text)
text = re.sub(r'\{viewMode === \'cube\' && \(', '{(', text)
text = re.sub(r'\{viewMode === \'ellipsoid\' && \([\s\S]*?\}\)', '', text)
text = re.sub(r'\|\| viewMode !== \'cube\'', '', text)
text = re.sub(r'setViewMode\(\'cube\'\);', '', text)
text = re.sub(r'<div className=\"flex p-1 bg-slate-950 rounded-lg border border-slate-800\">[\s\S]*?<\/div>', '', text)
text = re.sub(r', viewMode', '', text)
text = re.sub(r' && viewMode === \'cube\'', '', text)
text = re.sub(r'<\/?button[^>]*>', '', text)
text = re.sub(r'onClick=\{\(\).*?\}', '', text)

with open('src/apps/StressTensor/StressTensor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
