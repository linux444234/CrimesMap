require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');
const jsonPath = path.join(__dirname, 'json', 'crimes.json');

app.use(express.json());
app.use(express.static(publicPath));

async function readData() {
  const content = await fs.readFile(jsonPath, 'utf-8');
  return JSON.parse(content);
}

async function writeData(obj) {
  await fs.writeFile(jsonPath, JSON.stringify(obj, null, 2), 'utf-8');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'crimes.html'));
});

app.get('/api/crimes', async (req, res) => {
  try {
    const json = await readData();
    res.json(json.data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar crimes.' });
  }
});
app.post('/api/crimes', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Payload ausente.' });

    const json = await readData();
    json.data = json.data || [];

    if (Array.isArray(payload)) {
      payload.forEach(p => {
        p.id = p.id ?? Date.now() + Math.floor(Math.random() * 1000);
        json.data.push(p);
      });
      await writeData(json);
      return res.status(201).json({ message: 'Crimes adicionados.', count: payload.length });
    }

    const item = payload;
    item.id = item.id ?? Date.now();
    json.data.push(item);
    await writeData(json);
    res.status(201).json({ message: 'Crime adicionado.', id: item.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar crime.' });
  }
});
app.put('/api/crimes', async (req, res) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload deve ser um array.' });
    const json = { data: payload.map((p, i) => ({ id: p.id ?? Date.now() + i, ...p })) };
    await writeData(json);
    res.json({ message: 'Dataset substituído.', count: json.data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao substituir dataset.' });
  }
});

app.delete('/api/crimes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const json = await readData();
    const before = json.data.length;
    json.data = json.data.filter(c => Number(c.id) !== id);
    await writeData(json);
    res.json({ message: 'Removido', removed: before - json.data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover crime.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});