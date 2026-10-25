const { parseSQL } = require('../parser/sqlParser');
const { validate } = require('../validators/semanticValidator');
const { convert } = require('../algebra/relationalAlgebra');
const { buildOperatorGraph } = require('../graph/operatorGraph');
const { buildOptimizedGraph } = require('../graph/optimizedGraph');
const { buildExecutionPlan } = require('../plan/executionPlan');
function analyze(sql) {
  const ast = parseSQL(sql);
  const metadata = validate(ast);
  const algebraRelacional = convert(ast);
  const grafoOtimizado = buildOptimizedGraph(ast);
  const planoExecucao = buildExecutionPlan(grafoOtimizado);
  return { valida: true, mensagem: 'Consulta SQL válida!', ...metadata, algebraRelacional, grafoOperadores: buildOperatorGraph(ast), grafoOtimizado, planoExecucao, ast };
}
module.exports = { analyze };
