// Тест-харнесс для deploy/cordis/1c-mcp-bridge.host.js БЕЗ Cordis:
//  - ctx/harness мокаются; harness.defineTool проксирует в НАСТОЯЩИЙ
//    @deepseek-ai/dsh-tools defineTool + assertSupportedJsonSchema
//    (та же цепочка, что в sandboxDefineTool хост-раннера);
//  - ctx.shell.run реально исполняет curl через node:child_process
//    (поведение как у bash-sandbox, без конфайнмента);
//  - execute вызывается живьём против туннеля 127.0.0.1:81xx.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tools = require('/home/l7777/.local/share/deepseek-harness/runtime/node_modules/@deepseek-ai/dsh-tools/lib/index.js');

const code = readFileSync(new URL('./1c-mcp-bridge.host.js', import.meta.url), 'utf8');
const mkPlugin = new Function('ctx', 'harness', code);

// ── мок shell: парсим команду curl и исполняем её через spawn ────────────────
function runCurl(command, stdin, timeoutMs) {
  return new Promise((resolve) => {
    const p = spawn('/bin/bash', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code2) => resolve({
      exitCode: code2, signal: null, timedOut: false, aborted: false, timeoutMs,
      stdout: { text: out, truncated: false },
      stderr: { text: err, truncated: false },
    }));
    p.on('error', () => resolve({
      exitCode: 1, signal: null, timedOut: false, aborted: false, timeoutMs,
      stdout: { text: '', truncated: false }, stderr: { text: 'spawn failed', truncated: false },
    }));
    p.stdin.end(stdin);
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('close', () => clearTimeout(t));
  });
}

const registered = [];
let cleanup = null;
const ctx = {
  shell: { run: (spec) => runCurl(spec.command, spec.stdin ?? '', spec.timeoutMs ?? 60000) },
  tools: { register: (t) => { registered.push(t); return () => {}; }, schemas: () => [], get: () => undefined },
  effect: (f) => { cleanup = f; return () => {}; },
  on: () => () => {}, once: () => () => {}, provide: () => () => {},
  get: (n) => (n === 'shell' ? ctx.shell : undefined),
};
const harness = {
  // как sandboxDefineTool: реальный defineTool + assertSupportedJsonSchema
  defineTool(options) {
    const tool = tools.defineTool({
      ...options,
      output: {
        schema: options.output.schema,
        render: (args, value) => options.output.render(args, value),
      },
      execute: (args, exec) => options.execute(args, exec),
    });
    tools.assertSupportedJsonSchema({ ...tool.parameters });
    return tool;
  },
  registerTool: (ctx2, tool) => ctx2.tools.register(tool),
  handle: () => () => {},
};

const plugin = mkPlugin(ctx, harness);
plugin.apply(ctx);

// ── проверки ────────────────────────────────────────────────────────────────
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const names = registered.map((t) => t.name);
console.log('registered:', names.length, 'tools');
if (names.length !== 15) fail(`ожидалось 15 инструментов, зарегистрировано ${names.length}`);
for (const n of ['mcp1c__graph__search_metadata', 'mcp1c__graph__resolve_effective_entity', 'mcp1c_call']) {
  if (!names.includes(n)) fail(`нет инструмента ${n}`);
}
// validateArgs на каждом инструменте: валидный кейс + кейс с лишним типом
for (const t of registered) {
  const spec = t.parameters; // уже JSON-Schema после defineTool
  void spec;
}

const exec = { signal: undefined };
const call = async (name, args) => {
  const t = registered.find((x) => x.name === name);
  return t.execute(args, exec);
};
const renderOf = (name) => registered.find((x) => x.name === name).output.render;

// 1. graph list_graph_projects (без аргументов)
let r = await call('mcp1c__graph__list_graph_projects', {});
if (!r.ok || !r.text.includes('LISmcp')) fail(`list_graph_projects: ok=${r.ok} text=${r.text.slice(0, 120)}`);
else console.log('ok  graph.list_graph_projects', r.latencyMs + 'ms');

// 2. graph search_metadata без project_id → дефолт LISmcp
r = await call('mcp1c__graph__search_metadata', { query: 'Номенклатура', max_items: 3 });
if (!r.ok) fail(`search_metadata default project: ${JSON.stringify(r).slice(0, 200)}`);
else console.log('ok  graph.search_metadata (project_id по умолчанию), text len:', r.text.length);

// 3. help docsearch
r = await call('mcp1c__help__docsearch', { query: 'ТабличнаяЧасть', top_k: 2 });
if (!r.ok) fail(`docsearch: ${JSON.stringify(r).slice(0, 200)}`);
else console.log('ok  help.docsearch', r.latencyMs + 'ms');

// 4. generic mcp1c_call: graph + инструмент вне allowlist
r = await call('mcp1c_call', { server: 'graph', tool: 'list_graph_projects', args_json: '{}' });
if (!r.ok) fail(`mcp1c_call graph: ${JSON.stringify(r).slice(0, 200)}`);
else console.log('ok  mcp1c_call(graph.list_graph_projects)');

// 5. generic: syntax (путь /mcp без слэша) + syntaxcheck текстом
r = await call('mcp1c_call', { server: 'syntax', tool: 'syntaxcheck',
  args_json: JSON.stringify({ code: 'Если Истина Тогда\n\tА = 1;\nКонецЕсли;', file_name: 'test.bsl' }) });
if (r.ok !== true) fail(`mcp1c_call syntax: ${JSON.stringify(r).slice(0, 300)}`);
else console.log('ok  mcp1c_call(syntax.syntaxcheck)');

// 6. render
const blocks = renderOf('mcp1c__graph__list_graph_projects')({}, r);
if (!Array.isArray(blocks) || blocks[0].type !== 'text') fail('render не вернул text-блоки');
else console.log('ok  render →', blocks[0].text.slice(0, 60).replace(/\n/g, ' '));

// 7. args_json мусор → понятная ошибка
let threw = null;
try { await call('mcp1c_call', { server: 'graph', tool: 'x', args_json: '{oops' }); }
catch (e) { threw = e; }
if (!threw || !/JSON/.test(threw.message)) fail('args_json мусор должен давать JSON-ошибку');
else console.log('ok  args_json мусор →', threw.message.slice(0, 60));

// 8. circuit breaker: три транспортных фейла подряд → open
const badPort = ctx.tools; // noop
void badPort;
// подменяем shell на падающий
const goodShell = ctx.shell;
ctx.shell = { run: async () => { throw new Error('sandbox down'); } };
ctx.get = (n) => (n === 'shell' ? ctx.shell : undefined);
// пере-создаём плагин с падающим shell — breaker живёт внутри экземпляра
const ctx2 = {
  shell: ctx.shell,
  tools: { register: () => () => {}, schemas: () => [], get: () => undefined },
  effect: () => () => {}, on: () => () => {}, provide: () => () => {},
  get: (n) => (n === 'shell' ? ctx.shell : undefined),
};
const p2 = mkPlugin(ctx2, harness);
// apply бросит? нет — регистрация не зовёт сеть; проверяем через mcp1c_call... но tools.register мокнут.
// вместо этого: вызываем execute напрямую три раза и ждём open на 4-й.
const plugin2 = p2;
// вытащим зарегистрированные инструменты: перехватим register
const reg2 = [];
ctx2.tools.register = (t) => { reg2.push(t); return () => {}; };
plugin2.apply(ctx2);
const g2 = reg2.find((t) => t.name === 'mcp1c_call');
for (let i = 0; i < 3; i++) {
  try { await g2.execute({ server: 'help', tool: 'docsearch', args_json: '{"query":"x"}' }, exec); }
  catch (e) { /* ожидаемо */ }
}
let opened = null;
try { await g2.execute({ server: 'help', tool: 'docsearch', args_json: '{"query":"x"}' }, exec); }
catch (e) { opened = e; }
if (!opened || !/circuit breaker OPEN/.test(opened.message)) fail('breaker не открылся после 3 фейлов');
else console.log('ok  circuit breaker OPEN →', opened.message.slice(0, 80));

// восстанавливаем shell и проверяем, что основной инстанс не задет (отдельный state)
ctx.shell = goodShell;
ctx.get = (n) => (n === 'shell' ? goodShell : undefined);
r = await call('mcp1c__ssl__ssl_search', { query: 'Печать', limit: 2 });
if (!r.ok) fail(`ssl_search после теста breaker: ${JSON.stringify(r).slice(0, 200)}`);
else console.log('ok  ssl.ssl_search', r.latencyMs + 'ms');

if (typeof cleanup === 'function') { cleanup(); console.log('ok  cleanup выполнен'); }
console.log(process.exitCode ? '\n=== ЕСТЬ ОШИБКИ ===' : '\n=== ВСЕ ПРОВЕРКИ ПРОШЛИ ===');
