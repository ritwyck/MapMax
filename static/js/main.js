const map = window.map;
const drawnItems = window.drawnItems;
const territories = window.territories;

const points = [];
const pointMarkers = L.layerGroup().addTo(map);

const pointsListEl = document.getElementById('points-list');
const territoriesListEl = document.getElementById('territories-list');
const messageEl = document.getElementById('message');
const clearAllBtn = document.getElementById('clear-all');
const searchInput = document.getElementById('location-search');
const autocompleteResults = document.getElementById('autocomplete-results');

function rgbToHex(rgb) {
  if (!rgb) return '#3388ff';
  const parts = rgb.match(/\d+/g);
  if (!parts) return '#3388ff';
  return '#' + parts.map(x => (+x).toString(16).padStart(2, '0')).join('');
}

function updateTerritoriesList() {
  territoriesListEl.innerHTML = '';
  territories.forEach(({ name, style, layer }, id) => {
    const div = document.createElement('div');
    div.className = 'territory-item';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = name || '';
    nameInput.onchange = e => {
      const newName = e.target.value.trim() || 'Territory';
      territories.get(id).name = newName;
      layer.unbindTooltip();
      layer.bindTooltip(newName, { permanent: true, direction: 'center', className: 'territory-label' }).openTooltip();
    };
    div.appendChild(nameInput);

    // Color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = rgbToHex(style.fillColor);
    colorInput.oninput = e => {
      const newColor = e.target.value;
      territories.get(id).style.fillColor = newColor;
      layer.setStyle({ fillColor: newColor });
    };
    div.appendChild(colorInput);

    territoriesListEl.appendChild(div);
  });
}

window.updateTerritoriesList = updateTerritoriesList;
updateTerritoriesList();

function updatePointsList() {
  pointsListEl.innerHTML = '';
  points.forEach(({ name, lat, lon }, idx) => {
    const div = document.createElement('div');
    div.className = 'point-item';
    div.textContent = `${name || 'Point'} [${lat.toFixed(5)}, ${lon.toFixed(5)}]`;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.onclick = () => {
      points.splice(idx, 1);
      updateMap();
    };
    div.appendChild(btn);
    pointsListEl.appendChild(div);
  });

  if (points.length < 2) {
    messageEl.textContent = 'Add at least two points to calculate midpoints.';
  } else {
    messageEl.textContent = `Selected ${points.length} points. Calculating midpoints...`;
  }
}

function updateMap() {
  pointMarkers.clearLayers();

  points.forEach(({ lat, lon, name }) => {
    const marker = L.marker([lat, lon]);
    if (name) marker.bindPopup(name);
    marker.addTo(pointMarkers);
  });

  updatePointsList();
}

// Adding points via map click
map.on('click', e => {
  points.push({ lat: e.latlng.lat, lon: e.latlng.lng, name: 'Clicked Location' });
  updateMap();
});

// Clear all
clearAllBtn.onclick = () => {
  points.length = 0;
  updateMap();
  drawnItems.clearLayers();
  territories.clear();
  territoriesListEl.innerHTML = '';
  messageEl.textContent = 'Cleared all points and territories';
  autocompleteResults.innerHTML = '';
  autocompleteResults.hidden = true;
  searchInput.value = '';
};

// Autocomplete search box
let debounceTimer;
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (query.length < 3) {
    autocompleteResults.innerHTML = '';
    autocompleteResults.hidden = true;
    return;
  }
  
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch('/geocode?q=' + encodeURIComponent(query))
      .then(resp => resp.json())
      .then(data => {
        autocompleteResults.innerHTML = '';
        if (!data.length) {
          autocompleteResults.hidden = true;
          return;
        }
        data.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item.display_name;
          li.onclick = () => {
            points.push({ lat: item.lat, lon: item.lon, name: item.display_name });
            updateMap();
            map.setView([item.lat, item.lon], 8);
            autocompleteResults.innerHTML = '';
            autocompleteResults.hidden = true;
            searchInput.value = '';
          };
          autocompleteResults.appendChild(li);
        });
        autocompleteResults.hidden = false;
      })
      .catch(() => {
        autocompleteResults.innerHTML = '';
        autocompleteResults.hidden = true;
      });
  }, 300);
});

document.addEventListener('click', e => {
  if (!searchInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
    autocompleteResults.hidden = true;
  }
});
