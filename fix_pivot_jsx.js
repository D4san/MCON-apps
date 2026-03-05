const fs = require('fs');
const path = './src/apps/HydrostaticPressure/HydrostaticPressure.tsx';
let txt = fs.readFileSync(path, 'utf8');

const strToReplace = \                    {pivotConfig.enabled && (
                        <div className="mt-3 border-t border-cyan-500/20 pt-2 space-y-1">
                            <div className="flex justify-between text-[11px] text-cyan-100">
                                <span>Angulo pivote</span>
                                <span className="font-mono">{((pivotRuntime.angle * 180) / Math.PI).toFixed(1)} deg</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-cyan-200/80">
                                <span>Torque</span>
                                <span className="font-mono">{(pivotRuntime.torque / 1000).toFixed(2)} kN m</span>
                            </div>
                        </div>
                    )}\;
txt = txt.replace(strToReplace, '');

fs.writeFileSync(path, txt);
