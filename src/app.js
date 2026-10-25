const express = require('express');
const path = require('node:path');
const { analyze } = require('./services/queryService');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.post('/api/analisar', (req, res) => {
  try { res.json(analyze(req.body?.sql)); }
  catch (err) {
    if (err.kind) return res.status(400).json({ valida: false, tipo: err.kind, mensagem: err.message });
    console.error(err);
    res.status(500).json({ valida: false, tipo: 'Interno', mensagem: 'Falha interna na análise.' });
  }
});
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Acesse http://localhost:${port}`));
}
module.exports = app;
