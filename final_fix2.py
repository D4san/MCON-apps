import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if '<input type="range"' in line and 'min="-180"' in line and 'rotation[axis]' in line:
        new_lines.append('                    <input type="range" min="-180" max="180" step="1" value={rotation[axis]} onChange={(e) => setRotation({...rotation, [axis]: parseFloat(e.target.value)})} className={"flex-1 accent-" + color + "-500"} />\n')
        # skip next line if it contains the garbage
        if i+1 < len(lines) and '-500"} />' in lines[i+1]:
            lines[i+1] = '' # Clear it
    else:
        new_lines.append(line)

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.writelines(new_lines)
