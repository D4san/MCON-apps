import codecs
with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'r', 'utf-8') as f:
    text = f.read()

import re
idx1 = text.find('<label className="flex items-center gap-3')
idx2 = text.find('</label>', idx1) + 8

replacement = """<label className="flex items-center gap-3 cursor-pointer p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg hover:bg-indigo-900/40 transition-colors mt-4">
              <input type="checkbox" className="hidden" checked={showDeformation} onChange={(e) => setShowDeformation(e.target.checked)} />
              <div className={`relative w-10 h-6 transition-colors rounded-full ${showDeformation ? "bg-indigo-500" : "bg-slate-700"}`}>
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showDeformation ? "translate-x-4" : ""}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-indigo-100">Ver Deformación</span>
                <span className="text-[10px] text-indigo-300/70">Ilustrativo en sistema local</span>
              </div>
            </label>"""

text = text[:idx1] + replacement + text[idx2:]

with codecs.open('src/apps/StressTensor/StressTensor.tsx', 'w', 'utf-8') as f:
    f.write(text)
