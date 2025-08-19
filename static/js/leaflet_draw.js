// Initialize the Leaflet map and drawing controls
const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    poly: {
      allowIntersection: false,
    },
  },
  draw: {
    polygon: true,
    polyline: true,
    rectangle: true,
    circle: true,
    marker: true,
    circlemarker: false,
  },
});
map.addControl(drawControl);

// Territory metadata store: key = layer id, value = {name: string, style: object, layer: L.Layer}
const territories = new Map();

function promptForName(defaultName = '') {
  return prompt("Enter territory name:", defaultName);
}

function applyStyle(layer, style) {
  if (layer.setStyle) layer.setStyle(style);
}

// When new shape is created
map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  const name = promptForName("Territory");
  const defaultStyle = {
    color: '#3388ff',
    fillColor: '#3388ff',
    fillOpacity: 0.4,
    weight: 2,
  };
  applyStyle(layer, defaultStyle);
  layer.bindTooltip(name, { permanent: true, direction: 'center', className: 'territory-label' }).openTooltip();

  drawnItems.addLayer(layer);
  territories.set(layer._leaflet_id, { name, style: defaultStyle, layer });

  updateTerritoriesList();
});

// When existing shapes edited
map.on(L.Draw.Event.EDITED, e => {
  e.layers.eachLayer(layer => {
    // Can add logic if needed to update state
    updateTerritoriesList();
  });
});

// When shapes deleted
map.on(L.Draw.Event.DELETED, e => {
  e.layers.eachLayer(layer => {
    territories.delete(layer._leaflet_id);
  });
  updateTerritoriesList();
});

// Expose globally for main.js
window.map = map;
window.drawnItems = drawnItems;
window.territories = territories;

// UI update function placeholder, will be implemented in main.js
function updateTerritoriesList() {}
window.updateTerritoriesList = updateTerritoriesList;
