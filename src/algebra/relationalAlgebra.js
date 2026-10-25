const schema = require('../metadata/schema');
const { ValidationError } = require('../parser/sqlParser');

function convert(ast) {
  const sources = ast.from.map(item => ({ table: item.table.toLowerCase(), alias: (item.as || item.table).toLowerCase(), join: item.join, on: item.on }));
  const resolve = ref => {
    const name = String(ref.column).toLowerCase();
    if (ref.table) return `${String(ref.table).toLowerCase()}.${ref.column}`;
    const matches = sources.filter(s => schema[s.table].has(name));
    if (matches.length !== 1) throw new ValidationError('Semântica', `Coluna '${ref.column}' não pode ser resolvida.`);
    return `${matches[0].alias}.${ref.column}`;
  };
  function expr(node) {
    if (!node) throw new ValidationError('Sintática', 'Expressão incompleta.');
    if (node.type === 'column_ref') return resolve(node);
    if (node.type === 'number') return String(node.value);
    if (node.type === 'string') return `'${String(node.value).replace(/'/g, "''")}'`;
    if (node.type === 'bool') return String(node.value).toUpperCase();
    if (node.type === 'binary_expr') {
      const op = String(node.operator).toUpperCase();
      const left = expr(node.left), right = expr(node.right);
      return op === 'AND' ? `(${left} ∧ ${right})` : `${left} ${op === '<>' ? '≠' : op} ${right}`;
    }
    throw new ValidationError('Sintática', `Expressão não suportada: ${node.type}`);
  }
  const source = s => s.alias === s.table ? s.table : `ρ_${s.alias}(${s.table})`;
  let algebra = source(sources[0]);
  for (const s of sources.slice(1)) {
    const type = String(s.join || '').trim().toUpperCase();
    if (type !== 'JOIN' && type !== 'INNER JOIN') throw new ValidationError('Sintática', 'HU2 suporta apenas INNER JOIN para preservar a semântica da junção.');
    algebra = `(${algebra} ⋈_{${expr(s.on)}} ${source(s)})`;
  }
  if (ast.where) algebra = `σ_{${expr(ast.where)}}(${algebra})`;
  const projection = ast.columns.map(c => resolve(c.expr)).join(', ');
  algebra = `π_{${projection}}(${algebra})`;
  return { expressao: algebra, projecao: projection, selecao: ast.where ? expr(ast.where) : null, juncoes: sources.slice(1).map(s => expr(s.on)) };
}
module.exports = { convert };
