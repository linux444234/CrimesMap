document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map').setView([-22.9, -43.2], 11);

  const normalLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);

  const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: '© Esri'
  });

  const btnSat = document.getElementById('btnSat');
  const btnMap = document.getElementById('btnMap');
  const btnSearch = document.getElementById('btnSearch');
  const searchInput = document.getElementById('search');
  const btnAdd = document.getElementById('btnAdd');
  const overlay = document.getElementById('overlay');
  const formPopup = document.getElementById('formPopup');
  const confirmAdd = document.getElementById('confirmAdd');
  const cancelAdd = document.getElementById('cancelAdd');
  const btnExport = document.getElementById('btnExport');
  const fileInput = document.getElementById('fileimport');
  const btnImport = document.getElementById('btnImport');

  let tempLatLng = null;
  const crimes = [];

  btnSat.addEventListener('click', () => {
    if (map.hasLayer(normalLayer)) {
      map.removeLayer(normalLayer);
      satLayer.addTo(map);
    }
  });

  btnMap.addEventListener('click', () => {
    if (map.hasLayer(satLayer)) {
      map.removeLayer(satLayer);
      normalLayer.addTo(map);
    }
  });

  btnSearch.addEventListener('click', async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        map.setView([lat, lon], 14);
      } else alert('Local não encontrado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao pesquisar localização.');
    }
  });

  function createAndAddCircle(c) {
    c.latitude = Number(c.latitude);
    c.longitude = Number(c.longitude);
    c.data = c.data || new Date().toISOString();

    crimes.push(c);

    const marker = L.circle([c.latitude, c.longitude], {
      color: 'red', fillColor: '#f03', fillOpacity: 0.5, radius: 150
    })
      .bindPopup(`
        <b>Tipo:</b> ${c.type}<br>
        <b>Descrição:</b> ${c.description}<br>
        <b>Bairro:</b> ${c.bairro}<br>
        <b>Cidade:</b> ${c.city}<br>
        <b>Data:</b> ${new Date(c.data).toLocaleString('pt-BR')}
        <br>
        <button class="report-whatsapp">Reportar via WhatsApp</button>
      `)
      .addTo(map);

    marker.__crime = c;
    marker.on('dblclick', () => {
      if (confirm('Deseja remover este crime?')) {
        map.removeLayer(marker);
        const idx = crimes.indexOf(marker.__crime);
        if (idx > -1) crimes.splice(idx, 1);
    
      }
    });

    marker.on('popupopen', () => {
      const btn = document.querySelector('.report-whatsapp');
      if (btn) btn.addEventListener('click', () => {
        window.open('https://wa.me/?text=' + encodeURIComponent('Crime reportado: ' + c.description), '_blank');
      });
    });

    return marker;
  }

  btnAdd.addEventListener('click', () => {
    alert('Clique no mapa para escolher o local do crime.');
    map.once('click', (e) => {
      tempLatLng = e.latlng;
      overlay.style.display = 'block';
      formPopup.style.display = 'block';
    });
  });

  cancelAdd.addEventListener('click', () => {
    overlay.style.display = 'none';
    formPopup.style.display = 'none';
  });

  confirmAdd.addEventListener('click', async () => {
    const type = document.getElementById('type').value.trim();
    const description = document.getElementById('description').value.trim();
    const bairro = document.getElementById('bairro').value.trim();
    const city = document.getElementById('city').value.trim();

    if (!type || !description || !bairro || !city) {
      alert('Preencha todos os campos!');
      return;
    }

    const c = {
      latitude: tempLatLng.lat,
      longitude: tempLatLng.lng,
      type, description, bairro, city,
      data: new Date().toISOString()
    };

    createAndAddCircle(c);

    try {
      await fetch('/api/crimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
    } catch (err) {
      console.error('Erro ao salvar crime:', err);
    }

    overlay.style.display = 'none';
    formPopup.style.display = 'none';
    document.querySelectorAll('#formPopup input').forEach(i => i.value = '');
  });

  btnExport.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(crimes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crimes.json';
    a.click();
  });

  async function carregarCrimes() {
    try {
      const res = await fetch('/api/crimes');
      const crimesAPI = await res.json();
      crimesAPI.forEach(c => {
        if (c.latitude && c.longitude) {
          createAndAddCircle(c);
        }
      });
    } catch (err) {
      console.error('Erro ao carregar crimes:', err);
    }
  }

  fileInput.addEventListener('change', async function () {
    const file = this.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) return alert('JSON inválido: precisa ser um array');

        imported.forEach(c => {
          const obj = {
            latitude: Number(c.latitude ?? c.lat ?? c.Latitude),
            longitude: Number(c.longitude ?? c.lng ?? c.long ?? c.lon ?? c.Longitude),
            type: c.type || c.tipo || '',
            description: c.description || c.descricao || '',
            bairro: c.bairro || '',
            city: c.city || c.cidade || '',
            data: c.data || c.date || new Date().toISOString()
          };
          createAndAddCircle(obj);
        });

        await fetch('/api/crimes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imported)
        });

        alert(`Importados ${imported.length} crimes.`);
      } catch (err) {
        console.error(err);
        alert('Erro ao importar arquivo JSON.');
      }
    };
    reader.readAsText(file);
  });

  if (btnImport) btnImport.addEventListener('click', () => fileInput.click());

  carregarCrimes();
});