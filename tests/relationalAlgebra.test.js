const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/services/queryService');
test('projeção simples', () => assert.equal(analyze('SELECT Nome FROM cliente').algebraRelacional.expressao, 'π_{cliente.Nome}(cliente)'));
test('seleção com operador', () => assert.match(analyze('SELECT Nome FROM cliente WHERE idCliente >= 10').algebraRelacional.expressao, /σ_\{cliente.idCliente >= 10\}/));
test('junção e seleção', () => { const a = analyze('SELECT cliente.Nome, pedido.DataPedido FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente WHERE pedido.ValorTotalPedido > 500').algebraRelacional; assert.match(a.expressao, /⋈_/); assert.match(a.expressao, /σ_/); assert.match(a.expressao, /π_/); });
test('múltiplas junções', () => assert.equal(analyze('SELECT cliente.Nome, status.Descricao FROM cliente JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente JOIN status ON pedido.Status_idStatus = status.idStatus').algebraRelacional.juncoes.length, 2));
test('AND e parênteses', () => assert.match(analyze('SELECT Nome FROM cliente WHERE (idCliente > 1 AND idCliente <= 10)').algebraRelacional.expressao, /∧/));
test('não converte LEFT JOIN como INNER JOIN', () => assert.throws(() => analyze('SELECT cliente.Nome FROM cliente LEFT JOIN pedido ON cliente.idCliente = pedido.Cliente_idCliente'), {kind:'Sintática'}));
