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
    const searchInput = document.getElementById('searchInput');
    const exportDataButton = document.getElementById('exportDataButton');
    const importDataButton = document.getElementById('importDataButton');
    const importFileInput = document.getElementById('importFileInput');

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
                address: store.address || ""
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
        markers.clearLayers();
        const showUnvisited = showUnvisitedCheckbox ? showUnvisitedCheckbox.checked : true;
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (allMcDonaldsLocations.length === 0) {
            console.warn("No McDonald's locations loaded to render.");
            return;
        }

        let filteredLocations = allMcDonaldsLocations;

        if (searchTerm) {
            filteredLocations = allMcDonaldsLocations.filter(mcdo =>
                mcdo.name.toLowerCase().includes(searchTerm) ||
                (mcdo.address && mcdo.address.toLowerCase().includes(searchTerm))
            );
        }

        let markersAddedToCluster = [];

        filteredLocations.forEach(mcdo => {
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
            markers.addLayer(marker);
            markersAddedToCluster.push(marker);
        });
        // Ensure the cluster group is added to the map.
        // If it's already added, this won't cause issues.
        // If it's the first render, it will add it.
        map.addLayer(markers);

        if (searchTerm && markersAddedToCluster.length === 1) {
            // Only one store. Zoom into the store and open the pop-up
            const singleMarker = markersAddedToCluster[0];
            markers.zoomToShowLayer(singleMarker, () => {
                singleMarker.openPopup();
            });
        } else if (searchTerm && markersAddedToCluster.length > 1) {
            // If multiple matched, adjust the zoom level so that matched ones fit.
            const groupForBounds = L.featureGroup(markersAddedToCluster);
            if (groupForBounds.getLayers().length > 0) { // Make sure there is a valid layer
                 map.fitBounds(groupForBounds.getBounds(), { padding: [50, 50] });
            }
        }
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

    function exportVisitedData() {
        const dataToExport = Array.from(visitedMcDonaldsIds);
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date();
        const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        a.download = `mcdonalds_visited_jp_${dateString}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (sideMenu) sideMenu.classList.remove('open');
        alert("訪問データがエクスポートされました。ダウンロードフォルダを確認してください。");
    }

    function triggerImportFile() {
        if (importFileInput) importFileInput.click();
        if (sideMenu) sideMenu.classList.remove('open');
    }

    function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log("No file selected for import.");
            return;
        }
        if (file.type !== "application/json") {
            alert("無効なファイル形式です。JSONファイルを選択してください。");
            if (importFileInput) importFileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    throw new Error("Imported JSON is not an array.");
                }
                let newStoresAddedCount = 0;
                importedData.forEach(id => {
                    if (typeof id === 'string' || typeof id === 'number') {
                        const storeIdStr = String(id);
                        if (!visitedMcDonaldsIds.has(storeIdStr)) {
                            visitedMcDonaldsIds.add(storeIdStr);
                            newStoresAddedCount++;
                        }
                    } else {
                        console.warn("Skipping invalid ID during import:", id);
                    }
                });
                saveVisitedStores();
                renderMarkers();
                alert(`${importedData.length} 件のIDがファイルから読み込まれ、${newStoresAddedCount} 件の新しい店舗が訪問記録に追加されました。`);
            } catch (err) {
                console.error("Error importing data:", err);
                alert("データのインポート中にエラーが発生しました。ファイルが正しい形式（訪問した店舗IDの配列）であることを確認してください。");
            } finally {
                if (importFileInput) importFileInput.value = '';
            }
        };
        reader.onerror = () => {
            console.error("Error reading file for import.");
            alert("ファイルの読み込み中にエラーが発生しました。");
            if (importFileInput) importFileInput.value = '';
        };
        reader.readAsText(file);
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
    if (exportDataButton) {
        exportDataButton.addEventListener('click', exportVisitedData);
    }
    if (importDataButton) {
        importDataButton.addEventListener('click', triggerImportFile);
    }
    if (importFileInput) {
        importFileInput.addEventListener('change', handleImportFile);
    }
    if (searchInput) { // New event listener for search
        searchInput.addEventListener('input', () => { // 'input' event triggers on any change, including clearing
            renderMarkers();
        });
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
        // map.addLayer(markers); // markerClusterGroupはrenderMarkers内で必要に応じて追加される
        renderMarkers();
        updateVisitedCount();
    }

    initializeApp();
});
