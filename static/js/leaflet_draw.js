const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap contributors',
}).addTo(map);
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
// Make these globally available for main.js
window.map = map;
window.drawnItems = drawnItems;
