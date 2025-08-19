let mode = 'view';
let points = [];
let midpointMarkers = L.layerGroup().addTo(map);
let boardLayer = null, numTerritories = 0;
let territoryLayers = [];
let territoryMeta = []; // {layer, name, color}

function showModal(html, onSubmit) {
  const bg = document.getElementById('modal-bg');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  bg.classList.add('active');
  const closeModal = () => { bg.classList.remove('active'); };
  const form = content.querySelector('form');
  if (form && onSubmit) {
    form.onsubmit = function(e) {
      e.preventDefault();
      onSubmit(form);
      closeModal();
      return false;
    };
  }
  bg.onclick = e => { if (e.target === bg) closeModal(); };
}

function hideModal() { document.getElementById('modal-bg').classList.remove('active'); }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function setMode(m) {
  mode = m;
  ['btn-view','btn-midpoint','btn-boardgame'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(`btn-${m}`).classList.add('active');
  document.getElementById('mode-title').textContent = (m === 'view') ? 'Interactive Map' :
                                                          (m === 'midpoint') ? 'Midpoint Mode' :
                                                          'Boardgame Mode';
  hide('midpoint-ui'); hide('boardgame-ui');
  if (m === 'midpoint') show('midpoint-ui');
  if (m === 'boardgame') show('boardgame-ui');
  if (m !== 'midpoint') { points = []; midpointMarkers.clearLayers(); }
  if (m !== 'boardgame') { drawnItems.clearLayers(); resetBoardgame(); }
}

// Attach event handlers NOW to enable mode switching!!!
document.getElementById('btn-view').onclick = () => setMode('view');
document.getElementById('btn-midpoint').onclick = () => setMode('midpoint');
document.getElementById('btn-boardgame').onclick = () => { setMode('boardgame'); setupBoardgameUI(); };

setMode('view'); // Initial load

// --- MIDPOINT MODE ---
map.on('click', e => {
  if (mode !== 'midpoint') return;
  points.push([e.latlng.lat, e.latlng.lng]);
  L.marker(e.latlng).addTo(midpointMarkers);
  document.getElementById('midpoint-message').textContent =
    `${points.length} points selected. Click "Calculate Midpoints" to proceed.`;
});
document.getElementById('calc-midpoint').onclick = () => {
  if (points.length < 2) {
    document.getElementById('midpoint-message').textContent = 'Select at least 2 points.';
    return;
  }
  fetch('/calculate_midpoints', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ points })
  })
  .then(res => res.json())
  .then(data => {
    if (data.midpoints) {
      data.midpoints.forEach(mp => {
        L.circleMarker([mp.lat, mp.lon], {
          radius: 7, color: mp.type === 'great-circle' ? 'lime' : 'red',
        }).bindPopup(mp.type).addTo(midpointMarkers);
      });
      document.getElementById('midpoint-message').textContent = 'Midpoints shown on map!';
    } else {
      document.getElementById('midpoint-message').textContent = 'Error occurred.';
    }
  });
};

// --- BOARDGAME MODE ---

function setupBoardgameUI() {
  document.getElementById('boardgame-step').innerHTML = `
    <p>Step 1: Draw your board shape.</p>
    <button id="draw-polygon">Draw Polygon</button>
    <button id="draw-rectangle">Draw Rectangle</button>
    <div id="board-drawn"></div>`;
  document.getElementById('draw-polygon').onclick = startBoardPolygon;
  document.getElementById('draw-rectangle').onclick = startBoardRect;
  document.getElementById('territories-ui').innerHTML = '';
  cleanupBoardTerritories();
}

function resetBoardgame() {
  if (boardLayer) { drawnItems.removeLayer(boardLayer); boardLayer = null; }
  numTerritories = 0;
  cleanupBoardTerritories();
  document.getElementById('boardgame-step').innerHTML = '';
  document.getElementById('territories-ui').innerHTML = '';
}
function cleanupBoardTerritories() {
  territoryLayers.forEach(l => map.removeLayer(l));
  territoryLayers = [];
  territoryMeta = [];
}

function startBoardPolygon() {
  drawnItems.clearLayers();
  boardLayer = null;
  cleanupBoardTerritories();
  new L.Draw.Polygon(map, { showArea:true }).enable();
  map.once(L.Draw.Event.CREATED, e => {
    boardLayer = e.layer;
    drawnItems.addLayer(boardLayer);
    document.getElementById('board-drawn').innerHTML = '<span style="color:#9fdada;">Board polygon drawn!</span>';
    promptNumTerritories();
  });
}

function startBoardRect() {
  drawnItems.clearLayers();
  boardLayer = null;
  cleanupBoardTerritories();
  new L.Draw.Rectangle(map).enable();
  map.once(L.Draw.Event.CREATED, e => {
    boardLayer = e.layer;
    drawnItems.addLayer(boardLayer);
    document.getElementById('board-drawn').innerHTML = '<span style="color:#9fdada;">Board rectangle drawn!</span>';
    promptNumTerritories();
  });
}

function promptNumTerritories() {
  showModal(`
    <form>
      <label>Step 2: Number of Territories</label><br/>
      <input type="number" min="2" max="20" id="n-territories" value="4" required/><br/><br/>
      <button type="submit">Generate Territories</button>
    </form>`, form => {
      numTerritories = +form.querySelector('#n-territories').value;
      if (numTerritories >= 2) {
        document.getElementById('territories-ui').innerHTML = `<p><b>${numTerritories}</b> territories generating...</p>`;
        setTimeout(splitBoardIntoTerritories, 300);
      }
    });
}

function randomPointsInPolygon(polygon, n) {
  const bbox = turf.bbox(polygon);
  const pts = [];
  while (pts.length < n) {
    const p = [Math.random()*(bbox[2]-bbox)+bbox, Math.random()*(bbox[3]-bbox[1])+bbox[1]];
    if (turf.booleanPointInPolygon(p, polygon)) pts.push(p);
  }
  return pts;
}

function splitBoardIntoTerritories() {
  cleanupBoardTerritories();
  if (!boardLayer) return;
  const geojson = boardLayer.toGeoJSON();
  const boardPoly = (geojson.geometry.type === "Polygon" || geojson.geometry.type === "MultiPolygon") ? geojson : turf.polygon(geojson.geometry.coordinates);
  const seedPoints = randomPointsInPolygon(boardPoly, numTerritories);
  const fc = turf.featureCollection(seedPoints.map(p => turf.point(p)));
  const voronoi = turf.voronoi(fc, {bbox: turf.bbox(boardPoly)});
  let count = 0;
  const colormap = ["#ECB390","#DF7861","#7F4F24","#B6C867","#6F9CEB","#8A2E83","#C1D0B5","#6497b1","#005b96","#e9967a","#b9b5d1","#62b6cb","#1b2845","#aa4465","#4e89ae","#22577a","#33a1fd","#e67059","#40916c","#ffd166"];
  for (let i=0; i<voronoi.features.length && count<numTerritories; i++) {
    const cell = voronoi.features[i];
    const clipped = turf.intersect(boardPoly, cell);
    if (!clipped) continue;
    count++;
    const coords = (clipped.geometry.type === "Polygon") ? clipped.geometry.coordinates : [clipped.geometry.coordinates];
    const color = colormap[count % colormap.length];
    const territory = L.polygon(coords, {color, fillColor: color, fillOpacity: 0.5, weight: 2}).addTo(map);
    territoryLayers.push(territory);
    territory.bindTooltip(`Territory ${count}`, {permanent:true, direction:"center", className:"territory-label"});
    territoryMeta.push({layer: territory, name: `Territory ${count}`, color});
  }
  setupTerritoryEditor();
}

function setupTerritoryEditor() {
  const container = document.getElementById('territories-ui');
  container.innerHTML = territoryMeta.map((t, i) => `
    <div class='territory-edit-row'>
      <input type='text' value='${t.name}' data-i='${i}' />
      <input type='color' value='${t.color}' data-i='${i}' />
      <span>Territory ${i+1}</span>
    </div>
  `).join('');
  
  container.querySelectorAll("input[type=text]").forEach(inp => {
    inp.addEventListener('input', e => {
      const i = e.target.dataset.i;
      territoryMeta[i].name = e.target.value;
      const layer = territoryMeta[i].layer;
      layer.unbindTooltip();
      layer.bindTooltip(e.target.value, {permanent:true, direction:"center", className:"territory-label"}).openTooltip();
    });
  });
  
  container.querySelectorAll("input[type=color]").forEach(inp => {
    inp.addEventListener('input', e => {
      const i = e.target.dataset.i;
      territoryMeta[i].color = e.target.value;
      const layer = territoryMeta[i].layer;
      layer.setStyle({color: e.target.value, fillColor: e.target.value});
    });
  });
}
