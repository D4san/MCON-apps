
const fs = require("fs");
const code = fs.readFileSync("src/apps/ParallelAtmospheres/ParallelAtmospheres.tsx", "utf8");
let lines = code.split("\n");

const component = `
function CollapsibleSection({ title, icon, defaultOpen = true, children, extraCount = 0, sideAction }: { title: ReactNode, icon?: ReactNode, defaultOpen?: boolean, children: ReactNode, extraCount?: number, sideAction?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-inner transition-all duration-300">
      <div className="w-full flex justify-between items-center p-3 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-300 uppercase tracking-widest">
          {icon} <span className="drop-shadow-sm">{title}</span>
          {extraCount > 0 && <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md text-[9px] border border-indigo-500/30">{extraCount}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div onClick={e => e.stopPropagation()}>{sideAction}</div>
          <button className="text-slate-500 group-hover:text-white transition-colors">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className={cn("overflow-hidden transition-all duration-300", open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="p-3 pt-0 mt-1 mb-2">{children}</div>
      </div>
    </div>
  );
}
`;

const insertIndex = lines.findIndex(l => l.includes("export default function ParallelAtmospheres"));
if(insertIndex !== -1) {
  lines.splice(insertIndex, 0, component);
  fs.writeFileSync("src/apps/ParallelAtmospheres/ParallelAtmospheres.tsx", lines.join("\n"));
  console.log("Injected");
} else {
  console.log("Not found");
}

