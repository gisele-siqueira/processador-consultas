const schema = require('../metadata/schema');
const { ValidationError } = require('../parser/sqlParser');
const fail = (kind, message) => { throw new ValidationError(kind, message); };
const syn = message => fail('Sintática', message);
const sem = message => fail('Semântica', message);
const key = value => String(value).toLowerCase();

function validate(ast) {
  if (ast.with || ast.union || ast._next || ast.groupby || ast.having || ast.orderby || ast.limit || ast.distinct || ast.window || ast.lock) syn('Esta HU aceita apenas SELECT, FROM, WHERE, JOIN e ON, sem cláusulas adicionais.');
  if (!Array.isArray(ast.from) || !ast.from.length) syn('A cláusula FROM é obrigatória.');
  if (!Array.isArray(ast.columns) || !ast.columns.length) syn('Informe pelo menos uma coluna no SELECT.');
  const sources = new Map();
  const tables = [];
  for (const item of ast.from) {
    if (!item.table || item.expr || item.db) syn('FROM/JOIN deve referenciar diretamente uma tabela conhecida.');
    const table = key(item.table);
    if (!schema[table]) sem(`Tabela '${item.table}' não existe no modelo relacional.`);
    const alias = key(item.as || item.table);
    if (sources.has(alias)) sem(`Alias/tabela '${alias}' foi declarado mais de uma vez.`);
    if (item.join && !/^((INNER|LEFT|RIGHT|FULL|CROSS) )?JOIN$/i.test(item.join.trim())) syn(`JOIN não suportado: ${item.join}.`);
    if (item.join && !item.on) syn(`JOIN com '${item.table}' precisa da cláusula ON.`);
    if (!item.join && tables.length) syn('Separe tabelas usando JOIN ... ON (produto cartesiano não é aceito).');
    sources.set(alias, table);
    tables.push({ tabela: table, alias });
  }
  const columns = new Set();
  function resolve(ref) {
    const column = key(ref.column);
    if (column === '*') syn('Use nomes explícitos de colunas, não SELECT *.');
    let alias;
    if (ref.table) {
      alias = key(ref.table);
      if (!sources.has(alias)) sem(`Tabela ou alias '${ref.table}' não aparece no FROM/JOIN.`);
      if (!schema[sources.get(alias)].has(column)) sem(`Coluna '${ref.column}' não existe em '${sources.get(alias)}'.`);
    } else {
      const matches = [...sources].filter(([,table]) => schema[table].has(column));
      if (!matches.length) sem(`Coluna '${ref.column}' não existe nas tabelas consultadas.`);
      if (matches.length > 1) sem(`Coluna '${ref.column}' é ambígua; informe o alias da tabela.`);
      alias = matches[0][0];
    }
    columns.add(`${alias}.${column}`);
  }
  function expression(node) {
    if (!node || typeof node !== 'object') syn('Expressão SQL incompleta.');
    switch (node.type) {
      case 'column_ref': resolve(node); return;
      case 'number': case 'string': case 'bool': return;
      case 'binary_expr': {
        const op = String(node.operator).toUpperCase();
        if (!['=', '>', '<', '<=', '>=', '<>', 'AND'].includes(op)) syn(`Operador '${node.operator}' não é permitido.`);
        expression(node.left); expression(node.right); return;
      }
      case 'expr_list': syn('Listas de expressões não são permitidas.'); break;
      default: syn(`Expressão '${node.type}' não é permitida nesta HU.`);
    }
  }
  for (const item of ast.columns) {
    if (item.as) syn('Aliases para colunas não fazem parte do escopo desta HU.');
    if (item.expr?.type !== 'column_ref') syn('SELECT deve conter apenas nomes de colunas.');
    expression(item.expr);
  }
  for (const item of ast.from) if (item.join) expression(item.on);
  if (ast.where) expression(ast.where);
  return { tabelas: tables, colunas: [...columns] };
}
module.exports = { validate };
