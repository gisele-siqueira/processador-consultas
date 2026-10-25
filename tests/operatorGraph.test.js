const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/services/queryService');
const graph = sql => analyze(sql).grafoOperadores;

test('projeção é a raiz e tabela é a folha', () => {
  const g = graph('SELECT Nome FROM cliente');
  assert.equal(g.nodes.find(n => n.id === g.rootId).type, 'projection');
  assert.equal(g.nodes.filter(n => n.type === 'table').length, 1);
  assert.equal(g.edges.length, 1);
  assert.equal(g.optimized, false);
});
test('WHERE produz seleção abaixo da projeção', () => {
  const g = graph('SELECT Nome FROM cliente WHERE idCliente > 10');
  assert.deepEqual(g.nodes.map(n => n.type), ['table', 'selection', 'projection']);
  assert.deepEqual(g.edges.map(e => [e.from, e.to]), [['n1','n2'],['n2','n3']]);
});
test('JOIN conecta duas tabelas e preserva condição', () => {
  const g = graph('SELECT cliente.Nome FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente');
  assert.deepEqual(g.nodes.map(n => n.type), ['table','table','join','projection']);
  assert.match(g.nodes.find(n => n.type === 'join').label, /cliente.idCliente = pedido.Cliente_idCliente/);
  assert.equal(g.edges.filter(e => e.to === 'n3').length, 2);
});
test('dois JOINs mantêm a ordem lógica original', () => {
  const g = graph('SELECT cliente.Nome FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente JOIN status ON pedido.Status_idStatus = status.idStatus');
  assert.equal(g.nodes.filter(n => n.type === 'join').length, 2);
  assert.equal(g.nodes.filter(n => n.type === 'table').length, 3);
  assert.equal(g.nodes.find(n => n.id === g.rootId).type, 'projection');
});
test('alias cria renomeação acima da folha', () => {
  const g = graph('SELECT c.Nome FROM cliente c');
  assert.deepEqual(g.nodes.map(n => n.type), ['table','rename','projection']);
});
test('consulta inválida não produz grafo', () => {
  assert.throws(() => graph('SELECT Inexistente FROM cliente'), {kind:'Semântica'});
});
