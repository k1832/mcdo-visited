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

    const mapViewButton = document.getElementById('mapViewButton');
    const listViewButton = document.getElementById('listViewButton');
    const mapViewContainer = document.getElementById('mapViewContainer');
    const storeListViewContainer = document.getElementById('storeListViewContainer');
    const mapElement = document.getElementById('map'); // The actual map div

    const classNameButtonMarkVisited = "button-mark-visited";
    const classNameButtonMarkUnvisited = "button-mark-unvisited";


    // --- Map Initialization ---
    const map = L.map(mapElement).setView(initialCenter, initialZoom); // Initialize map on the specific div
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- App State ---
    let allMcDonaldsLocations = [];
    let visitedMcDonaldsIds = new Set();
    let markers = L.markerClusterGroup();
    let currentView = 'map'; // 'map' or 'list'

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
    }

    function saveVisitedStores() {
        localStorage.setItem('visitedMcDonaldsIds_jp', JSON.stringify(Array.from(visitedMcDonaldsIds)));
    }

    function findMarkerById(storeId) {
        let foundMarker = null;
        markers.eachLayer(layer => {
            if (layer.options && String(layer.options.mcdoId) === String(storeId)) {
                foundMarker = layer;
            }
        });
        return foundMarker;
    }

    function getPopupContent(mcdo, isVisited) {
        let popupContent = `<b>${mcdo.name}</b><br>`;
        if (mcdo.address) popupContent += `${mcdo.address}<br><br>`;
        popupContent += isVisited ?
            `この店舗は訪問済みです！<br><button class="${classNameButtonMarkUnvisited}" onclick="markAsUnvisited('${mcdo.id}')">訪問記録を取り消す</button>` :
            `この店舗はまだ未訪問です。<br><button class="${classNameButtonMarkVisited}" onclick="markAsVisited('${mcdo.id}')">この店舗を訪問済みにする！</button>`;
        return popupContent
    }

    function updateMarker(marker, mcdo, isVisited) {
        marker.setIcon(isVisited ? visitedIcon : unvisitedIcon);
        const popupContent = getPopupContent(mcdo, isVisited);
        marker.setPopupContent(popupContent);
    }

    function renderMarkers(storeToFocus=null) {
        markers.clearLayers();
        const showUnvisited = showUnvisitedCheckbox ? showUnvisitedCheckbox.checked : true;
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (allMcDonaldsLocations.length === 0) {
            console.warn("No McDonald's locations loaded to render for map.");
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
            if (!showUnvisited && !isVisited) return;

            const lat = parseFloat(mcdo.lat);
            const lng = parseFloat(mcdo.lng);
            if (isNaN(lat) || isNaN(lng)) {
                console.warn(`Invalid coordinates for store ${mcdo.name} (ID: ${mcdo.id}): ${mcdo.lat}, ${mcdo.lng}`);
                return;
            }

            const popupContent = getPopupContent(mcdo);
            const markerIcon = isVisited ? visitedIcon : unvisitedIcon;
            const marker = L.marker([lat, lng], { icon: markerIcon, mcdoId: mcdo.id });
            marker.bindPopup(popupContent);
            markers.addLayer(marker);
            markersAddedToCluster.push(marker);
        });

        if (!map.hasLayer(markers)) { // Add cluster group to map if not already present
            map.addLayer(markers);
        }

        if (storeToFocus) {
            const targetMarker = findMarkerById(storeToFocus.id);
            if (targetMarker) {
                markers.zoomToShowLayer(targetMarker, () => targetMarker.openPopup());
            }
            // TODO(k1832): Handle an error where the target marker wasn't found
        } else if (searchTerm && markersAddedToCluster.length === 1) {
            const singleMarker = markersAddedToCluster[0];
            markers.zoomToShowLayer(singleMarker, () => singleMarker.openPopup());
        } else if (searchTerm && markersAddedToCluster.length > 1) {
            const groupForBounds = L.featureGroup(markersAddedToCluster);
            if (groupForBounds.getLayers().length > 0) {
                map.fitBounds(groupForBounds.getBounds(), { padding: [50, 50] });
            }
        }
    }

    function renderStoreList() {
        storeListViewContainer.innerHTML = ''; // Clear previous list
        const showUnvisited = showUnvisitedCheckbox ? showUnvisitedCheckbox.checked : true;
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (allMcDonaldsLocations.length === 0) {
            storeListViewContainer.innerHTML = '<p style="text-align:center; padding: 20px;">店舗データがありません。</p>';
            return;
        }

        let filteredLocations = allMcDonaldsLocations;
        if (searchTerm) {
            filteredLocations = allMcDonaldsLocations.filter(mcdo =>
                mcdo.name.toLowerCase().includes(searchTerm) ||
                (mcdo.address && mcdo.address.toLowerCase().includes(searchTerm))
            );
        }

        const ul = document.createElement('ul');
        ul.className = 'store-items-list';

        let storesToListCount = 0;
        filteredLocations.forEach(mcdo => {
            const isVisited = visitedMcDonaldsIds.has(mcdo.id);
            if (!showUnvisited && !isVisited) return;
            storesToListCount++;

            const li = document.createElement('li');
            li.className = 'store-item' + (isVisited ? ' visited' : '');
            li.dataset.storeId = mcdo.id;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'store-item-name';
            nameDiv.textContent = mcdo.name;
            li.appendChild(nameDiv);

            const addressDiv = document.createElement('div');
            addressDiv.className = 'store-item-address';
            addressDiv.textContent = mcdo.address || '住所情報なし';
            li.appendChild(addressDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'store-item-actions';

            const visitButton = document.createElement('button');
            visitButton.textContent = isVisited ? '訪問記録を取り消す' : 'この店舗を訪問済みにする！';

            if (isVisited) {
                visitButton.classList.add(classNameButtonMarkUnvisited);
            } else {
                visitButton.classList.add(classNameButtonMarkVisited);
            }

            visitButton.onclick = (e) => {
                e.stopPropagation(); // Prevent li click if any
                isVisited ? window.markAsUnvisited(mcdo.id) : window.markAsVisited(mcdo.id);
            };
            actionsDiv.appendChild(visitButton);

            const showOnMapButton = document.createElement('button');
            showOnMapButton.textContent = '地図で表示';
            showOnMapButton.className = 'show-on-map-button';
            showOnMapButton.onclick = (e) => {
                e.stopPropagation();
                switchToMapView(mcdo);
            };
            actionsDiv.appendChild(showOnMapButton);
            li.appendChild(actionsDiv);
            ul.appendChild(li);
        });

        if (storesToListCount === 0) {
            storeListViewContainer.innerHTML = searchTerm ?
                '<p style="text-align:center; padding: 20px;">検索条件に一致する店舗はありません。</p>' :
                '<p style="text-align:center; padding: 20px;">表示する店舗はありません。</p>';
        } else {
            storeListViewContainer.appendChild(ul);
        }
    }

    function updateUI(storeToFocus=null) {
        if (currentView === 'map') {
            renderMarkers(storeToFocus);
        } else {
            renderStoreList();
        }
        updateVisitedCount();
    }

    window.markAsVisited = function(mcdoId) {
        visitedMcDonaldsIds.add(String(mcdoId));
        saveVisitedStores();
        updateVisitedCount();

        // Don't use renderMarkers as it resets the zoom level and stuff
        if (currentView === 'map') {
            const mcdo = allMcDonaldsLocations.find(s => s.id === mcdoId);
            const marker = findMarkerById(mcdoId);
            if (marker && mcdo) {
                updateMarker(marker, mcdo, true);
            }
            map.closePopup();
        } else {
            renderStoreList();
        }
    }

    window.markAsUnvisited = function(mcdoId) {
        visitedMcDonaldsIds.delete(String(mcdoId));
        saveVisitedStores();
        updateVisitedCount();

        // Don't use renderMarkers as it resets the zoom level and stuff
        if (currentView === 'map') {
            const mcdo = allMcDonaldsLocations.find(s => s.id === mcdoId);
            const marker = findMarkerById(mcdoId);
            if (marker && mcdo) {
                updateMarker(marker, mcdo, false);
            }
            map.closePopup();
        } else {
            renderStoreList();
        }
    }

    function eraseAllData() {
        const confirmed = window.confirm("日本の全訪問履歴を本当に消去しますか？");
        if (confirmed) {
            visitedMcDonaldsIds.clear();
            saveVisitedStores();
            updateUI(); // Update current view and count
            if (sideMenu) sideMenu.classList.remove('open');
            alert("全ての訪問データが消去されました。");
        }
    }

    function switchToMapView(storeToFocus=null) {
        currentView = 'map';
        mapViewContainer.style.display = 'block';
        storeListViewContainer.style.display = 'none';
        mapViewButton.classList.add('active');
        listViewButton.classList.remove('active');
        map.invalidateSize(); // VERY IMPORTANT for Leaflet
        updateUI(storeToFocus);
    }

    function switchToListView() {
        currentView = 'list';
        mapViewContainer.style.display = 'none';
        storeListViewContainer.style.display = 'block';
        mapViewButton.classList.remove('active');
        listViewButton.classList.add('active');
        updateUI();
    }

    // --- Event Listeners ---
    if (mapViewButton) mapViewButton.addEventListener('click', switchToMapView);
    if (listViewButton) listViewButton.addEventListener('click', switchToListView);

    if (showUnvisitedCheckbox) showUnvisitedCheckbox.addEventListener('change', updateUI);
    if (searchInput) searchInput.addEventListener('input', () => {
        // Debounce search input slightly to avoid too frequent rendering on fast typing
        // For simplicity, not adding debounce here, but consider for performance with large lists.
        updateUI();
    });

    if (hamburgerButton) {
        hamburgerButton.addEventListener('click', (event) => {
            event.stopPropagation();
            if (sideMenu) sideMenu.classList.toggle('open');
        });
    }

    if (eraseDataButton) { eraseDataButton.addEventListener('click', eraseAllData); }

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
                saveVisitedStores(); // save first
                updateUI();          // then update UI which includes count
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

    if (exportDataButton) exportDataButton.addEventListener('click', exportVisitedData);
    if (importDataButton) importDataButton.addEventListener('click', triggerImportFile);
    if (importFileInput) importFileInput.addEventListener('change', handleImportFile);

    document.addEventListener('click', (event) => { /* ... for closing side menu ... */
        if (sideMenu && hamburgerButton && !sideMenu.contains(event.target) && !hamburgerButton.contains(event.target)) {
            sideMenu.classList.remove('open');
        }
    });


    async function initializeApp() {
        loadVisitedStores(); // Load visited history first
        await loadStoreData(); // Then load all store locations

        // --- Start of synchronization logic with user notification ---
        let removedItemsCount = 0; // To count how many items are removed

        // IMPORTANT: API call may fail for some reason and the response list
        // may be empty. Only check the visited IDs when both of the lists
        // are not empty.
        if (visitedMcDonaldsIds.size > 0 && allMcDonaldsLocations.length > 0) {
            const currentStoreIdsFromAPI = new Set(allMcDonaldsLocations.map(store => store.id));

            // It's safer to collect IDs to remove first if modifying the Set
            // you are iterating over with forEach, or use a different iteration method.
            // However, for `Set.forEach`, direct deletion is generally fine.
            visitedMcDonaldsIds.forEach(savedId => {
                if (!currentStoreIdsFromAPI.has(savedId)) {
                    visitedMcDonaldsIds.delete(savedId);
                    console.log(`Removed outdated store ID: ${savedId} from local storage.`);
                    ++removedItemsCount;
                }
            });

            if (removedItemsCount) {
                saveVisitedStores(); // Save the updated set to local storage
            }
        }

        switchToMapView(); // This will call updateUI, which includes updateVisitedCount

        // --- Notify user after initial UI is ready or updated ---
        if (removedItemsCount) {
            // Using setTimeout to ensure this alert doesn't block rendering and appears after the page is more settled.
            setTimeout(() => {
                alert(`${removedItemsCount} 件の訪問記録が、店舗リストの更新（例：店舗の閉鎖・移転や店名変更など）に伴い、あなたの訪問リストから自動的に削除されました(T_T)`);
            }, 100); // A small delay can improve UX.
        }
    }

    initializeApp();
});
