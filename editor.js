/**
 * Xeno Hive Level Editor Logic
 */

const ASSET_LIST = [
    // Colonists
    'colonist-idle.png', 'colonist-walk-a.png', 'colonist-walk-b.png', 'colonist-dead.png', 'colonist-infected.png',
    'colonist-confused.png', 'colonist-panic.png', 'colonist-panic-a.png', 'colonist-panic-b.png',
    'colonist-captured-a.png', 'colonist-captured-b.png',
    // Corpo
    'corpo-idle.png', 'corpo-walk-a.png', 'corpo-walk-b.png', 'corpo-infected.png',
    'corpo-confused.png', 'corpo-panic.png', 'corpo-panic-a.png',
    // Marine
    'marine-idle.png', 'marine-walk-a.png', 'marine-walk-b.png', 'marine-dead.png', 'marine-infected.png',
    'marine-confused.png',
    // Specialist
    'specialist-idle.png', 'specialist-walk-a.png', 'specialist-walk-b.png', 'specialist-dead.png', 'specialist-infected.png',
    'specialist-confused.png', 'specialist-panic.png', 'specialist-panic-a.png', 'specialist-panic-b.png',
    'specialist-armed-idle.png', 'specialist-armed-walk-a.png', 'specialist-armed-walk-b.png',
    // Synth
    'synth-idle.png', 'synth-walk-a.png', 'synth-walk-b.png', 'synth-dead.png',
    'synth-panic.png', 'synth-panic-a.png', 'synth-panic-b.png',
    // Xeno - Drone
    'xeno-drone-idle.png', 'xeno-drone-walk-a.png', 'xeno-drone-walk-b.png',
    // Xeno - Warrior
    'xeno-warrior-idle.png', 'xeno-warrior-walk-a.png', 'xeno-warrior-walk-b.png', 'xeno-warrior-attack.png',
    // Xeno - Queen
    'xeno-queen-idle.png', 'xeno-queen-walk-a.png', 'xeno-queen-walk-b.png', 'xeno-queen-eggs.png',
    // Xeno - Lifecycle
    'xeno-egg-a.png', 'xeno-egg-b.png', 'xeno-facehugger-walk-a.png', 'xeno-facehugger-walk-b.png',
    'xeno-chestburster.png', 'xeno-chestburster-cocoon.png',
    // Props
    'prop-resin.png', 'prop-hive-nest.png', 'prop-specimen-tank.png', 'prop-medical-vat.png', 'prop-synth-vat.png',
    // Floor tiles
    'tile-floor-corridor.png', 'tile-floor-room.png', 'tile-floor-warning.png',
    // Wall tiles
    'tile-wall-corner-tl.png', 'tile-wall-corner-tr.png', 'tile-wall-corner-bl.png', 'tile-wall-corner-br.png',
    'tile-wall-corner-bl-alt.png', 'tile-wall-corner-br-alt.png',
    'tile-wall-edge-top.png', 'tile-wall-edge-top-v2.png', 'tile-wall-edge-side.png', 'tile-wall-edge-h-alt.png',
    'tile-wall-inner-l.png', 'tile-wall-inner-r.png',
    // Door tiles
    'tile-door-h-closed.png', 'tile-door-h-closed-l.png', 'tile-door-h-closed-r.png', 'tile-door-h-open.png',
    'tile-door-v-closed.png', 'tile-door-v-open-t.png', 'tile-door-v-open-b.png',
    // Wall interactives
    'tile-wall-keypad.png', 'tile-wall-switch-up.png', 'tile-wall-switch-down.png',
    'tile-wall-button-green-on.png', 'tile-wall-button-green-off.png',
    'tile-wall-button-red-on.png', 'tile-wall-button-red-off.png',
    // Wall panels
    'tile-wall-panel-duct.png', 'tile-wall-panel-grill.png', 'tile-wall-panel-open.png',
    'tile-wall-panel-cover.png', 'tile-wall-panel-cover-bolted.png'
];

class Editor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.sprites = {};

        // Editor State
        this.objects = []; // { id, sprite, x, y, type: 'tile'|'entity', props: {} }
        this.groups = [];  // { id, name, children: [objIds] }
        this.wires = [];   // { id, sourceId, targetId }

        this.selectedIds = [];
        this.selectedGroupId = null; // New state for tracking group selection
        this.prefabs = []; // Array of saved bundles
        this.activeTool = 'select'; // 'select', 'place', 'wire', 'erase'
        this.activeSprite = null; // Currently selected sprite from library
        this.editorMode = 'terrain'; // 'terrain' or 'logic'

        // View State
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.tileSize = parseInt(document.getElementById('grid-size').value, 10);

        // Interaction state
        this.isDraggingView = false;
        this.isDraggingObject = false;
        this.isWiring = false;
        this.wireStartObj = null;
        this.lastMouse = { x: 0, y: 0 };
        this.mouseX = 0;
        this.mouseY = 0;

        this.showWalkOverlay = false; // Walkability overlay toggle

        // Undo history
        this.history = [];
        this.maxHistory = 50;

        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        await this.loadAssets();

        // Auto-detect tile size from the first tile sprite loaded
        const tileSprite = this.sprites['tile-floor-room.png'] || this.sprites['tile-wall-edge-top.png'];
        if (tileSprite) {
            this.tileSize = tileSprite.naturalWidth;
            document.getElementById('grid-size').value = this.tileSize;
        }

        this.populateLibrary();
        this.setupEventListeners();

        this.loop();
    }

    async loadAssets() {
        const promises = ASSET_LIST.map(name => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.sprites[name] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Asset missing: sprites/${name}`);
                    resolve(); // Resolve anyway so the app doesn't hang
                };
                img.src = `sprites/${name}`;
            });
        });
        await Promise.all(promises);
    }

    populateLibrary() {
        const list = document.getElementById('sprite-list');
        list.innerHTML = '';

        // Group sprites by prefix
        const groups = {};

        ASSET_LIST.sort().forEach(name => {
            let folderName = 'Uncategorized';

            if (name.startsWith('tile-')) {
                // e.g. tile-door-horizontal... -> 'Tile - Door'
                const parts = name.split('-');
                if (parts.length > 2) {
                    folderName = 'Tile - ' + parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
                } else {
                    folderName = 'Tiles';
                }
            } else {
                // e.g. xeno-drone-idle -> 'Xeno'
                const parts = name.split('-');
                folderName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }

            if (!groups[folderName]) groups[folderName] = [];
            groups[folderName].push(name);
        });

        // Render groups
        Object.keys(groups).sort().forEach(folderName => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'library-folder';
            folderDiv.innerHTML = `<span class="folder-icon">▶</span> ${folderName}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'library-folder-content grid-view';

            folderDiv.onclick = () => {
                const isOpen = contentDiv.classList.contains('open');
                if (isOpen) {
                    contentDiv.classList.remove('open');
                    folderDiv.querySelector('.folder-icon').classList.remove('open');
                } else {
                    contentDiv.classList.add('open');
                    folderDiv.querySelector('.folder-icon').classList.add('open');
                }
            };

            groups[folderName].forEach(name => {
                const div = document.createElement('div');
                div.className = 'sprite-item';
                div.title = name;
                div.dataset.name = name; // For search filtering

                const img = document.createElement('img');
                img.src = `sprites/${name}`;
                div.appendChild(img);

                // Show sprite name below thumbnail
                const label = document.createElement('span');
                label.className = 'sprite-label';
                label.textContent = name.replace('.png', '').replace(/^(tile-|prop-)/, '');
                div.appendChild(label);

                div.addEventListener('click', () => {
                    document.querySelectorAll('.sprite-item').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    this.activeSprite = name;
                    this.setTool('place');
                });

                div.draggable = true;
                div.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'sprite', sprite: name }));
                };

                contentDiv.appendChild(div);
            });

            list.appendChild(folderDiv);
            list.appendChild(contentDiv);
        });
    }

    switchTab(tabName) {
        document.getElementById('tab-sprites').classList.remove('active');
        document.getElementById('tab-prefabs').classList.remove('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');

        document.getElementById('sprites-container').style.display = tabName === 'sprites' ? 'flex' : 'none';
        document.getElementById('prefabs-container').style.display = tabName === 'prefabs' ? 'flex' : 'none';
    }

    renderPrefabs() {
        const list = document.getElementById('prefab-list');
        list.innerHTML = '';
        this.prefabs.forEach(prefab => {
            const div = document.createElement('div');
            div.className = 'prefab-item';

            // Assume the first child object represents the icon visually
            const firstSprite = prefab.blueprint.objects[0]?.sprite || 'tile-warning.png';

            div.innerHTML = `
                <div class="prefab-icon" style="background-image: url('sprites/${firstSprite}')"></div>
                <div>${prefab.name}</div>
            `;

            // HTML5 Drag and drop to canvas
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'prefab', id: prefab.id }));
            };

            list.appendChild(div);
        });
    }

    resize() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setupEventListeners() {
        // Toolbar tools
        document.getElementById('tool-select').onclick = () => this.setTool('select');
        document.getElementById('tool-place').onclick = () => this.setTool('place');
        document.getElementById('tool-wire').onclick = () => this.setTool('wire');
        document.getElementById('tool-erase').onclick = () => this.setTool('erase');

        // Grid config
        document.getElementById('grid-size').addEventListener('change', (e) => {
            this.tileSize = parseInt(e.target.value, 10);
        });

        // Walk overlay toggle
        const walkOverlayBtn = document.getElementById('btn-walk-overlay');
        if (walkOverlayBtn) {
            walkOverlayBtn.onclick = () => {
                this.showWalkOverlay = !this.showWalkOverlay;
                walkOverlayBtn.classList.toggle('active', this.showWalkOverlay);
                // Ensure all objects have tileType for overlay
                if (this.showWalkOverlay) {
                    this.objects.forEach(obj => {
                        if (!obj.tileType) {
                            obj.tileType = this.getAutoTileType(obj.sprite);
                            obj.isWall = !this.isWalkable(obj.tileType);
                        }
                    });
                }
            };
        }

        // Canvas Drop Setup (for Prefabs)
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            try {
                const dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                const data = JSON.parse(dataStr);

                if (data.type === 'prefab') {
                    const prefab = this.prefabs.find(p => p.id === data.id);
                    if (prefab) this.instantiatePrefab(prefab, e.clientX, e.clientY);
                }
            } catch (err) {
                // Ignore errors from regular drag operations
            }
        });

        // Basic actions
        document.getElementById('btn-new').onclick = () => {
            if (confirm("Clear all data?")) {
                this.objects = [];
                this.groups = [];
                this.wires = [];
                this.selectedIds = [];
                this.updateHierarchy();
                this.updateProperties();
            }
        };

        // Export JSON
        document.getElementById('btn-save').onclick = () => {
            // Ensure all objects have tileType and isWall before export
            this.objects.forEach(obj => {
                if (!obj.tileType) {
                    obj.tileType = this.getAutoTileType(obj.sprite);
                    obj.isWall = !this.isWalkable(obj.tileType);
                }
            });
            const data = {
                tileSize: this.tileSize,
                objects: this.objects,
                groups: this.groups,
                wires: this.wires,
                prefabs: this.prefabs
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "xeno_level.json");
            dlAnchorElem.click();
        };

        // Load JSON
        const fileInput = document.getElementById('file-load');
        if (fileInput) {
            document.getElementById('btn-load').onclick = () => {
                fileInput.click();
            };

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (data.tileSize) this.tileSize = data.tileSize;
                        if (data.objects) this.objects = data.objects;
                        if (data.groups) this.groups = data.groups;
                        if (data.wires) this.wires = data.wires;
                        if (data.prefabs) this.prefabs = data.prefabs;

                        // Migrate legacy objects: ensure tileType and isWall exist
                        this.objects.forEach(obj => {
                            if (!obj.tileType) {
                                obj.tileType = this.getAutoTileType(obj.sprite);
                                obj.isWall = !this.isWalkable(obj.tileType);
                            }
                            if (typeof obj.isWall === 'undefined') {
                                obj.isWall = !this.isWalkable(obj.tileType);
                            }
                        });

                        // Ensure UI reflects loaded state
                        document.getElementById('grid-size').value = this.tileSize;
                        this.selectedIds = [];
                        this.selectedGroupId = null;
                        this.updateHierarchy();
                        this.updateProperties();
                        this.renderPrefabs(); // Restore prefabs to left panel

                        alert('Map loaded successfully!');
                    } catch (err) {
                        console.error('Error loading JSON:', err);
                        alert('Failed to parse JSON file.');
                    }
                    // Reset input so the same file can be loaded again if needed
                    fileInput.value = '';
                };
                reader.readAsText(file);
            });
        }

        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Context menu block
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Sprite Library Search
        const searchInput = document.getElementById('sprite-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const folders = document.querySelectorAll('.library-folder');
                const contents = document.querySelectorAll('.library-folder-content');

                folders.forEach((folder, index) => {
                    const content = contents[index];
                    const items = content.querySelectorAll('.sprite-item');
                    let matchesInFolder = 0;

                    items.forEach(item => {
                        const name = item.dataset.name.toLowerCase();
                        if (name.includes(query)) {
                            item.style.display = 'flex';
                            matchesInFolder++;
                        } else {
                            item.style.display = 'none';
                        }
                    });

                    if (query === '') {
                        folder.style.display = 'flex';
                        content.classList.remove('open');
                        folder.querySelector('.folder-icon').classList.remove('open');
                    } else if (matchesInFolder > 0) {
                        folder.style.display = 'flex';
                        content.classList.add('open');
                        folder.querySelector('.folder-icon').classList.add('open');
                    } else {
                        folder.style.display = 'none';
                        content.classList.remove('open');
                    }
                });
            });
        }

        // Setup Editor Mode Toggle
        const modeSelect = document.getElementById('editor-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.setMode(e.target.value);
            });
        }

        // Prefab Library Drop Zone
        const prefabsContainer = document.getElementById('prefabs-container');
        if (prefabsContainer) {
            prefabsContainer.ondragover = (e) => {
                e.preventDefault();
                prefabsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            };
            prefabsContainer.ondragleave = (e) => {
                prefabsContainer.style.backgroundColor = '';
            };
            prefabsContainer.ondrop = (e) => {
                e.preventDefault();
                prefabsContainer.style.backgroundColor = '';
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.type === 'group') {
                        const group = this.groups.find(g => g.id === data.groupId);
                        if (group) this.saveGroupAsPrefab(group);
                    }
                } catch (err) { console.error("Drop error", err); }
            };
        }

        // Keyboard hotkeys
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            switch (e.key.toLowerCase()) {
                case 'v': this.setTool('select'); break;
                case 'b': this.setTool('place'); break;
                case 'w': this.setTool('wire'); break;
                case 'e': this.setTool('erase'); break;
                case 'g':
                    // Toggle walkability overlay
                    this.showWalkOverlay = !this.showWalkOverlay;
                    const walkBtn = document.getElementById('btn-walk-overlay');
                    if (walkBtn) walkBtn.classList.toggle('active', this.showWalkOverlay);
                    if (this.showWalkOverlay) {
                        this.objects.forEach(obj => {
                            if (!obj.tileType) {
                                obj.tileType = this.getAutoTileType(obj.sprite);
                                obj.isWall = !this.isWalkable(obj.tileType);
                            }
                        });
                    }
                    break;
                case 'delete':
                case 'backspace':
                    this.deleteSelected();
                    break;
            }

            // Ctrl+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
        });

        // Hierarchy buttons
        document.getElementById('btn-group').onclick = () => this.groupSelected();
        document.getElementById('btn-ungroup').onclick = () => this.ungroupSelected();
    }

    setMode(mode) {
        this.editorMode = mode;
        if (this.editorMode === 'terrain' && this.activeTool === 'wire') {
            this.setTool('select');
        }
        this.selectedIds = [];
        this.selectedGroupId = null;
        this.updateHierarchy();
        this.updateProperties();
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Auto-classify a sprite name into a tile type for collision purposes.
     * Floor tiles are walkable, everything else blocks by default.
     */
    getAutoTileType(spriteName) {
        const s = spriteName.toLowerCase();
        if (s.includes('floor-room') || s.includes('room-floor') || s === 'tile-room-floor.png') return 'floor-room';
        if (s.includes('floor-corridor') || s.includes('corridor-floor') || s === 'tile-corridor-floor.png') return 'floor-corridor';
        if (s.includes('floor-warning') || s.includes('warning')) return 'floor-room'; // warning tiles are walkable
        if (s.includes('door')) return 'door';
        if (s.includes('switch') || s.includes('button') || s.includes('keypad')) return 'switch';
        if (s.includes('panel')) return 'panel';
        if (s.includes('wall')) return 'wall';
        if (s.includes('resin') || s.includes('prop-')) return 'deco';
        // Non-tile sprites (entities, characters, xenos)
        if (!s.startsWith('tile-')) return 'entity';
        // Default: anything tile-like but unclassified is a wall
        return 'wall';
    }

    /**
     * Determine if a tileType is walkable (not a wall).
     */
    isWalkable(tileType) {
        return tileType === 'floor-room' || tileType === 'floor-corridor' || tileType === 'entity' || tileType === 'deco';
    }

    /** Terrain tiles use cell-based (top-left) origin for seamless tiling */
    isTerrain(tileType) {
        return ['floor-room', 'floor-corridor', 'wall', 'door'].includes(tileType);
    }

    /** Overlays (panels, switches, deco) snap on top of wall tiles */
    isOverlay(tileType) {
        return ['panel', 'switch', 'deco'].includes(tileType);
    }

    /** Save current state for undo */
    pushHistory() {
        this.history.push({
            objects: JSON.parse(JSON.stringify(this.objects)),
            groups: JSON.parse(JSON.stringify(this.groups)),
            wires: JSON.parse(JSON.stringify(this.wires))
        });
        if (this.history.length > this.maxHistory) this.history.shift();
    }

    /** Undo last action */
    undo() {
        if (this.history.length === 0) return;
        const state = this.history.pop();
        this.objects = state.objects;
        this.groups = state.groups;
        this.wires = state.wires;
        this.selectedIds = [];
        this.selectedGroupId = null;
        this.updateHierarchy();
        this.updateProperties();
    }

    setTool(tool) {
        if (tool === 'wire' && this.editorMode === 'terrain') {
            alert("Wiring is only available in Logic Mode.");
            return;
        }
        this.activeTool = tool;
        document.querySelectorAll('.tool-section button').forEach(b => b.classList.remove('active'));
        document.getElementById(`tool-${tool}`).classList.add('active');

        if (tool !== 'place') {
            document.querySelectorAll('.sprite-item').forEach(el => el.classList.remove('selected'));
            this.activeSprite = null;
        }
    }

    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const rx = sx - rect.left;
        const ry = sy - rect.top;
        return {
            x: (rx - this.canvas.width / 2) / this.zoom - this.camera.x,
            y: (ry - this.canvas.height / 2) / this.zoom - this.camera.y
        };
    }

    snapToGrid(val) {
        return Math.round(val / this.tileSize) * this.tileSize;
    }

    /** Snap to cell top-left corner (for terrain tiles) */
    snapToCell(val) {
        return Math.floor(val / this.tileSize) * this.tileSize;
    }

    getObjectAt(wx, wy) {
        // Return topmost object that contains point
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            const ts = this.tileSize;
            if (this.isTerrain(obj.tileType)) {
                // Terrain: top-left origin (cell-based)
                if (wx >= obj.x && wx < obj.x + ts && wy >= obj.y && wy < obj.y + ts) return obj;
            } else {
                // Entities/overlays: centered origin
                if (wx >= obj.x - ts / 2 && wx <= obj.x + ts / 2 && wy >= obj.y - ts / 2 && wy <= obj.y + ts / 2) return obj;
            }
        }
        return null;
    }

    onMouseDown(e) {
        const isRightClick = e.button === 2;
        const isMiddleClick = e.button === 1;

        if (isMiddleClick || (isRightClick && this.activeTool !== 'erase')) {
            this.isDraggingView = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            return;
        }

        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const snapped = { x: this.snapToGrid(worldPos.x), y: this.snapToGrid(worldPos.y) };

        if (this.activeTool === 'place' && this.activeSprite) {
            // Place object
            const tileType = this.getAutoTileType(this.activeSprite);
            let px, py;

            if (this.isTerrain(tileType)) {
                // Terrain tiles: snap to cell top-left for seamless tiling
                px = this.snapToCell(worldPos.x);
                py = this.snapToCell(worldPos.y);
            } else if (this.isOverlay(tileType)) {
                // Panels/switches/decorations: snap to nearest wall tile center
                const cellX = this.snapToCell(worldPos.x);
                const cellY = this.snapToCell(worldPos.y);
                const wallTile = this.objects.find(o =>
                    this.isTerrain(o.tileType) && o.x === cellX && o.y === cellY
                );
                // If wall found, overlay on it; otherwise place at cell
                px = wallTile ? wallTile.x + this.tileSize / 2 : snapped.x;
                py = wallTile ? wallTile.y + this.tileSize / 2 : snapped.y;
            } else {
                // Entities: center-snap
                px = snapped.x;
                py = snapped.y;
            }

            this.pushHistory();
            const obj = {
                id: this.generateId(),
                sprite: this.activeSprite,
                x: px,
                y: py,
                name: this.activeSprite.replace('.png', ''),
                tileType: tileType,
                isWall: !this.isWalkable(tileType),
                props: { locked: false, role: tileType, behavior: '', animations: { 'idle': [this.activeSprite] }, defaultState: 'idle', hitboxType: 'self', hitboxValue: 0 }
            };
            this.objects.push(obj);
            this.selectedIds = [obj.id];
            this.updateHierarchy();
            this.updateProperties();
        }
        else if (this.activeTool === 'select') {
            const clickedObj = this.getObjectAt(worldPos.x, worldPos.y);
            if (clickedObj) {
                if (this.editorMode === 'logic') {
                    const group = this.groups.find(g => g.children.includes(clickedObj.id));
                    if (group) {
                        this.selectedGroupId = group.id;
                        this.selectedIds = [];
                        this.isDraggingObject = false;
                        this.updateHierarchy();
                        this.updateProperties();
                        return;
                    }
                }

                // Check if clicked object belongs to a group
                let targetIds = [clickedObj.id];
                const parentGroup = this.groups.find(g => g.children.includes(clickedObj.id));

                if (parentGroup) {
                    this.selectedGroupId = parentGroup.id;
                    targetIds = [...parentGroup.children]; // select the whole group
                } else {
                    this.selectedGroupId = null;
                }

                if (!e.shiftKey) {
                    this.selectedIds = [...targetIds];
                } else {
                    targetIds.forEach(id => {
                        if (!this.selectedIds.includes(id)) this.selectedIds.push(id);
                    });
                }
                this.isDraggingObject = true;
                this.lastMouse = { x: worldPos.x, y: worldPos.y }; // Store initial grab offset
            } else {
                if (!e.shiftKey) this.selectedIds = [];
            }
            this.updateHierarchy();
            this.updateProperties();
        }
        else if (this.activeTool === 'erase' || isRightClick) {
            const clickedObj = this.getObjectAt(worldPos.x, worldPos.y);
            if (clickedObj) {
                this.pushHistory();
                this.selectedIds = [clickedObj.id];
                this.deleteSelected(true); // skip pushing history again
            }
        }
        else if (this.activeTool === 'wire') {
            if (this.editorMode !== 'logic') return;
            const clickedObj = this.getObjectAt(worldPos.x, worldPos.y);
            if (clickedObj) {
                let targetId = clickedObj.id;
                let targetPos = { x: clickedObj.x, y: clickedObj.y };
                const group = this.groups.find(g => g.children.includes(clickedObj.id));
                if (group) {
                    targetId = group.id;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    group.children.forEach(id => {
                        const child = this.objects.find(o => o.id === id);
                        if (child) {
                            if (child.x < minX) minX = child.x;
                            if (child.x > maxX) maxX = child.x;
                            if (child.y < minY) minY = child.y;
                            if (child.y > maxY) maxY = child.y;
                        }
                    });
                    targetPos.x = minX + (maxX - minX) / 2;
                    targetPos.y = minY + (maxY - minY) / 2;
                }

                this.isWiring = true;
                this.wireStartObj = { id: targetId, x: targetPos.x, y: targetPos.y };
            }
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        if (this.isDraggingView) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.camera.x += dx / this.zoom;
            this.camera.y += dy / this.zoom;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        }
        else if (this.isDraggingObject && this.selectedIds.length > 0) {
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const dx = worldPos.x - this.lastMouse.x;
            const dy = worldPos.y - this.lastMouse.y;

            this.selectedIds.forEach(id => {
                const obj = this.objects.find(o => o.id === id);
                if (obj) {
                    obj.x += dx;
                    obj.y += dy;
                }
            });
            this.lastMouse = { x: worldPos.x, y: worldPos.y };
        }
    }

    onMouseUp(e) {
        this.isDraggingView = false;

        if (this.isDraggingObject) {
            this.pushHistory();
            // Snap all dragged objects to grid on release
            this.selectedIds.forEach(id => {
                const obj = this.objects.find(o => o.id === id);
                if (obj) {
                    if (this.isTerrain(obj.tileType)) {
                        obj.x = this.snapToCell(obj.x);
                        obj.y = this.snapToCell(obj.y);
                    } else {
                        obj.x = this.snapToGrid(obj.x);
                        obj.y = this.snapToGrid(obj.y);
                    }
                }
            });
            this.isDraggingObject = false;
        }

        if (this.isWiring && this.wireStartObj) {
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const rawTargetObj = this.getObjectAt(worldPos.x, worldPos.y);

            if (rawTargetObj) {
                let targetId = rawTargetObj.id;
                const group = this.groups.find(g => g.children.includes(rawTargetObj.id));
                if (group) targetId = group.id;

                if (targetId !== this.wireStartObj.id) {
                    // Ensure wire doesn't already exist
                    const exists = this.wires.find(w => w.sourceId === this.wireStartObj.id && w.targetId === targetId);
                    if (!exists) {
                        this.pushHistory();
                        this.wires.push({
                            id: this.generateId(),
                            sourceId: this.wireStartObj.id,
                            targetId: targetId
                        });
                    }
                }
            }
            this.isWiring = false;
            this.wireStartObj = null;
        }
    }

    deleteSelected(skipHistory = false) {
        if (!skipHistory) this.pushHistory();
        this.objects = this.objects.filter(o => !this.selectedIds.includes(o.id));
        // Remove orphans from groups
        this.groups.forEach(g => {
            g.children = g.children.filter(id => !this.selectedIds.includes(id));
        });
        // Remove orphan wires
        this.wires = this.wires.filter(w => !this.selectedIds.includes(w.sourceId) && !this.selectedIds.includes(w.targetId));
        this.selectedIds = [];
        this.updateHierarchy();
        this.updateProperties();
    }

    groupSelected() {
        if (this.selectedIds.length < 2) return;
        this.pushHistory();
        const group = {
            id: this.generateId(),
            name: 'Group_' + this.groups.length,
            children: [...this.selectedIds],
            props: { classPreset: 'none', behavior: '', hitboxType: 'group_bound', hitboxValue: 0 }
        };
        this.groups.push(group);
        // Clear selection and select the group container conceptually, or just clear.
        this.selectedIds = [];
        this.updateHierarchy();
    }

    ungroupSelected() {
        // Find groups that contain all currently selected items, or if a group node in UI is selected (simplified for now: dissolve any group containing selected)
        const ids = new Set(this.selectedIds);
        this.groups = this.groups.filter(g => {
            const overlap = g.children.some(childId => ids.has(childId));
            return !overlap;
        });
        this.updateHierarchy();
    }

    saveGroupAsPrefab(group) {
        if (!group || group.children.length === 0) return;

        // Auto-generate name based on group name to bypass prompt blocking bugs
        const name = group.name;

        // Calculate bounding box and center point
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const groupObjects = group.children.map(id => this.objects.find(o => o.id === id)).filter(o => o);

        groupObjects.forEach(obj => {
            if (obj.x < minX) minX = obj.x;
            if (obj.x > maxX) maxX = obj.x;
            if (obj.y < minY) minY = obj.y;
            if (obj.y > maxY) maxY = obj.y;
        });

        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;

        // Create deep copy blueprint, adjusting coordinates relative to center
        const blueprintObjects = groupObjects.map(obj => {
            return JSON.parse(JSON.stringify({
                ...obj,
                x: obj.x - centerX,
                y: obj.y - centerY
            }));
        });

        // Store internal wire logic relative to the group (Optional future expansion)

        const prefab = {
            id: this.generateId(),
            name: name,
            props: JSON.parse(JSON.stringify(group.props || { classPreset: 'none', behavior: '', hitboxType: 'group_bound', hitboxValue: 0 })),
            blueprint: {
                objects: blueprintObjects
            }
        };

        this.prefabs.push(prefab);
        this.renderPrefabs();

        // Auto-switch to prefabs tab to show the user their new creation
        this.switchTab('prefabs');
    }

    instantiatePrefab(prefab, clientX, clientY) {
        const worldPos = this.screenToWorld(clientX, clientY);
        const snappedX = this.snapToGrid(worldPos.x);
        const snappedY = this.snapToGrid(worldPos.y);

        const newGroup = {
            id: this.generateId(),
            name: prefab.name + '_instance',
            children: [],
            props: JSON.parse(JSON.stringify(prefab.props || { classPreset: 'none', behavior: '', hitboxType: 'group_bound', hitboxValue: 0 }))
        };

        // Map old blueprint IDs to new instantiated IDs
        const idMap = {};

        prefab.blueprint.objects.forEach(bpObj => {
            const newId = this.generateId();
            idMap[bpObj.id] = newId;

            const newObj = JSON.parse(JSON.stringify(bpObj));
            newObj.id = newId;
            newObj.x = this.snapToGrid(snappedX + bpObj.x);
            newObj.y = this.snapToGrid(snappedY + bpObj.y);

            this.objects.push(newObj);
            newGroup.children.push(newId);
        });

        this.groups.push(newGroup);

        // Auto-select the newly dropped group
        this.selectedIds = [];
        this.selectedGroupId = newGroup.id;
        this.setTool('select');
        this.updateHierarchy();
        this.updateProperties();
    }

    updateHierarchy() {
        const tree = document.getElementById('hierarchy-tree');
        tree.innerHTML = '';

        // Render groups first
        this.groups.forEach(g => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'tree-node group-node';
            if (this.selectedGroupId === g.id) groupDiv.classList.add('selected');

            const headerCont = document.createElement('div');
            headerCont.style.display = 'flex';
            headerCont.style.justifyContent = 'space-between';
            headerCont.style.alignItems = 'center';
            headerCont.style.width = '100%';

            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = `<strong>[G]</strong> ${g.name}`;

            const btn = document.createElement('button');
            btn.className = 'ellipsis-btn';
            btn.innerText = '⋮';
            btn.title = 'Group Actions';

            const menu = document.createElement('div');
            menu.className = 'micro-menu';
            const convertBtn = document.createElement('button');
            convertBtn.innerText = 'Convert to Animation';
            menu.appendChild(convertBtn);

            btn.onclick = (e) => {
                e.stopPropagation();
                const rect = btn.getBoundingClientRect();
                menu.style.display = 'flex';
                menu.style.top = rect.bottom + 'px';
                menu.style.left = rect.left + 'px';
            };

            const closeMenu = () => { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); };
            btn.addEventListener('click', () => { setTimeout(() => document.addEventListener('click', closeMenu), 0); });

            convertBtn.onclick = (e) => {
                e.stopPropagation();
                this.convertGroupToAnimation(g);
                closeMenu();
            };

            headerCont.appendChild(titleSpan);
            headerCont.appendChild(btn);
            groupDiv.appendChild(headerCont);
            groupDiv.appendChild(menu);

            // Make the group draggable
            groupDiv.draggable = true;
            groupDiv.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', groupId: g.id }));
            };

            groupDiv.onclick = (e) => {
                this.selectedIds = [];
                this.selectedGroupId = g.id;
                this.updateHierarchy();
                this.updateProperties();
            };

            const childrenCont = document.createElement('div');
            childrenCont.style.paddingLeft = '15px';

            g.children.forEach((childId, index) => {
                const obj = this.objects.find(o => o.id === childId);
                if (obj) {
                    const node = this.createTreeNode(obj, g, index);
                    childrenCont.appendChild(node);
                }
            });

            tree.appendChild(groupDiv);
            tree.appendChild(childrenCont);
        });

        // Render standalone loose objects
        const groupedIds = new Set(this.groups.flatMap(g => g.children));
        this.objects.forEach(obj => {
            if (!groupedIds.has(obj.id)) {
                tree.appendChild(this.createTreeNode(obj, null, -1));
            }
        });
    }

    convertGroupToAnimation(group) {
        if (!group.children || group.children.length === 0) return;

        // 1. Collect sprites sequentially
        const sprites = group.children.map(id => this.objects.find(o => o.id === id)?.sprite).filter(s => s);

        if (sprites.length === 0) return;

        // 2. Identify the base object to keep
        const targetObjId = group.children[0];
        const targetObj = this.objects.find(o => o.id === targetObjId);

        // 3. Assign the sequence to the first object
        targetObj.props.animations['idle'] = {
            frames: sprites,
            loop: 'loop_until_stopped',
            speedType: 'walk',
            speedValue: 250
        };
        targetObj.props.defaultState = 'idle';

        // 4. Delete redundant duplicated objects
        const objectsToDelete = group.children.slice(1);
        this.objects = this.objects.filter(o => !objectsToDelete.includes(o.id));

        // 5. Delete the wrapper group
        this.groups = this.groups.filter(g => g.id !== group.id);

        // 6. Update UI Focus
        this.selectedIds = [targetObjId];
        this.selectedGroupId = null;
        this.updateHierarchy();
        this.updateProperties();
    }

    createTreeNode(obj, parentGroup = null, index = -1) {
        const div = document.createElement('div');
        div.className = 'tree-node';
        if (this.selectedIds.includes(obj.id)) div.classList.add('selected');

        const iconUrl = `sprites/${obj.sprite}`;
        div.innerHTML = `
            <span class="node-icon" style="background-image: url('${iconUrl}')"></span> 
            <span>${obj.name}</span>
        `;

        // Add Ellipsis Menu for Reordering if in a group
        if (parentGroup) {
            const btn = document.createElement('button');
            btn.className = 'ellipsis-btn';
            btn.innerText = '⋮';

            const menu = document.createElement('div');
            menu.className = 'micro-menu';
            const upBtn = document.createElement('button'); upBtn.innerText = 'Move Up';
            const downBtn = document.createElement('button'); downBtn.innerText = 'Move Down';
            menu.appendChild(upBtn); menu.appendChild(downBtn);

            btn.onclick = (e) => {
                e.stopPropagation();
                const rect = btn.getBoundingClientRect();
                menu.style.display = 'flex';
                menu.style.top = rect.bottom + 'px';
                menu.style.left = rect.left + 'px';
            };

            // Close menu on outside click
            const closeMenu = () => { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); };
            btn.addEventListener('click', () => { setTimeout(() => document.addEventListener('click', closeMenu), 0); });

            upBtn.onclick = (e) => {
                e.stopPropagation();
                if (index > 0) {
                    const temp = parentGroup.children[index - 1];
                    parentGroup.children[index - 1] = parentGroup.children[index];
                    parentGroup.children[index] = temp;
                    this.updateHierarchy();
                }
                menu.style.display = 'none';
            };

            downBtn.onclick = (e) => {
                e.stopPropagation();
                if (index < parentGroup.children.length - 1) {
                    const temp = parentGroup.children[index + 1];
                    parentGroup.children[index + 1] = parentGroup.children[index];
                    parentGroup.children[index] = temp;
                    this.updateHierarchy();
                }
                menu.style.display = 'none';
            };

            div.appendChild(btn);
            document.body.appendChild(menu); // Append menu to body to avoid overflow clipping

            // HTML5 Drag and Drop Handlers
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ objId: obj.id, groupId: parentGroup.id }));
            };
            div.ondragover = (e) => {
                e.preventDefault();
                div.classList.add('drag-over');
            };
            div.ondragleave = (e) => {
                div.classList.remove('drag-over');
            };
            div.ondrop = (e) => {
                e.preventDefault();
                div.classList.remove('drag-over');
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.groupId === parentGroup.id && data.objId !== obj.id) {
                        // Reorder within the same group
                        const oldIndex = parentGroup.children.indexOf(data.objId);
                        const newIndex = index;

                        if (oldIndex > -1 && newIndex > -1) {
                            parentGroup.children.splice(oldIndex, 1); // remove
                            // Adjust insert index if dragging down
                            const insertIndex = newIndex > oldIndex ? newIndex : newIndex;
                            parentGroup.children.splice(insertIndex, 0, data.objId); // insert
                            this.updateHierarchy();
                        }
                    }
                } catch (err) { console.error("Drop error", err); }
            };
        }

        div.onclick = (e) => {
            this.selectedGroupId = null;
            if (!e.shiftKey) this.selectedIds = [obj.id];
            else if (!this.selectedIds.includes(obj.id)) this.selectedIds.push(obj.id);
            this.updateHierarchy();
            this.updateProperties();
        };
        return div;
    }

    updateProperties() {
        const panel = document.getElementById('properties-panel');
        const animPanel = document.getElementById('animation-panel');

        if (this.selectedGroupId) {
            animPanel.style.display = 'none';
            const group = this.groups.find(g => g.id === this.selectedGroupId);
            if (!group) return;

            // Ensure legacy groups have properties
            if (!group.props) group.props = { classPreset: 'none', behavior: '', hitboxType: 'group_bound', hitboxValue: 0 };

            panel.innerHTML = `
                <div class="prop-row">
                    <label>Group Name</label>
                    <input type="text" id="prop-group-name" value="${group.name}">
                </div>
                <hr style="border-color:var(--border); margin:10px 0;">
                <div class="prop-row">
                    <label>Class Preset</label>
                    <select id="prop-group-class-preset">
                        <option value="none" ${group.props.classPreset === 'none' || !group.props.classPreset ? 'selected' : ''}>None (Custom)</option>
                        <option value="xeno-drone" ${group.props.classPreset === 'xeno-drone' ? 'selected' : ''}>Xeno - Drone</option>
                        <option value="xeno-warrior" ${group.props.classPreset === 'xeno-warrior' ? 'selected' : ''}>Xeno - Warrior</option>
                        <option value="xeno-queen" ${group.props.classPreset === 'xeno-queen' ? 'selected' : ''}>Xeno - Queen</option>
                        <option value="xeno-egg" ${group.props.classPreset === 'xeno-egg' ? 'selected' : ''}>Xeno - Egg</option>
                        <option value="xeno-facehugger" ${group.props.classPreset === 'xeno-facehugger' ? 'selected' : ''}>Xeno - Facehugger</option>
                        <option value="xeno-chestburster" ${group.props.classPreset === 'xeno-chestburster' ? 'selected' : ''}>Xeno - Chestburster</option>
                        <option value="human" ${group.props.classPreset === 'human' ? 'selected' : ''}>Human</option>
                        <option value="synth" ${group.props.classPreset === 'synth' ? 'selected' : ''}>Synth</option>
                    </select>
                </div>
                <div class="prop-row">
                    <label>Behavior</label>
                    <input type="text" id="prop-group-behavior" value="${group.props.behavior || ''}" placeholder="e.g. boss, patrol">
                </div>
                <div class="prop-row">
                    <label>Hitbox Type</label>
                    <select id="prop-group-hitbox-type">
                        <option value="group_bound" ${group.props.hitboxType === 'group_bound' || !group.props.hitboxType ? 'selected' : ''}>Group Bound (Calculated)</option>
                        <option value="circle" ${group.props.hitboxType === 'circle' ? 'selected' : ''}>Circle (Radial)</option>
                        <option value="square" ${group.props.hitboxType === 'square' ? 'selected' : ''}>Square (Numerical)</option>
                    </select>
                </div>
                ${(group.props.hitboxType === 'circle' || group.props.hitboxType === 'square') ? `
                <div class="prop-row">
                    <label>Hitbox Size</label>
                    <input type="number" id="prop-group-hitbox-value" value="${group.props.hitboxValue || 0}" style="width: 100%;">
                </div>
                ` : ''}
                <hr style="border-color:var(--border); margin:10px 0;">
                <div class="prop-row">
                    <button id="btn-play-group" style="width:100%;">Play Group Sequence</button>
                </div>
                <p class="muted" style="margin-top:10px;">Entities in this group will be flashed sequentially from top to bottom.</p>
                <hr style="border-color:var(--border); margin:10px 0;">
                <div class="prop-row">
                    <button id="btn-save-prefab" style="width:100%; background-color:var(--accent);">Save To Library (Prefab)</button>
                </div>
            `;

            document.getElementById('prop-group-name').onchange = (e) => {
                group.name = e.target.value;
                this.updateHierarchy();
            };

            // New listeners
            document.getElementById('prop-group-class-preset').onchange = (e) => {
                group.props.classPreset = e.target.value;
                if (group.props.classPreset !== 'none') group.props.behavior = group.props.classPreset;
                this.updateProperties();
            };
            document.getElementById('prop-group-behavior').onchange = (e) => { group.props.behavior = e.target.value; };
            document.getElementById('prop-group-hitbox-type').onchange = (e) => { group.props.hitboxType = e.target.value; this.updateProperties(); };
            const hbValueInput = document.getElementById('prop-group-hitbox-value');
            if (hbValueInput) hbValueInput.onchange = (e) => { group.props.hitboxValue = parseFloat(e.target.value); };

            document.getElementById('btn-save-prefab').onclick = () => {
                this.saveGroupAsPrefab(group);
            };

            const btnPlay = document.getElementById('btn-play-group');
            btnPlay.onclick = () => {
                if (btnPlay.innerText === 'Stop Sequence') {
                    btnPlay.innerText = 'Play Group Sequence';
                    if (this.groupAnimInterval) clearInterval(this.groupAnimInterval);
                    // Ensure all are visible again
                    group.children.forEach(id => {
                        const obj = this.objects.find(o => o.id === id);
                        if (obj) obj.hidden = false;
                    });
                } else {
                    btnPlay.innerText = 'Stop Sequence';
                    let idx = 0;
                    if (this.groupAnimInterval) clearInterval(this.groupAnimInterval);
                    this.groupAnimInterval = setInterval(() => {
                        group.children.forEach((id, i) => {
                            const obj = this.objects.find(o => o.id === id);
                            if (obj) obj.hidden = (i !== idx);
                        });
                        idx = (idx + 1) % group.children.length;
                    }, 150);
                }
            };
            return;
        }

        if (this.selectedIds.length === 0) {
            panel.innerHTML = '<p class="muted">Select an object or group to edit.</p>';
            animPanel.style.display = 'none';
            return;
        }

        if (this.selectedIds.length > 1) {
            panel.innerHTML = '<p class="muted">Multiple objects selected. Edit individually or Group them.</p>';
            animPanel.style.display = 'none';
            return;
        }

        const obj = this.objects.find(o => o.id === this.selectedIds[0]);
        if (!obj) return;

        // Ensure legacy objects have props and migrate to new animation states
        if (!obj.props) obj.props = { locked: false, role: 'none', behavior: '', animations: { 'idle': { frames: [obj.sprite], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 } }, defaultState: 'idle', hitboxType: 'self', hitboxValue: 0 };

        // Ensure legacy objects have hitbox properties
        if (!obj.props.hitboxType) obj.props.hitboxType = 'self';
        if (typeof obj.props.hitboxValue === 'undefined') obj.props.hitboxValue = 0;

        if (obj.props.frames) {
            // Migrate legacy flat frames array to dictionary
            obj.props.animations = { 'idle': { frames: obj.props.frames, loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 } };
            obj.props.defaultState = 'idle';
            delete obj.props.frames;
        }
        if (!obj.props.animations) {
            obj.props.animations = { 'idle': { frames: [obj.sprite], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 } };
            obj.props.defaultState = 'idle';
        }

        // Migrate array-based animations to object-based
        Object.keys(obj.props.animations).forEach(key => {
            if (Array.isArray(obj.props.animations[key])) {
                obj.props.animations[key] = {
                    frames: obj.props.animations[key],
                    loop: 'loop_until_stopped',
                    speedType: 'walk',
                    speedValue: 250
                };
            }
        });

        // Initialize working state if not present
        if (!this._workingAnimState || !obj.props.animations[this._workingAnimState]) {
            this._workingAnimState = obj.props.defaultState || Object.keys(obj.props.animations)[0] || 'idle';
        }

        let html = `
            <div class="prop-row">
                <label>Name</label>
                <input type="text" id="prop-name" value="${obj.name}">
            </div>
            <div class="prop-row">
                <label>Sprite</label>
                <input type="text" value="${obj.sprite}" disabled title="Cannot edit sprite">
            </div>
            <div class="prop-row">
                <label>X / Y</label>
                <input type="number" id="prop-x" value="${obj.x}" style="width: 60px; margin-right:5px;">
                <input type="number" id="prop-y" value="${obj.y}" style="width: 60px;">
            </div>
            <hr style="border-color:var(--border); margin:10px 0;">
            <div class="prop-row">
                <label>Role</label>
                <select id="prop-role">
                    <option value="floor-room" ${obj.props.role === 'floor-room' ? 'selected' : ''}>Floor (Room)</option>
                    <option value="floor-corridor" ${obj.props.role === 'floor-corridor' ? 'selected' : ''}>Floor (Corridor)</option>
                    <option value="wall" ${obj.props.role === 'wall' || obj.props.role === 'none' ? 'selected' : ''}>Wall / Structural</option>
                    <option value="door" ${obj.props.role === 'door' ? 'selected' : ''}>Door</option>
                    <option value="switch" ${obj.props.role === 'switch' ? 'selected' : ''}>Switch</option>
                    <option value="panel" ${obj.props.role === 'panel' ? 'selected' : ''}>Control Panel</option>
                    <option value="entity" ${obj.props.role === 'entity' ? 'selected' : ''}>Entity Spawn</option>
                    <option value="deco" ${obj.props.role === 'deco' ? 'selected' : ''}>Decoration</option>
                </select>
            </div>
            <div class="prop-row">
                <label>Class Preset</label>
                <select id="prop-class-preset">
                    <option value="none" ${obj.props.classPreset === 'none' || !obj.props.classPreset ? 'selected' : ''}>None (Custom)</option>
                    <option value="xeno-drone" ${obj.props.classPreset === 'xeno-drone' ? 'selected' : ''}>Xeno - Drone</option>
                    <option value="xeno-warrior" ${obj.props.classPreset === 'xeno-warrior' ? 'selected' : ''}>Xeno - Warrior</option>
                    <option value="xeno-queen" ${obj.props.classPreset === 'xeno-queen' ? 'selected' : ''}>Xeno - Queen</option>
                    <option value="xeno-egg" ${obj.props.classPreset === 'xeno-egg' ? 'selected' : ''}>Xeno - Egg</option>
                    <option value="xeno-facehugger" ${obj.props.classPreset === 'xeno-facehugger' ? 'selected' : ''}>Xeno - Facehugger</option>
                    <option value="xeno-chestburster" ${obj.props.classPreset === 'xeno-chestburster' ? 'selected' : ''}>Xeno - Chestburster</option>
                    <option value="human" ${obj.props.classPreset === 'human' ? 'selected' : ''}>Human</option>
                    <option value="synth" ${obj.props.classPreset === 'synth' ? 'selected' : ''}>Synth</option>
                </select>
            </div>
            <div class="prop-row">
                <label>Locked</label>
                <select id="prop-locked">
                    <option value="false" ${obj.props.locked === false ? 'selected' : ''}>False</option>
                    <option value="true" ${obj.props.locked === true ? 'selected' : ''}>True</option>
                </select>
            </div>
            <div class="prop-row">
                <label>Behavior</label>
                <input type="text" id="prop-behavior" value="${obj.props.behavior || ''}" placeholder="e.g. idle, patrol">
            </div>
            <hr style="border-color:var(--border); margin:10px 0;">
            <div class="prop-row">
                <label>Hitbox Type</label>
                <select id="prop-hitbox-type">
                    <option value="self" ${obj.props.hitboxType === 'self' ? 'selected' : ''}>Self (Sprite Bounds)</option>
                    <option value="protagonist" ${obj.props.hitboxType === 'protagonist' ? 'selected' : ''}>Protagonist (-3px)</option>
                    <option value="antagonist" ${obj.props.hitboxType === 'antagonist' ? 'selected' : ''}>Antagonist (+3px)</option>
                    <option value="circle" ${obj.props.hitboxType === 'circle' ? 'selected' : ''}>Circle (Radial)</option>
                    <option value="square" ${obj.props.hitboxType === 'square' ? 'selected' : ''}>Square (Numerical)</option>
                </select>
            </div>
            ${(obj.props.hitboxType === 'circle' || obj.props.hitboxType === 'square') ? `
            <div class="prop-row">
                <label>Hitbox Size</label>
                <input type="number" id="prop-hitbox-value" value="${obj.props.hitboxValue}" style="width: 100%;">
            </div>
            ` : ''}
        `;

        panel.innerHTML = html;

        // Attach listeners
        document.getElementById('prop-name').onchange = (e) => { obj.name = e.target.value; this.updateHierarchy(); };
        document.getElementById('prop-x').onchange = (e) => { obj.x = parseFloat(e.target.value); };
        document.getElementById('prop-y').onchange = (e) => { obj.y = parseFloat(e.target.value); };
        document.getElementById('prop-role').onchange = (e) => {
            obj.props.role = e.target.value;
            obj.tileType = e.target.value;
            obj.isWall = !this.isWalkable(e.target.value);
        };
        document.getElementById('prop-class-preset').onchange = (e) => {
            const preset = e.target.value;
            obj.props.classPreset = preset;
            if (preset !== 'none') {
                obj.props.behavior = preset;
                // Standard predefined states
                const states = ["walk", "attack", "idle", "confused", "special attack", "injured", "infected", "dead", "captured", "panic"];
                states.forEach(state => {
                    if (!obj.props.animations[state]) obj.props.animations[state] = { frames: [], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 };
                });
            }
            this.updateProperties(); // re-render to reflect new states
        };
        document.getElementById('prop-locked').onchange = (e) => { obj.props.locked = e.target.value === 'true'; };
        document.getElementById('prop-behavior').onchange = (e) => { obj.props.behavior = e.target.value; };
        document.getElementById('prop-hitbox-type').onchange = (e) => {
            obj.props.hitboxType = e.target.value;
            this.updateProperties(); // Re-render to show/hide numeric input
        };
        const hitboxValInput = document.getElementById('prop-hitbox-value');
        if (hitboxValInput) {
            hitboxValInput.onchange = (e) => { obj.props.hitboxValue = parseFloat(e.target.value); };
        }

        // Setup Animation Panel
        animPanel.style.display = 'block';

        const stateSelect = document.getElementById('anim-state-select');
        const stateInput = document.getElementById('new-state-name');

        const loopSelect = document.getElementById('anim-loop-select');
        const speedSelect = document.getElementById('anim-speed-select');
        const speedCustomCont = document.getElementById('anim-speed-custom-container');
        const speedValueInput = document.getElementById('anim-speed-value');

        const updateAnimPanelUI = () => {
            const stateObj = obj.props.animations[this._workingAnimState];
            if (stateObj) {
                loopSelect.value = stateObj.loop || 'loop_until_stopped';
                speedSelect.value = stateObj.speedType || 'walk';
                speedCustomCont.style.display = speedSelect.value === 'custom' ? 'flex' : 'none';
                speedValueInput.value = stateObj.speedValue || 250;
            }
        };

        loopSelect.onchange = (e) => {
            const stateObj = obj.props.animations[this._workingAnimState];
            if (stateObj) stateObj.loop = e.target.value;
        };

        speedSelect.onchange = (e) => {
            const stateObj = obj.props.animations[this._workingAnimState];
            if (stateObj) {
                stateObj.speedType = e.target.value;
                if (e.target.value === 'walk') stateObj.speedValue = 250;
                else if (e.target.value === 'run') stateObj.speedValue = 100;
                else if (e.target.value === 'slow') stateObj.speedValue = 500;
                updateAnimPanelUI();
            }
        };

        speedValueInput.onchange = (e) => {
            const stateObj = obj.props.animations[this._workingAnimState];
            if (stateObj) stateObj.speedValue = parseInt(e.target.value) || 250;
        };

        // Populate state dropdown
        const renderStateDropdown = () => {
            stateSelect.innerHTML = '';
            Object.keys(obj.props.animations).forEach(stateName => {
                const opt = document.createElement('option');
                opt.value = stateName;
                opt.innerText = stateName;
                if (stateName === this._workingAnimState) opt.selected = true;
                stateSelect.appendChild(opt);
            });
            updateAnimPanelUI();
        };
        renderStateDropdown();
        this.renderAnimFrames(obj);

        stateSelect.onchange = (e) => {
            this._workingAnimState = e.target.value;
            this.renderAnimFrames(obj);
            updateAnimPanelUI();
            if (this.animInterval) {
                clearInterval(this.animInterval);
                document.getElementById('btn-play-anim').innerText = 'Play';
                obj.sprite = obj.props.animations[this._workingAnimState]?.frames[0] || obj.sprite;
            }
        };

        document.getElementById('btn-add-state').onclick = () => {
            const newState = stateInput.value.trim();
            if (newState && !obj.props.animations[newState]) {
                obj.props.animations[newState] = { frames: [this.activeSprite || obj.sprite], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 };
                this._workingAnimState = newState;
                stateInput.value = '';
                renderStateDropdown();
                this.renderAnimFrames(obj);
            }
        };

        document.getElementById('btn-delete-state').onclick = () => {
            const states = Object.keys(obj.props.animations);
            if (states.length <= 1) {
                alert("Cannot delete the last animation state.");
                return;
            }
            if (confirm(`Delete animation state '${this._workingAnimState}'?`)) {
                delete obj.props.animations[this._workingAnimState];
                this._workingAnimState = Object.keys(obj.props.animations)[0];
                renderStateDropdown();
                this.renderAnimFrames(obj);
            }
        };

        document.getElementById('btn-add-frame').onclick = () => {
            if (this.activeSprite) {
                if (!obj.props.animations[this._workingAnimState]) obj.props.animations[this._workingAnimState] = { frames: [], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 };
                obj.props.animations[this._workingAnimState].frames.push(this.activeSprite);
                this.renderAnimFrames(obj);
            } else {
                alert("Select a sprite from the Library first.");
            }
        };

        const playBtn = document.getElementById('btn-play-anim');
        playBtn.onclick = () => {
            const frames = obj.props.animations[this._workingAnimState]?.frames || [];
            if (frames.length < 2) return;
            if (playBtn.innerText === 'Play') {
                playBtn.innerText = 'Stop';
                this.playAnimation(obj, this._workingAnimState);
            } else {
                playBtn.innerText = 'Play';
                clearInterval(this.animInterval);
                obj.sprite = frames[0]; // reset
            }
        };
    }

    renderAnimFrames(obj) {
        const list = document.getElementById('anim-frames-list');
        list.innerHTML = '';
        const frames = obj.props.animations[this._workingAnimState]?.frames || [];

        frames.forEach((frame, index) => {
            const div = document.createElement('div');
            div.style.width = '32px';
            div.style.height = '32px';
            div.style.border = '1px solid var(--border)';
            div.style.backgroundImage = `url('sprites/${frame}')`;
            div.style.backgroundSize = 'contain';
            div.style.imageRendering = 'pixelated';
            div.title = `Frame ${index}: ${frame} (Click to remove)`;
            div.onclick = () => {
                if (frames.length > 1) {
                    frames.splice(index, 1);
                    obj.sprite = frames[0]; // Reset current sprite if deleted
                    this.renderAnimFrames(obj);
                }
            };
            list.appendChild(div);
        });

        // Add drag & drop support for dropping new frames into the sequence
        list.ondragover = (e) => {
            e.preventDefault();
            list.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        };

        list.ondragleave = (e) => {
            list.style.backgroundColor = '';
        };

        list.ondrop = (e) => {
            e.preventDefault();
            list.style.backgroundColor = '';
            try {
                const dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                const data = JSON.parse(dataStr);

                if (data.type === 'sprite') {
                    // Auto-group if not already grouped and we are dropping onto a single object
                    if (this.selectedIds.length === 1 && !this.selectedGroupId) {
                        const targetId = this.selectedIds[0];
                        // Verify it's not already a group
                        if (!this.groups.find(g => g.id === targetId)) {
                            const newGroupId = this.generateId();
                            const newGroup = {
                                id: newGroupId,
                                name: obj.name + '_Group',
                                children: [targetId],
                                props: { classPreset: 'none', behavior: '', hitboxType: 'group_bound', hitboxValue: 0 }
                            };
                            this.groups.push(newGroup);
                            this.selectedIds = [newGroupId];
                            // The group is now the selection, but the animation state belongs to the object *or* the group.
                            // Wait, properties strictly apply to what is selected. If we group it, the group gets different props. 
                            // Let's add the frame to the object first before updating selection, or apply it to the object anyway.
                        }
                    }

                    if (!obj.props.animations[this._workingAnimState]) obj.props.animations[this._workingAnimState] = { frames: [], loop: 'loop_until_stopped', speedType: 'walk', speedValue: 250 };
                    obj.props.animations[this._workingAnimState].frames.push(data.sprite);
                    this.renderAnimFrames(obj);

                    if (this.selectedIds.length === 1 && this.selectedIds[0] !== obj.id) {
                        this.updateHierarchy();
                        this.updateProperties();
                    }
                }
            } catch (err) {
                console.error("Drop error", err);
            }
        };
    }

    playAnimation(obj, state) {
        let frameIdx = 0;
        const stateObj = obj.props.animations[state];
        const frames = stateObj?.frames || [];
        if (frames.length < 2) return;

        if (this.animInterval) clearInterval(this.animInterval);
        this.animInterval = setInterval(() => {
            frameIdx = (frameIdx + 1) % frames.length;
            obj.sprite = frames[frameIdx];
        }, stateObj.speedValue || 150);
    }


    render() {
        const { ctx, canvas, zoom, camera, tileSize } = this;
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(camera.x, camera.y);

        // Draw Grid
        const gridExtents = 2000; // how far constraints
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1 / zoom;
        const camLeft = -camera.x - (canvas.width / 2) / zoom;
        const camRight = -camera.x + (canvas.width / 2) / zoom;
        const camTop = -camera.y - (canvas.height / 2) / zoom;
        const camBottom = -camera.y + (canvas.height / 2) / zoom;

        const startX = Math.floor(camLeft / tileSize) * tileSize;
        const startY = Math.floor(camTop / tileSize) * tileSize;

        ctx.beginPath();
        for (let x = startX; x < camRight; x += tileSize) {
            ctx.moveTo(x, camTop);
            ctx.lineTo(x, camBottom);
        }
        for (let y = startY; y < camBottom; y += tileSize) {
            ctx.moveTo(camLeft, y);
            ctx.lineTo(camRight, y);
        }
        ctx.stroke();

        // Origin crosshair
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();

        // Pixel-art rendering
        ctx.imageSmoothingEnabled = false;

        // Render Objects
        this.objects.forEach(obj => {
            if (obj.hidden) return; // For group sequence playback

            const sprite = this.sprites[obj.sprite];
            if (sprite) {
                ctx.globalAlpha = 1.0;
                if (this.isTerrain(obj.tileType)) {
                    // Terrain: top-left origin, fill entire cell seamlessly
                    ctx.drawImage(sprite, obj.x, obj.y, tileSize, tileSize);
                } else {
                    // Entities/overlays: centered origin
                    ctx.drawImage(sprite, obj.x - tileSize / 2, obj.y - tileSize / 2, tileSize, tileSize);
                }
            }

            // Selection highlight
            if (this.selectedIds.includes(obj.id)) {
                ctx.strokeStyle = '#007acc';
                ctx.lineWidth = 2 / zoom;
                if (this.isTerrain(obj.tileType)) {
                    ctx.strokeRect(obj.x, obj.y, tileSize, tileSize);
                } else {
                    ctx.strokeRect(obj.x - tileSize / 2, obj.y - tileSize / 2, tileSize, tileSize);
                }
            }

            // Walkability overlay
            if (this.showWalkOverlay && obj.tileType) {
                const walkable = this.isWalkable(obj.tileType);
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = walkable ? '#00ff88' : '#ff2244';
                if (this.isTerrain(obj.tileType)) {
                    ctx.fillRect(obj.x, obj.y, tileSize, tileSize);
                } else {
                    ctx.fillRect(obj.x - tileSize / 2, obj.y - tileSize / 2, tileSize, tileSize);
                }
                ctx.globalAlpha = 1.0;
            }
        });

        // Current tool preview (ghost object)
        if (this.activeTool === 'place' && this.activeSprite) {
            const worldPos = this.screenToWorld(this.mouseX + this.canvas.getBoundingClientRect().left, this.mouseY + this.canvas.getBoundingClientRect().top);
            const previewType = this.getAutoTileType(this.activeSprite);

            ctx.globalAlpha = 0.5;
            const spr = this.sprites[this.activeSprite];
            if (spr) {
                if (this.isTerrain(previewType)) {
                    const cx = this.snapToCell(worldPos.x);
                    const cy = this.snapToCell(worldPos.y);
                    ctx.drawImage(spr, cx, cy, tileSize, tileSize);
                } else {
                    const sx = this.snapToGrid(worldPos.x);
                    const sy = this.snapToGrid(worldPos.y);
                    ctx.drawImage(spr, sx - tileSize / 2, sy - tileSize / 2, tileSize, tileSize);
                }
            }
            ctx.globalAlpha = 1.0;
        }

        // Draw Wires & Group Selection (Only in logic mode)
        if (this.editorMode === 'logic') {
            ctx.lineWidth = 2 / zoom;

            const getPos = (id) => {
                let obj = this.objects.find(o => o.id === id);
                if (obj) return { x: obj.x, y: obj.y };
                let group = this.groups.find(g => g.id === id);
                if (group && group.children.length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    group.children.forEach(cid => {
                        const child = this.objects.find(o => o.id === cid);
                        if (child) {
                            if (child.x < minX) minX = child.x;
                            if (child.x > maxX) maxX = child.x;
                            if (child.y < minY) minY = child.y;
                            if (child.y > maxY) maxY = child.y;
                        }
                    });
                    if (minX !== Infinity) return { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
                }
                return null;
            };

            this.wires.forEach(w => {
                const sPos = getPos(w.sourceId);
                const tPos = getPos(w.targetId);
                if (sPos && tPos) {
                    ctx.strokeStyle = '#e0a020'; // nice yellow wire
                    ctx.setLineDash([5 / zoom, 5 / zoom]);
                    ctx.beginPath();
                    ctx.moveTo(sPos.x, sPos.y);
                    ctx.lineTo(tPos.x, tPos.y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw nodes
                    ctx.fillStyle = '#e0a020';
                    ctx.beginPath(); ctx.arc(sPos.x, sPos.y, 4 / zoom, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(tPos.x, tPos.y, 4 / zoom, 0, Math.PI * 2); ctx.fill();
                }
            });

            // Drawing new wire
            if (this.isWiring && this.wireStartObj) {
                const worldPos = this.screenToWorld(this.mouseX + this.canvas.getBoundingClientRect().left, this.mouseY + this.canvas.getBoundingClientRect().top);

                ctx.strokeStyle = '#e0a020';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(this.wireStartObj.x, this.wireStartObj.y);
                ctx.lineTo(worldPos.x, worldPos.y);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // Group Highlight (Show bounds of the group if selected)
            this.groups.forEach(group => {
                if (this.selectedGroupId === group.id) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    group.children.forEach(cid => {
                        const child = this.objects.find(o => o.id === cid);
                        if (child) {
                            if (child.x < minX) minX = child.x;
                            if (child.x > maxX) maxX = child.x;
                            if (child.y < minY) minY = child.y;
                            if (child.y > maxY) maxY = child.y;
                        }
                    });
                    if (minX !== Infinity) {
                        ctx.strokeStyle = '#20e060';
                        ctx.lineWidth = 3 / zoom;
                        ctx.strokeRect(minX - tileSize / 2 - 2, minY - tileSize / 2 - 2, (maxX - minX) + tileSize + 4, (maxY - minY) + tileSize + 4);
                    }
                }
            });
        }

        ctx.restore();
    }

    loop() {
        this.render();
        requestAnimationFrame(() => this.loop());
    }
}

// Start app
const app = new Editor();
