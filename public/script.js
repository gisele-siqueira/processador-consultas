const btn = document.querySelector('#analisar');
const result = document.querySelector('#resultado');
btn.addEventListener('click', async () => {
  btn.disabled = true;
  result.textContent = 'Analisando...';
  try {
    const response = await fetch('/api/analisar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: document.querySelector('#sql').value }) });
    const data = await response.json();
    result.replaceChildren();
    const status = document.createElement('div');
    status.className = data.valida ? 'ok' : 'erro';
    status.textContent = data.valida ? data.mensagem : `Erro ${data.tipo}: ${data.mensagem}`;
    result.append(status);
    if (data.valida) {
      const title = document.createElement('h2'); title.textContent = 'Metadados identificados';
      const pre = document.createElement('pre'); pre.textContent = JSON.stringify({ tabelas: data.tabelas, colunas: data.colunas }, null, 2);
      result.append(title, pre);
      const algebraTitle = document.createElement('h2');
      algebraTitle.textContent = 'HU2 — Álgebra relacional';
      const algebra = document.createElement('div');
      algebra.className = 'algebra';
      algebra.textContent = data.algebraRelacional.expressao;
      result.append(algebraTitle, algebra);
      const graphTitle = document.createElement('h2');
      graphTitle.textContent = 'HU3 — Grafo de operadores (não otimizado)';
      const graphDescription = document.createElement('p');
      graphDescription.textContent = 'O fluxo segue das tabelas (folhas) até a projeção final (raiz).';
      const graphBox = document.createElement('div');
      graphBox.className = 'graph-container';
      graphBox.append(renderGraph(data.grafoOperadores));
      result.append(graphTitle, graphDescription, graphBox);
      const optimizedTitle = document.createElement('h2');
      optimizedTitle.textContent = 'HU4 — Grafo otimizado (pós-heurísticas)';
      const optimizedDescription = document.createElement('p');
      optimizedDescription.textContent = data.grafoOtimizado.heuristicas.join(' • ');
      const optimizedBox = document.createElement('div');
      optimizedBox.className = 'graph-container';
      optimizedBox.append(renderGraph(data.grafoOtimizado));
      const planTitle = document.createElement('h2');
      planTitle.textContent = 'HU5 — Plano de execução (grafo otimizado)';
      const planDescription = document.createElement('p');
      planDescription.textContent = 'Ordem lógica de baixo para cima: cada operação é executada após suas entradas. As heurísticas são explicadas por etapa; não são tempos nem custos medidos.';
      const plan = document.createElement('ol');
      plan.className = 'execution-plan';
      for (const step of data.planoExecucao) {
        const item = document.createElement('li');
        const operation = document.createElement('strong');
        const nomesOperadores = { table: 'Tabela', selection: 'Seleção', projection: 'Projeção', join: 'Junção', rename: 'Renomeação' };
        operation.textContent = `${nomesOperadores[step.operador] || step.operador}: ${step.descricao}`;
        const inputs = document.createElement('div');
        inputs.textContent = step.entradas.length ? `Entradas: ${step.entradas.join(', ')}` : 'Entrada: tabela-base';
        const heuristic = document.createElement('div');
        heuristic.className = 'plan-heuristic';
        heuristic.textContent = `Heurística / justificativa: ${step.heuristica}`;
        item.append(operation, inputs, heuristic);
        plan.append(item);
      }
      result.append(optimizedTitle, optimizedDescription, optimizedBox, planTitle, planDescription, plan);
    }
  } catch { result.textContent = 'Não foi possível conectar ao servidor.'; }
  finally { btn.disabled = false; }
});


function renderGraph(graph) {
  const NS = 'http://www.w3.org/2000/svg';
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const children = new Map(graph.nodes.map(node => [node.id, []]));
  graph.edges.forEach(edge => children.get(edge.to).push(edge.from));
  const widths = new Map();
  const BOX_W = 230, BOX_H = 66, H_GAP = 35, V_GAP = 96;
  function measure(id) {
    const kids = children.get(id);
    const width = kids.length ? Math.max(BOX_W, kids.reduce((sum, child) => sum + measure(child), 0) + H_GAP * (kids.length - 1)) : BOX_W;
    widths.set(id, width);
    return width;
  }
  const totalWidth = measure(graph.rootId);
  const positions = new Map();
  let maxDepth = 0;
  function position(id, x, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const width = widths.get(id);
    positions.set(id, { x: x + width / 2, y: depth * V_GAP + BOX_H / 2 });
    let cursor = x;
    for (const child of children.get(id)) {
      position(child, cursor, depth + 1);
      cursor += widths.get(child) + H_GAP;
    }
  }
  position(graph.rootId, 20, 0);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${totalWidth + 40} ${(maxDepth + 1) * V_GAP + 20}`);
  svg.setAttribute('width', String(totalWidth + 40));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', graph.optimized ? 'Grafo otimizado da consulta SQL' : 'Grafo original de operadores da consulta SQL');
  const defs = document.createElementNS(NS, 'defs');
  const marker = document.createElementNS(NS, 'marker');
  for (const [name, value] of Object.entries({ id: 'arrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })) marker.setAttribute(name, value);
  const arrow = document.createElementNS(NS, 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', '#65778f');
  marker.append(arrow); defs.append(marker); svg.append(defs);
  for (const edge of graph.edges) {
    const child = positions.get(edge.from), parent = positions.get(edge.to);
    const line = document.createElementNS(NS, 'line');
    for (const [name, value] of Object.entries({ x1: child.x, y1: child.y - BOX_H / 2, x2: parent.x, y2: parent.y + BOX_H / 2 + 5, stroke: '#65778f', 'stroke-width': 2, 'marker-end': 'url(#arrow)' })) line.setAttribute(name, String(value));
    svg.append(line);
  }
  for (const node of graph.nodes) {
    const { x, y } = positions.get(node.id);
    const group = document.createElementNS(NS, 'g');
    const rect = document.createElementNS(NS, 'rect');
    for (const [name, value] of Object.entries({ x: x - BOX_W / 2, y: y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: 10, class: `node-${node.type}` })) rect.setAttribute(name, String(value));
    group.append(rect);
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', String(x)); label.setAttribute('y', String(y + 4));
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'node-label');
    const value = node.label;
    // Quebra de linhas por tamanho aproximado; texto seguro, sem innerHTML.
    const words = value.split(' '), lines = []; let current = '';
    for (const word of words) {
      if (current && (current + ' ' + word).length > 27) { lines.push(current); current = word; }
      else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(current);
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(NS, 'tspan');
      tspan.setAttribute('x', String(x));
      tspan.setAttribute('dy', index ? '16' : String(-8 * (lines.length - 1)));
      tspan.textContent = line;
      label.append(tspan);
    });
    group.append(label);
    const title = document.createElementNS(NS, 'title'); title.textContent = node.label;
    group.append(title); svg.append(group);
  }
  return svg;
}
