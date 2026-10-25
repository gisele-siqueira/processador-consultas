const schema = require('../metadata/schema');
const { convert } = require('../algebra/relationalAlgebra');
const { ValidationError } = require('../parser/sqlParser');

// Otimizador heurístico, sem estatísticas de cardinalidade.
function buildOptimizedGraph(ast) {
  const sources = ast.from.map(s => ({ table: s.table.toLowerCase(), alias: (s.as || s.table).toLowerCase(), on: s.on }));
  const byAlias = new Map(sources.map(s => [s.alias, s]));
  const nodes = [], edges = [], steps = [];
  let seq = 0;
  function add(type, label, children = []) {
    const id = `n${++seq}`;
    nodes.push({ id, type, label });
    for (const child of children) edges.push({ from: child, to: id });
    steps.push({ ordem: steps.length + 1, operador: type, descricao: label });
    return id;
  }
  function resolve(ref) {
    if (ref.table) return String(ref.table).toLowerCase();
    const matches = sources.filter(s => schema[s.table].has(String(ref.column).toLowerCase()));
    if (matches.length !== 1) throw new ValidationError('Semântica', `Coluna '${ref.column}' não pode ser resolvida.`);
    return matches[0].alias;
  }
  function refs(expr, output = []) {
    if (!expr) return output;
    if (expr.type === 'column_ref') output.push({ alias: resolve(expr), column: String(expr.column) });
    else if (expr.type === 'binary_expr') { refs(expr.left, output); refs(expr.right, output); }
    return output;
  }
  function parts(expr) {
    if (!expr) return [];
    if (expr.type === 'binary_expr' && String(expr.operator).toUpperCase() === 'AND') return [...parts(expr.left), ...parts(expr.right)];
    return [expr];
  }
  function format(expr) {
    if (expr.type === 'column_ref') return `${resolve(expr)}.${expr.column}`;
    if (expr.type === 'number') return String(expr.value);
    if (expr.type === 'string') return `'${String(expr.value).replace(/'/g, "''")}'`;
    if (expr.type === 'bool') return String(expr.value).toUpperCase();
    if (expr.type === 'binary_expr') {
      const op = String(expr.operator).toUpperCase();
      return `(${format(expr.left)} ${op === 'AND' ? '∧' : op === '<>' ? '≠' : op} ${format(expr.right)})`;
    }
    throw new ValidationError('Sintática', 'Expressão não suportada pelo otimizador.');
  }
  const filters = new Map(sources.map(s => [s.alias, []]));
  const joins = [];
  const remaining = [];
  for (const condition of parts(ast.where)) {
    const aliases = new Set(refs(condition).map(r => r.alias));
    if (aliases.size === 1) filters.get([...aliases][0]).push(condition);
    else remaining.push(condition);
  }
  for (const s of sources.slice(1)) {
    for (const condition of parts(s.on)) {
      const aliases = new Set(refs(condition).map(r => r.alias));
      if (aliases.size === 1) filters.get([...aliases][0]).push(condition);
      else if (aliases.size === 2) joins.push(condition);
      else remaining.push(condition);
    }
  }
  // Colunas necessárias: SELECT, condições de junção e filtros não locais.
  const needed = new Map(sources.map(s => [s.alias, new Map()]));
  function include(expr) {
    for (const r of refs(expr)) needed.get(r.alias).set(r.column.toLowerCase(), r.column);
  }
  ast.columns.forEach(c => include(c.expr));
  joins.forEach(include);
  remaining.forEach(include);
  // Não é necessário manter colunas usadas somente em filtros locais após a seleção.
  const built = new Map();
  function leaf(s) {
    if (built.has(s.alias)) return built.get(s.alias);
    let id = add('table', s.table);
    if (s.alias !== s.table) id = add('rename', `ρ ${s.alias}`, [id]);
    if (filters.get(s.alias).length) id = add('selection', `σ ${filters.get(s.alias).map(format).join(' ∧ ')}`, [id]);
    const cols = [...needed.get(s.alias).values()];
    if (cols.length && cols.length < schema[s.table].size) id = add('projection', `π ${cols.map(c => `${s.alias}.${c}`).join(', ')}`, [id]);
    built.set(s.alias, id);
    return id;
  }
  // Preferir fontes com mais filtros; entre as disponíveis, sempre escolher junção conectada.
  const ranked = [...sources].sort((a,b) => filters.get(b.alias).length - filters.get(a.alias).length);
  const first = ranked.shift();
  let root = leaf(first);
  const joined = new Set([first.alias]);
  const pending = [...joins];
  while (ranked.length) {
    const candidates = ranked.map(s => ({ source: s, applicable: pending.filter(c => {
      const a = new Set(refs(c).map(r => r.alias));
      return a.has(s.alias) && [...a].some(x => joined.has(x));
    }) }));
    candidates.sort((a,b) => b.applicable.length - a.applicable.length || filters.get(b.source.alias).length - filters.get(a.source.alias).length);
    const choice = candidates[0];
    if (!choice.applicable.length) throw new ValidationError('Semântica', 'A consulta exige produto cartesiano: não há condição de junção conectando todas as tabelas.');
    const conditions = choice.applicable;
    root = add('join', `⋈ ${conditions.map(format).join(' ∧ ')}`, [root, leaf(choice.source)]);
    joined.add(choice.source.alias);
    ranked.splice(ranked.indexOf(choice.source), 1);
    conditions.forEach(c => pending.splice(pending.indexOf(c), 1));
  }
  const leftovers = [...remaining, ...pending];
  if (leftovers.length) root = add('selection', `σ ${leftovers.map(format).join(' ∧ ')}`, [root]);
  const algebra = convert(ast);
  root = add('projection', `π ${algebra.projecao}`, [root]);
  return { nodes, edges, rootId: root, optimized: true, planoExecucao: steps, heuristicas: [
    'Seleções locais aplicadas antes das junções',
    'Projeções antecipadas preservando atributos necessários',
    'Junções conectadas priorizadas para evitar produto cartesiano',
    'Ordem heurística baseada na quantidade de filtros e condições de junção'
  ] };
}
module.exports = { buildOptimizedGraph };
