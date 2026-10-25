const { Parser } = require('node-sql-parser');
const parser = new Parser();
class ValidationError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}
function parseSQL(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new ValidationError('Sintática', 'Digite uma consulta SQL.');
  let ast;
  try { ast = parser.astify(sql, { database: 'MySQL' }); }
  catch (err) { throw new ValidationError('Sintática', `SQL inválido: ${err.message}`); }
  if (Array.isArray(ast)) {
    if (ast.length !== 1) throw new ValidationError('Sintática', 'Envie somente uma consulta SELECT.');
    ast = ast[0];
  }
  if (!ast || typeof ast.type !== 'string') throw new ValidationError('Sintática', 'Consulta SQL inválida.');
  if (ast.type.toLowerCase() !== 'select') throw new ValidationError('Sintática', 'Somente consultas SELECT são permitidas.');
  return ast;
}
module.exports = { parseSQL, ValidationError };
