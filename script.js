document.addEventListener('DOMContentLoaded', async () => {
    // --- Configuration ---
    const initialCenter = [35.6895, 139.6917]; // Tokyo
    const initialZoom = 10;
    const visitedIconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png';
    const unvisitedIconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png';
    const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png';
    const jsonStoreDataUrl = 'https://k1832.github.io/mcdo-api/api/v1/store-location.json';

    // --- DOM Elements ---
    const visitedCountElement = document.getElementById('visitedCount');
    const hamburgerButton = document.getElementById('hamburgerButton');
    const sideMenu = document.getElementById('sideMenu');
    const eraseDataButton = document.getElementById('eraseDataButton');
    const showUnvisitedCheckbox = document.getElementById('showUnvisitedCheckbox');

    // --- Map Initialization ---
    const map = L.map('map').setView(initialCenter, initialZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- App State ---
    let allMcDonaldsLocations = [];
    let visitedMcDonaldsIds = new Set();
    let markers = L.markerClusterGroup(); // Use MarkerClusterGroup

    // --- Icon Definitions ---
    const createIcon = (iconUrl) => {
        return L.icon({
            iconUrl: iconUrl,
            shadowUrl: shadowUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    };
    const visitedIcon = createIcon(visitedIconUrl);
    const unvisitedIcon = createIcon(unvisitedIconUrl);

    // --- Functions ---
    async function loadStoreData() {
        try {
            const response = await fetch(jsonStoreDataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching ${jsonStoreDataUrl}`);
            }
            const jsonData = await response.json();
            allMcDonaldsLocations = jsonData.map(store => ({
                id: String(store.id),
                name: store.name,
                lat: store.latitude,
                lng: store.longitude,
                address: store.address
            }));
            console.log(`${allMcDonaldsLocations.length} stores loaded from API: ${jsonStoreDataUrl}`);
        } catch (error) {
            console.error("Could not load McDonald's store data from API:", error);
            alert(`店舗データの読み込みエラー (API: ${jsonStoreDataUrl})。詳細はコンソールを確認してください。APIがダウンしているか、ネットワークに問題がある可能性があります。`);
        }
    }

    function updateVisitedCount() {
        if (visitedCountElement) {
            visitedCountElement.textContent = visitedMcDonaldsIds.size;
        }
    }

    function loadVisitedStores() {
        const storedVisited = localStorage.getItem('visitedMcDonaldsIds_jp');
        if (storedVisited) {
            visitedMcDonaldsIds = new Set(JSON.parse(storedVisited));
        }
        updateVisitedCount();
    }

    function saveVisitedStores() {
        localStorage.setItem('visitedMcDonaldsIds_jp', JSON.stringify(Array.from(visitedMcDonaldsIds)));
        updateVisitedCount();
    }

    function renderMarkers() {
        markers.clearLayers(); // Clear layers from the markerClusterGroup
        const showUnvisited = showUnvisitedCheckbox ? showUnvisitedCheckbox.checked : true;

        if (allMcDonaldsLocations.length === 0) {
            console.warn("No McDonald's locations loaded to render. If you just started, data might still be fetching from the API.");
            return;
        }

        allMcDonaldsLocations.forEach(mcdo => {
            const isVisited = visitedMcDonaldsIds.has(mcdo.id);

            if (!showUnvisited && !isVisited) {
                return;
            }

            const markerIcon = isVisited ? visitedIcon : unvisitedIcon;
            const lat = parseFloat(mcdo.lat);
            const lng = parseFloat(mcdo.lng);

            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`Invalid coordinates for store ${mcdo.name} (ID: ${mcdo.id}): ${mcdo.lat}, ${mcdo.lng}`);
                return;
            }

            const marker = L.marker([lat, lng], { icon: markerIcon, mcdoId: mcdo.id });

            let popupContent = `<b>${mcdo.name}</b><br>`;
            if (mcdo.address) {
                 popupContent += `${mcdo.address}<br><br>`;
            }

            if (isVisited) {
                popupContent += 'この店舗は訪問済みです！';
                popupContent += `<br><button onclick="markAsUnvisited('${mcdo.id}')">訪問記録を取り消す</button>`;
            } else {
                popupContent += 'この店舗はまだ未訪問です。';
                popupContent += `<br><button onclick="markAsVisited('${mcdo.id}')">この店舗を訪問済みにする！</button>`;
            }
            marker.bindPopup(popupContent);
            markers.addLayer(marker); // Add marker to the markerClusterGroup
        });
        // Ensure the cluster group is added to the map.
        // If it's already added, this won't cause issues.
        // If it's the first render, it will add it.
        map.addLayer(markers);
    }

    window.markAsVisited = function(mcdoId) {
        visitedMcDonaldsIds.add(String(mcdoId));
        saveVisitedStores();
        renderMarkers();
        map.closePopup();
    }

    window.markAsUnvisited = function(mcdoId) {
        visitedMcDonaldsIds.delete(String(mcdoId));
        saveVisitedStores();
        renderMarkers();
        map.closePopup();
    }

    function eraseAllData() {
        const confirmed = window.confirm("日本の全訪問履歴を本当に消去しますか？");
        if (confirmed) {
            visitedMcDonaldsIds.clear();
            saveVisitedStores();
            renderMarkers();
            if (sideMenu) sideMenu.classList.remove('open');
            alert("全ての訪問データが消去されました。");
        }
    }

    // --- Event Listeners ---
    if (showUnvisitedCheckbox) {
        showUnvisitedCheckbox.addEventListener('change', renderMarkers);
    }

    if (hamburgerButton) {
        hamburgerButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (sideMenu) sideMenu.classList.toggle('open');
        });
    }

    if (eraseDataButton) {
        eraseDataButton.addEventListener('click', eraseAllData);
    }

    document.addEventListener('click', (event) => {
        if (sideMenu && hamburgerButton && !sideMenu.contains(event.target) && !hamburgerButton.contains(event.target)) {
            sideMenu.classList.remove('open');
        }
    });

    // --- Initial Load ---
    async function initializeApp() {
        loadVisitedStores();
        await loadStoreData();
        map.addLayer(markers); // Add the marker cluster group to the map
        renderMarkers();       // Initial rendering of markers into the cluster group
        updateVisitedCount();
    }

    initializeApp();
});
