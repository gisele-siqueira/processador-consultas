# Processador de Consultas — HU1 a HU5

Implementação das HUs 1 a 5: validação SQL, álgebra relacional, grafo original, otimização heurística e plano lógico de execução.

## Requisitos
Node.js 18 ou superior.

## Como executar
```bash
npm install
npm start
```
Acesse **http://localhost:3000**.

## Testes
```bash
npm test
```

## Escopo
SELECT de colunas explícitas; FROM; JOIN ... ON (múltiplos); WHERE; comparações =, >, <, <=, >=, <> e AND; parênteses nas expressões. Nomes de tabelas e colunas são verificados contra `src/metadata/schema.js`.

Fora do escopo desta HU: execução SQL, álgebra relacional, grafo, GROUP BY, ORDER BY, funções, subconsultas, SELECT *, OR e aliases de colunas. Os aliases de tabelas são aceitos.

## API
POST `/api/analisar` com corpo JSON `{"sql":"SELECT Nome FROM Cliente"}`. Sucesso HTTP 200; erro de validação HTTP 400, com `tipo` Sintática ou Semântica.

## Próxima história
O retorno da API contém a AST do `node-sql-parser`, reutilizável para a conversão em álgebra relacional.

## HU2 — Conversão para álgebra relacional

Após a validação da HU1, a API devolve `algebraRelacional.expressao`, contendo π (projeção), σ (seleção), ⋈ (junção interna), ∧ (AND) e ρ (renomeação de tabelas com alias). A interface apresenta a expressão.

A HU2 preserva condições e operadores suportados. LEFT/RIGHT/FULL JOIN são rejeitados nesta etapa para evitar uma conversão incorreta para junção interna. Não há otimização nem plano de execução nesta entrega.

Execute `npm install`, `npm test` e `npm start`.


## HU3 — Grafo de operadores (original)

O endpoint `POST /api/analisar` retorna `grafoOperadores` com `nodes` (`id`, `type`, `label`), `edges` (`from`, `to`), `rootId` e `optimized: false`. As arestas representam o fluxo de dados da folha até a raiz. A interface desenha a árvore em SVG sem bibliotecas adicionais, incluindo tabelas, renomeação de aliases, junções, seleção e projeção final. Não aplica otimizações nesta HU.

## HU4 — Otimização heurística

A resposta da API `/api/analisar` agora contém `grafoOtimizado` (nós, arestas, raiz, heurísticas e sequência de operações), além do `grafoOperadores` original da HU3. A interface apresenta as duas árvores para comparação.

Heurísticas implementadas: antecipação de filtros locais, projeções antecipadas mantendo atributos do SELECT e das junções, escolha de junções conectadas e priorização por quantidade de filtros/condições de junção. A ordenação é heurística, sem estatísticas reais do banco. O projeto aceita somente INNER JOIN e evita produto cartesiano na árvore otimizada.

Para testar: `npm install`, `npm test`, `npm start`. Execute no navegador em `http://localhost:3000`.

## HU5 — Plano de Execução
O endpoint `/api/analisar` retorna `planoExecucao`, calculado por percurso pós-ordem das dependências do `grafoOtimizado`. Cada passo inclui `ordem`, `nodeId`, `operador`, `descricao`, `entradas` e `heuristica`. A interface mostra a justificativa em cada etapa, não apenas uma lista de operações. O plano é lógico/heurístico e não executa SQL nem estima custos reais.

## Entrega final
O plano de execução é **lógico**, derivado do grafo otimizado, e não executa SQL no SGBD. As heurísticas não garantem custo ótimo sem estatísticas de cardinalidade. Execute `npm test` e confira a interface antes da entrega.
