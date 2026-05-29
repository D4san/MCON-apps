import re

with open('src/apps/StressTensor/StressTensor.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('setIsMobileMenuOpen(false)}', '<button onClick={() => setIsMobileMenuOpen(false)}')
text = text.replace('applyPreset({ xx: 100 })}', '<button onClick={() => applyPreset({ xx: 100 })}')
text = text.replace('applyPreset({ yy: -120 })}', '<button onClick={() => applyPreset({ yy: -120 })}')
text = text.replace('applyPreset({ xx: -80, yy: -80, zz: -80 })}', '<button onClick={() => applyPreset({ xx: -80, yy: -80, zz: -80 })}')
text = text.replace('applyPreset({ xy: 60, yx: 60 })}', '<button onClick={() => applyPreset({ xy: 60, yx: 60 })}')
text = text.replace('applyPreset(DEFAULT_STRESS)}', '<button onClick={() => applyPreset(DEFAULT_STRESS)}')
text = text.replace('alignToPrincipal()} ', '<button onClick={alignToPrincipal} ')

with open('src/apps/StressTensor/StressTensor.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
