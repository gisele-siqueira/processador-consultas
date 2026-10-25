const { convert } = require('../algebra/relationalAlgebra');
const { ValidationError } = require('../parser/sqlParser');

// Árvore lógica ORIGINAL: folhas=tabelas, junções encadeadas, seleção e projeção final.
// Nenhuma heurística de otimização é aplicada nesta etapa.
function buildOperatorGraph(ast) {
  const algebra = convert(ast); // Reaproveita a interpretação validada da HU2.
  const nodes = [];
  const edges = [];
  let sequence = 0;
  function add(type, label, children = []) {
    const id = `n${++sequence}`;
    nodes.push({ id, type, label });
    for (const child of children) edges.push({ from: child, to: id }); // fluxo: filho → pai
    return id;
  }
  function tableNode(item) {
    const table = String(item.table).toLowerCase();
    const alias = String(item.as || item.table).toLowerCase();
    const leaf = add('table', table);
    return alias === table ? leaf : add('rename', `ρ ${alias}`, [leaf]);
  }
  let current = tableNode(ast.from[0]);
  for (let i = 1; i < ast.from.length; i++) {
    const source = ast.from[i];
    const joinType = String(source.join || '').trim().toUpperCase();
    if (!['JOIN', 'INNER JOIN'].includes(joinType)) {
      throw new ValidationError('Sintática', 'HU3 suporta somente INNER JOIN.');
    }
    const right = tableNode(source);
    current = add('join', `⋈ ${algebra.juncoes[i - 1]}`, [current, right]);
  }
  if (algebra.selecao) current = add('selection', `σ ${algebra.selecao}`, [current]);
  const rootId = add('projection', `π ${algebra.projecao}`, [current]);
  return { nodes, edges, rootId, optimized: false };
}
module.exports = { buildOperatorGraph };
