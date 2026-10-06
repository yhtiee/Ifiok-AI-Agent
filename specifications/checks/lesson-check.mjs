// Checks the example lesson in 05 §7 with the verification rules in 05 §6.
import { create, all } from 'mathjs';
import fs from 'node:fs';
const math = create(all);
const md = fs.readFileSync(process.argv[2], 'utf8');
const json = md.split('## 7.')[1].match(/```json\n([\s\S]*?)```/)[1];
const lesson = JSON.parse(json);
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function equivalent(a, b, vars) {
  const fa = math.compile(a), fb = math.compile(b); let valid = 0;
  for (let i = 0; i < 8; i++) {
    const scope = Object.fromEntries(vars.map(v => [v, rnd() * 10 - 5]));
    const x = fa.evaluate(scope), y = fb.evaluate(scope);
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) continue;
    valid++;
    if (Math.abs(x - y) > 1e-9 + 1e-6 * Math.max(Math.abs(x), Math.abs(y))) return false;
  }
  return valid >= 5 ? true : 'unknown';
}
const out = [];
for (const s of lesson.screens) for (const b of s.blocks) {
  if (b.type === 'stepper') {
    for (let i = 1; i < b.steps.length; i++)
      out.push([`${b.id} step ${i}->${i + 1}`, equivalent(b.steps[i - 1].mathjs, b.steps[i].mathjs, ['x', 'h'])]);
    // the derivative claim: limit h->0 of last step equals derivative of x^2
    const last = b.steps.at(-1).mathjs;
    out.push([`${b.id} limit h->0 equals d/dx x^2`, equivalent(math.parse(last).transform(n => n.isSymbolNode && n.name === 'h' ? new math.ConstantNode(0) : n).toString(), math.derivative('x^2', 'x').toString(), ['x'])]);
  }
  if (b.type === 'plot') {
    for (const f of b.functions) {
      let ok = 0; const c = math.compile(f.expr);
      for (let i = 0; i < 200; i++) { const x = b.x[0] + (b.x[1] - b.x[0]) * i / 199; const v = c.evaluate({ x, a: b.params[0]?.value }); if (typeof v === 'number' && isFinite(v)) ok++; }
      out.push([`${b.id} plot ${f.expr} finite`, ok / 200 >= 0.8]);
    }
  }
  if (b.type === 'checkpoint' && b.item.type === 'numeric') {
    const v = math.evaluate(b.item.answer_expr);
    const slope = math.derivative('x^2', 'x').evaluate({ x: 1.5 });
    out.push([`${b.id} answer ${v} equals derivative at 1.5 (${slope})`, Math.abs(v - slope) < 1e-9]);
  }
}
// negative control: a wrong step must fail
out.push(['negative control 2x+h vs 2x+2h is NOT equivalent', equivalent('2*x+h', '2*x+2*h', ['x', 'h']) === false]);
let fail = 0; for (const [k, v] of out) { console.log(v === true ? 'PASS' : 'FAIL', k); if (v !== true) fail++; }
process.exit(fail ? 1 : 0);
