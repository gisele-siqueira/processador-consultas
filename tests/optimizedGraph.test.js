const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/services/queryService');
const base = `SELECT cliente.Nome, pedido.ValorTotalPedido FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente WHERE pedido.ValorTotalPedido > 500`;
test('HU4 gera árvore otimizada e mantém original', () => {
  const r = analyze(base);
  assert.equal(r.grafoOperadores.optimized, false);
  assert.equal(r.grafoOtimizado.optimized, true);
  assert.equal(r.grafoOtimizado.nodes.find(n => n.id === r.grafoOtimizado.rootId).type, 'projection');
});
test('HU4 antecipa seleção local antes da junção', () => {
  const g = analyze(base).grafoOtimizado;
  const selection = g.nodes.find(n => n.type === 'selection');
  const join = g.nodes.find(n => n.type === 'join');
  assert.ok(selection.label.includes('500'));
  assert.ok(g.edges.some(e => e.from === selection.id || g.edges.some(f => f.from === selection.id && e.from === f.to)));
  assert.ok(join);
});
test('HU4 preserva colunas necessárias para junção e SELECT', () => {
  const g = analyze(base).grafoOtimizado;
  const projections = g.nodes.filter(n => n.type === 'projection');
  assert.ok(projections.some(n => n.label.includes('Cliente_idCliente')));
  assert.ok(projections.some(n => n.label.includes('idCliente')));
});
test('HU4 aceita múltiplas junções conectadas', () => {
  const g = analyze(`SELECT cliente.Nome, status.Descricao FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente JOIN status ON pedido.Status_idStatus = status.idStatus WHERE cliente.idCliente > 1`).grafoOtimizado;
  assert.equal(g.nodes.filter(n => n.type === 'join').length, 2);
});
test('HU4 rejeita junção cartesiana', () => {
  assert.throws(() => analyze(`SELECT cliente.Nome FROM cliente JOIN pedido ON cliente.idCliente = cliente.idCliente`), { kind: 'Semântica' });
});
