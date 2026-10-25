// HU5: plano lógico derivado das dependências reais do grafo otimizado.
const descriptions = {
  table: 'Leitura da tabela-base; operação necessária, sem heurística de redução.',
  rename: 'Renomeação para preservar o alias e distinguir atributos.',
  selection: 'Seleção antecipada (pushdown): reduz tuplas antes das junções quando a condição é local.',
  projection: 'Projeção antecipada: reduz atributos intermediários, preservando colunas necessárias à junção e à saída final.',
  join: 'Junção por condição explícita entre resultados conectados, evitando produto cartesiano.'
};
function buildExecutionPlan(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Grafo otimizado inválido.');
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const deps = new Map(graph.nodes.map(n => [n.id, []]));
  for (const edge of graph.edges) {
    if (!deps.has(edge.to) || !byId.has(edge.from)) throw new Error('Aresta inválida no grafo.');
    deps.get(edge.to).push(edge.from);
  }
  const visiting = new Set(), visited = new Set(), ordered = [];
  function visit(id) {
    if (!byId.has(id)) throw new Error('Nó ausente no grafo.');
    if (visiting.has(id)) throw new Error('Ciclo detectado no grafo.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of deps.get(id)) visit(child);
    visiting.delete(id); visited.add(id);
    ordered.push(id);
  }
  visit(graph.rootId);
  if (visited.size !== graph.nodes.length) throw new Error('O grafo contém nós desconectados da raiz.');
  return ordered.map((id, index) => {
    const node = byId.get(id);
    const final = id === graph.rootId && node.type === 'projection';
    return { ordem: index + 1, nodeId: id, operador: node.type, descricao: node.label,
      entradas: [...deps.get(id)],
      heuristica: final ? 'Projeção final: apresenta somente os atributos solicitados pelo SELECT.' : descriptions[node.type] || 'Operação lógica do grafo otimizado.' };
  });
}
module.exports = { buildExecutionPlan };
