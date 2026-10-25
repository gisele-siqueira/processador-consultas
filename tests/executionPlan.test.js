const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/services/queryService');
const { buildExecutionPlan } = require('../src/plan/executionPlan');
const sql = `SELECT cliente.Nome, pedido.ValorTotalPedido FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente WHERE pedido.ValorTotalPedido > 500`;
test('HU5 plano corresponde exatamente aos nós do grafo otimizado', () => {
  const { planoExecucao: p, grafoOtimizado: g } = analyze(sql);
  assert.equal(p.length, g.nodes.length);
  assert.deepEqual(new Set(p.map(s => s.nodeId)), new Set(g.nodes.map(n => n.id)));
  assert.deepEqual(p.map(s => s.ordem), p.map((_, i) => i + 1));
});
test('HU5 entradas são processadas antes de seus operadores', () => {
  const { planoExecucao: p, grafoOtimizado: g } = analyze(sql);
  const order = new Map(p.map(s => [s.nodeId, s.ordem]));
  for (const edge of g.edges) assert.ok(order.get(edge.from) < order.get(edge.to));
  assert.equal(p.at(-1).nodeId, g.rootId);
  assert.equal(p.at(-1).operador, 'projection');
});
test('HU5 apresenta justificativa por etapa, incluindo seleção, projeção e junção', () => {
  const p = analyze(sql).planoExecucao;
  for (const step of p) assert.ok(step.heuristica.length > 15);
  assert.match(p.find(s => s.operador === 'selection').heuristica, /tuplas/);
  assert.match(p.find(s => s.operador === 'join').heuristica, /cartesiano/);
  assert.match(p.find(s => s.operador === 'projection' && s.entradas.length).heuristica, /atributos|Projeção final/);
});
test('HU5 respeita múltiplos JOINs', () => {
  const p = analyze(`SELECT cliente.Nome, status.Descricao FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente JOIN status ON pedido.Status_idStatus = status.idStatus WHERE cliente.idCliente > 1`).planoExecucao;
  assert.equal(p.filter(s => s.operador === 'join').length, 2);
});
test('HU5 rejeita ciclo no grafo', () => {
  assert.throws(() => buildExecutionPlan({nodes:[{id:'a',type:'projection'}],edges:[{from:'a',to:'a'}],rootId:'a'}), /Ciclo/);
});
