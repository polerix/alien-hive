/**
 * Xeno Hive Core Engine - Level 2: The Complex & Industry
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
    // Xeno
    'xeno-drone-idle.png', 'xeno-drone-walk-a.png', 'xeno-drone-walk-b.png',
    'xeno-warrior-idle.png', 'xeno-warrior-walk-a.png', 'xeno-warrior-walk-b.png', 'xeno-warrior-attack.png',
    'xeno-queen-idle.png', 'xeno-queen-walk-a.png', 'xeno-queen-walk-b.png', 'xeno-queen-eggs.png',
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

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.sprites = {};
        this.isLoaded = false;

        this.levels = [];
        this.currentLevelIndex = 0;
        this.tileSize = 40;
        this.zoom = 2.5;
        this.camera = { x: 0, y: 0 };
        this.gameSpeed = 1;

        this.gameState = 'playing'; // 'playing' | 'dead' | 'clear'
        this.xenosSpawned = false;

        this.player = {
            x: 0, y: 0, hp: 100, score: 0,
            facing: 1, // 1 for right, -1 for left
            frame: 0, animTimer: 0, objective: 'INIT...'
        };
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.lastTime = 0;

        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
        await this.loadAssets();
        
        for (let i = 0; i < 3; i++) {
            this.levels.push(this.generateLevel(i));
        }
        
        this.loadLevel(0);
        this.player.objective = 'FIND COLONISTS & CORPO';
        this.isLoaded = true;
        this.loop();
    }

    loadLevel(index) {
        this.currentLevelIndex = index;
        const level = this.levels[index];
        const r = level.rooms[0];
        this.player.x = (r.x + r.w / 2) * this.tileSize;
        this.player.y = (r.y + r.h / 2) * this.tileSize;
        // Snap camera immediately so tiles are visible on the first frame
        this.camera.x = -this.player.x;
        this.camera.y = -this.player.y;
        this.entities = level.entities;
        this.map = level.map;
        this.interactives = level.interactives;
        this.projectiles = [];
        this.xenosSpawned = false;
        this.gameState = 'playing';
        document.getElementById('overlay').classList.add('hidden');

        // Build O(1) walkability map
        this.walkMap = new Map();
        this.map.forEach(t => {
            this.walkMap.set(`${t.x},${t.y}`, t);
        });
    }

    async loadAssets() {
        const promises = ASSET_LIST.map(name => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { this.sprites[name] = img; resolve(); };
                img.onerror = () => { resolve(); };
                img.src = `sprites/${name}`;
            });
        });
        await Promise.all(promises);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => { 
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'KeyR') this.interact();
            if (e.code === 'Enter') this.shoot();
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.player.hp > 0) this.shoot();
        });

        document.getElementById('alien-stats-panel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('alien-breakdown').classList.toggle('hidden');
        });
        document.getElementById('terran-stats-panel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('terran-breakdown').classList.toggle('hidden');
        });
        window.addEventListener('click', () => {
            document.querySelectorAll('.breakdown-panel').forEach(p => p.classList.add('hidden'));
        });

        const speedMap = { 'speed-1': 1, 'speed-2': 2, 'speed-3': 4, 'speed-4': 8 };
        document.querySelectorAll('.speed-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.speed-tag').forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                this.gameSpeed = speedMap[tag.id] || 1;
            });
        });
    }

    interact() {
        this.interactives.forEach(obj => {
            const dist = Math.hypot(obj.x * this.tileSize - this.player.x, obj.y * this.tileSize - this.player.y);
            if (dist < 60) {
                // Secure check: Some switches need Corpo/Synth (mocked by player proximity for now)
                if (obj.secure && this.player.type !== 'synth' && this.player.type !== 'corpo') {
                    this.player.objective = 'REQUIRES SYNTH AUTHORIZATION';
                    return;
                }
                
                obj.active = !obj.active;
                this.map.filter(t => t.linkedTo === obj.id).forEach(door => {
                    door.state = obj.active ? 'open' : 'closed';
                    door.isWall = !obj.active;
                });
            }
        });
    }

    shoot() {
        const worldMouse = this.screenToWorld(this.mouse.x, this.mouse.y);
        const angle = Math.atan2(worldMouse.y - this.player.y, worldMouse.x - this.player.x);
        this.projectiles.push({
            x: this.player.x, y: this.player.y,
            vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10,
            life: 100
        });
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.canvas.width / 2) / this.zoom - this.camera.x,
            y: (sy - this.canvas.height / 2) / this.zoom - this.camera.y
        };
    }

    isWallAt(px, py) {
        const key = `${Math.floor(px / this.tileSize)},${Math.floor(py / this.tileSize)}`;
        const tile = this.walkMap.get(key);
        // No tile at position = void = impassable. Only floor/corridor tiles are walkable.
        return tile ? tile.isWall : true;
    }

    generateLevel(floor) {
        const rooms = [];
        const map = [];
        const entities = [];
        const interactives = [];
        
        for (let i = 0; i < 10; i++) {
            const w = 6 + Math.floor(Math.random() * 6);
            const h = 6 + Math.floor(Math.random() * 6);
            const x = Math.floor((Math.random() - 0.5) * 40);
            const y = Math.floor((Math.random() - 0.5) * 40);
            let overlap = false;
            rooms.forEach(r => {
                if (!(x + w < r.x - 3 || x > r.x + r.w + 3 || y + h < r.y - 3 || y > r.y + r.h + 3)) overlap = true;
            });
            if (!overlap) rooms.push({ x, y, w, h, type: i === 0 ? 'start' : (i === 1 ? 'lab' : 'standard') });
        }

        const grid = {};
        rooms.forEach(r => {
            for (let iy = r.y; iy < r.y + r.h; iy++) {
                for (let ix = r.x; ix < r.x + r.w; ix++) {
                    const isEdgeX = (ix === r.x || ix === r.x + r.w - 1);
                    const isEdgeY = (iy === r.y || iy === r.y + r.h - 1);
                    grid[`${ix},${iy}`] = { type: (isEdgeX || isEdgeY) ? 'wall' : 'floor', room: r };
                }
            }
            
            // Place Door & Switch for each room
            const doorX = r.x + Math.floor(r.w / 2);
            const doorY = r.y + r.h - 1;
            const sid = Math.random().toString(36).substr(2, 5);
            grid[`${doorX},${doorY}`] = { type: 'door', linkedTo: sid };
            interactives.push({ x: doorX + 1, y: doorY, id: sid, type: 'switch', active: false, secure: Math.random() > 0.7 });
        });

        // Simplified Corridor linking
        for(let i=0; i<rooms.length-1; i++) {
            const r1 = rooms[i];
            const r2 = rooms[i+1];
            let cx = r1.x + Math.floor(r1.w/2);
            let cy = r1.y + r1.h;
            const tx = r2.x + Math.floor(r2.w/2);
            const ty = r2.y;
            while(cx !== tx || cy !== ty) {
                if(cy !== ty) cy += (ty > cy ? 1 : -1);
                else if(cx !== tx) cx += (tx > cx ? 1 : -1);
                if(!grid[`${cx},${cy}`]) grid[`${cx},${cy}`] = { type: 'corridor', room: null };
            }
        }

        Object.keys(grid).forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const data = grid[key];
            let sprite = data.type === 'wall' ? 'tile-wall-edge-top.png' : 'tile-floor-room.png';
            let tileType = data.type; // 'wall', 'floor', 'corridor', 'door'
            if(data.type === 'corridor') sprite = 'tile-floor-corridor.png';
            if(data.type === 'door') sprite = 'tile-door-h-closed.png';
            
            // Only floor and corridor tiles are walkable. Everything else blocks.
            let isWall = !(data.type === 'floor' || data.type === 'corridor');

            if (data.type === 'wall') {
                const r = data.room;
                if (x === r.x && y === r.y) sprite = 'tile-wall-corner-tl.png';
                else if (x === r.x + r.w - 1 && y === r.y) sprite = 'tile-wall-corner-tr.png';
                else if (x === r.x && y === r.y + r.h - 1) sprite = 'tile-wall-corner-bl.png';
                else if (x === r.x + r.w - 1 && y === r.y + r.h - 1) sprite = 'tile-wall-corner-br.png';
                else if (x === r.x || x === r.x + r.w - 1) sprite = 'tile-wall-edge-side.png';
            }

            map.push({ x, y, sprite, isWall, tileType, state: 'closed', linkedTo: data.linkedTo });
        });

        // Initial Populating
        const entBase = { state: 'idle', facing: 1, animFrame: 0, animTimer: 0, attackTimer: 0, infected: false, infectionTimer: 0 };
        const xenoBase = { ...entBase, target: null, buildTimer: 0, spawnTimer: 0 };
        rooms.forEach((r, idx) => {
            if (idx === 0) return;
            // Humans
            if (idx === 1) entities.push({ type: 'corpo', x: (r.x + 2)*40, y: (r.y + 2)*40, hp: 100, ...entBase, state: 'waiting', buildTimer: 0 });
            else entities.push({ type: 'colonist', x: (r.x + 2)*40, y: (r.y + 2)*40, hp: 100, ...entBase });
            // Xenos: eggs in most rooms, drones/warriors in later rooms, scaled by floor
            if (idx % 2 === 0) entities.push({ type: 'xeno-egg', x: (r.x + 3)*40, y: (r.y + 3)*40, hp: 10, ...xenoBase });
            if (idx > 2) {
                const type = (floor > 0 && idx > 4) ? 'xeno-warrior' : 'xeno-drone';
                entities.push({ type, x: (r.x + 4)*40, y: (r.y + 3)*40, hp: 100, ...xenoBase });
            }
            if (floor > 1 && idx > 3) entities.push({ type: 'xeno-drone', x: (r.x + 2)*40, y: (r.y + 4)*40, hp: 100, ...xenoBase });
        });

        return { map, rooms, entities, interactives };
    }

    spawnEntity(type, x, y) {
        this.entities.push({
            id: Math.random().toString(36).substr(2, 9),
            type, x, y, hp: 100, state: 'idle', target: null,
            facing: 1, animFrame: 0, animTimer: 0,
            buildTimer: 0, spawnTimer: 0, attackTimer: 0,
            infected: false, infectionTimer: 0
        });
    }

    findNearestTarget(en) {
        let nearest = null;
        let nearestDist = Infinity;
        if (this.player.hp > 0) {
            const d = Math.hypot(en.x - this.player.x, en.y - this.player.y);
            if (d < nearestDist) { nearest = this.player; nearestDist = d; }
        }
        this.entities.forEach(h => {
            if (h === en || h.hp <= 0 || h.type.includes('xeno') || h.type.includes('vat') || h.type.includes('tank')) return;
            const d = Math.hypot(en.x - h.x, en.y - h.y);
            if (d < nearestDist) { nearest = h; nearestDist = d; }
        });
        return nearest;
    }

    update(dt) {
        if (!this.isLoaded || this.gameState !== 'playing') return;
        
        // Player
        if (this.player.hp > 0) {
            let vx = 0, vy = 0;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) vy -= 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) vy += 1;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) vx += 1;
            if (vx !== 0 || vy !== 0) {
                const mag = Math.hypot(vx, vy);
                const speed = 3 * (dt / 16);
                const nextX = this.player.x + (vx / mag) * speed;
                const nextY = this.player.y + (vy / mag) * speed;
                if (!this.isWallAt(nextX, nextY)) { this.player.x = nextX; this.player.y = nextY; }
                // Walk cycle
                this.player.animTimer += dt;
                if (this.player.animTimer > 180) { this.player.animTimer = 0; this.player.frame = this.player.frame === 1 ? 2 : 1; }
            } else {
                this.player.frame = 0;
                this.player.animTimer = 0;
            }
            // Facing locked to mouse aim
            const worldMouse = this.screenToWorld(this.mouse.x, this.mouse.y);
            if (worldMouse.x > this.player.x) this.player.facing = 1;
            else this.player.facing = -1;
        }

        this.camera.x += (-this.player.x - this.camera.x) * 0.1;
        this.camera.y += (-this.player.y - this.camera.y) * 0.1;

        // NPC AI & Industry
        this.entities.forEach(en => {
            const distToPlayer = Math.hypot(en.x - this.player.x, en.y - this.player.y);
            if (en.type === 'corpo' && en.state === 'waiting' && distToPlayer < 60) {
                en.state = 'building';
                this.player.objective = 'SYNTH VAT CONSTRUCTION IN PROGRESS';
            }
            if (en.type === 'corpo' && en.state === 'building') {
                en.buildTimer += dt;
                if (en.buildTimer > 5000) {
                    this.spawnEntity('synth-vat', en.x + 40, en.y);
                    en.state = 'idle';
                    this.player.objective = 'SYNTH PRODUCTION ONLINE';
                }
            }
            if (en.type === 'synth-vat') {
                en.spawnTimer += dt;
                if (en.spawnTimer > 8000) {
                    const types = ['synth', 'specialist', 'marine'];
                    this.spawnEntity(types[Math.floor(Math.random()*types.length)], en.x, en.y + 40);
                    en.spawnTimer = 0;
                }
            }
            if (en.type === 'synth' && en.state === 'idle') {
                en.buildTimer += dt;
                if (en.buildTimer > 3000) {
                    this.spawnEntity('specimen-tank', en.x - 40, en.y);
                    en.state = 'working';
                }
            }
            // Egg: hatch when anything living gets close
            if (en.type === 'xeno-egg') {
                const nearPlayer = distToPlayer < 70;
                const nearHuman = this.entities.some(h => h !== en && h.hp > 0 && !h.type.includes('xeno') && !h.type.includes('vat') && !h.type.includes('tank') && Math.hypot(en.x - h.x, en.y - h.y) < 70);
                if (nearPlayer || nearHuman) {
                    en.hp = 0;
                    this.spawnEntity('xeno-facehugger', en.x, en.y);
                }
            }
            // Facehugger: sprint toward nearest target, attach on contact
            if (en.type === 'xeno-facehugger') {
                const target = this.findNearestTarget(en);
                if (target) {
                    const dx = target.x - en.x, dy = target.y - en.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 0) {
                        const nx = en.x + (dx / dist) * 3 * (dt / 16);
                        const ny = en.y + (dy / dist) * 3 * (dt / 16);
                        if (!this.isWallAt(nx, ny)) { en.x = nx; en.y = ny; }
                    }
                    en.facing = dx < 0 ? -1 : 1;
                    en.animTimer += dt;
                    if (en.animTimer > 120) { en.animTimer = 0; en.animFrame = en.animFrame === 1 ? 2 : 1; }
                    if (dist < 22) {
                        if (target === this.player) { this.player.hp -= 35; }
                        else { target.infected = true; target.infectionTimer = 0; }
                        en.hp = 0;
                    }
                }
            }
            // Infection countdown: host dies, drone spawns
            if (en.infected && en.hp > 0) {
                en.infectionTimer = (en.infectionTimer || 0) + dt;
                if (en.infectionTimer > 6000) {
                    this.spawnEntity('xeno-drone', en.x, en.y);
                    en.hp = 0;
                }
            }
            // Drone & Warrior: chase nearest target, attack on cooldown
            if ((en.type === 'xeno-drone' || en.type === 'xeno-warrior') && en.hp > 0) {
                const target = this.findNearestTarget(en);
                if (target) {
                    const dx = target.x - en.x, dy = target.y - en.y;
                    const dist = Math.hypot(dx, dy);
                    const speed = en.type === 'xeno-warrior' ? 2.2 : 1.8;
                    if (dist > 20) {
                        const nx = en.x + (dx / dist) * speed * (dt / 16);
                        const ny = en.y + (dy / dist) * speed * (dt / 16);
                        if (!this.isWallAt(nx, ny)) { en.x = nx; en.y = ny; }
                        en.facing = dx < 0 ? -1 : 1;
                        en.animTimer += dt;
                        if (en.animTimer > 200) { en.animTimer = 0; en.animFrame = en.animFrame === 1 ? 2 : 1; }
                    } else {
                        en.animFrame = 0;
                    }
                    en.attackTimer += dt;
                    if (dist < 28 && en.attackTimer > 900) {
                        en.attackTimer = 0;
                        if (target === this.player) { this.player.hp -= 12; }
                        else { target.hp -= 25; }
                    }
                }
            }
        });

        // Projectiles
        this.projectiles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life--;
            this.entities.forEach(en => {
                if (en.hp > 0 && en.type.includes('xeno') && Math.hypot(en.x - p.x, en.y - p.y) < 25) {
                    en.hp -= 35; p.life = 0;
                    if (en.hp <= 0) this.player.score += 150;
                }
            });
        });
        this.projectiles = this.projectiles.filter(p => p.life > 0);
        this.entities = this.entities.filter(en => en.hp > 0 || en.type.includes('vat') || en.type.includes('tank'));

        // Win / lose checks
        const xenosNow = this.entities.filter(en => en.type.includes('xeno')).length;
        if (xenosNow > 0) this.xenosSpawned = true;
        if (this.player.hp <= 0) {
            this.player.hp = 0;
            this.triggerDeath();
        } else if (this.xenosSpawned && xenosNow === 0) {
            this.triggerClear();
        }

        this.updateHUD();
    }

    triggerDeath() {
        this.gameState = 'dead';
        const overlay = document.getElementById('overlay');
        document.getElementById('overlay-title').innerText = 'SIGNAL LOST';
        document.getElementById('overlay-score').innerText = `SCORE: ${this.player.score}`;
        const btn = document.getElementById('overlay-btn');
        btn.innerText = 'RESTART';
        btn.onclick = () => {
            this.player.hp = 100;
            this.player.score = 0;
            this.loadLevel(0);
            this.player.objective = 'FIND COLONISTS & CORPO';
        };
        overlay.classList.remove('hidden');
    }

    triggerClear() {
        this.gameState = 'clear';
        const isLastLevel = this.currentLevelIndex >= this.levels.length - 1;
        const overlay = document.getElementById('overlay');
        document.getElementById('overlay-title').innerText = isLastLevel ? 'MISSION COMPLETE' : 'DECK CLEAR';
        document.getElementById('overlay-score').innerText = `SCORE: ${this.player.score}`;
        const btn = document.getElementById('overlay-btn');
        btn.innerText = isLastLevel ? 'RESTART MISSION' : 'NEXT LEVEL';
        btn.onclick = () => {
            if (isLastLevel) {
                this.player.hp = 100;
                this.player.score = 0;
                this.loadLevel(0);
                this.player.objective = 'FIND COLONISTS & CORPO';
            } else {
                this.loadLevel(this.currentLevelIndex + 1);
                this.player.hp = 100;
                this.player.objective = 'CLEAR THE DECK';
            }
        };
        overlay.classList.remove('hidden');
    }

    updateHUD() {
        const aliens = this.entities.filter(en => en.type.includes('xeno'));
        const detailAliens = {
            egg: aliens.filter(en => en.type === 'xeno-egg').length,
            facehugger: aliens.filter(en => en.type === 'xeno-facehugger').length,
            drone: aliens.filter(en => en.type === 'xeno-drone').length,
            warrior: aliens.filter(en => en.type === 'xeno-warrior').length,
            queen: aliens.filter(en => en.type === 'xeno-queen-new').length
        };
        const terrans = this.entities.filter(en => !en.type.includes('xeno') && en.hp > 0);
        const detailTerrans = {
            colonist: terrans.filter(en => en.type === 'colonist').length,
            corpo: terrans.filter(en => en.type === 'corpo').length,
            synth: terrans.filter(en => en.type === 'synth').length,
            marine: terrans.filter(en => en.type === 'marine').length,
            specialist: terrans.filter(en => en.type === 'specialist').length
        };
        document.getElementById('count-xenos').innerText = aliens.length.toString().padStart(3, '0');
        document.getElementById('count-hosts').innerText = terrans.length.toString().padStart(3, '0');
        document.getElementById('player-hp').innerText = Math.ceil(this.player.hp).toString().padStart(3, '0') + '%';
        document.getElementById('current-level').innerText = `LEVEL ${(this.currentLevelIndex + 1).toString().padStart(2, '0')}`;
        document.getElementById('current-objective').innerText = this.player.objective;
        Object.keys(detailAliens).forEach(k => { if(document.getElementById(`count-detail-${k}`)) document.getElementById(`count-detail-${k}`).innerText = detailAliens[k].toString().padStart(2, '0'); });
        Object.keys(detailTerrans).forEach(k => { if(document.getElementById(`count-detail-${k}`)) document.getElementById(`count-detail-${k}`).innerText = detailTerrans[k].toString().padStart(2, '0'); });
    }

    getSpriteFor(en) {
        if (en.type === 'xeno-egg') return 'xeno-egg-a.png';
        if (en.type.includes('vat') || en.type.includes('tank')) return `prop-${en.type}.png`;
        const f = en.animFrame || 0;
        const walk = f === 1 ? 'walk-a' : f === 2 ? 'walk-b' : null;
        if (en.type === 'xeno-facehugger') return `xeno-facehugger-${walk || 'walk-a'}.png`;
        if (en.type.includes('xeno')) return walk ? `${en.type}-${walk}.png` : `${en.type}-idle.png`;
        if (en.infected) return `${en.type}-infected.png`;
        return walk ? `${en.type}-${walk}.png` : `${en.type}-idle.png`;
    }

    render() {
        const { ctx, canvas, zoom, camera, tileSize } = this;
        ctx.fillStyle = '#00050a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(camera.x, camera.y);

        this.map.forEach(t => {
            const img = this.sprites[t.sprite];
            if (img) ctx.drawImage(img, t.x * tileSize - 20, t.y * tileSize - 20, 40, 40);
        });

        this.interactives.forEach(obj => {
            const sName = obj.active ? 'tile-wall-button-green-on.png' : 'tile-wall-switch-down.png';
            const img = this.sprites[sName];
            if (img) ctx.drawImage(img, obj.x * tileSize - 20, obj.y * tileSize - 20, 40, 40);
        });

        this.entities.sort((a, b) => a.y - b.y).forEach(en => {
            const sName = this.getSpriteFor(en);
            const img = this.sprites[sName] || this.sprites[`${en.type}.png`];
            if (img) {
                ctx.save();
                ctx.translate(en.x, en.y);
                ctx.scale(en.facing || 1, 1);
                ctx.drawImage(img, -20, -20, 40, 40);
                ctx.restore();
            }
        });

        if (this.player.hp > 0) {
            const f = this.player.frame;
            const pSprite = f === 1 ? 'marine-walk-a.png' : f === 2 ? 'marine-walk-b.png' : 'marine-idle.png';
            const pImg = this.sprites[pSprite];
            if (pImg) {
                ctx.save();
                ctx.translate(this.player.x, this.player.y);
                ctx.scale(this.player.facing, 1);
                ctx.drawImage(pImg, -20, -20, 40, 40);
                ctx.restore();
            }
        }

        this.projectiles.forEach(p => { ctx.fillStyle = '#7fffd4'; ctx.fillRect(p.x-1, p.y-1, 3, 3); });
        ctx.restore();
    }

    loop(t = 0) {
        const rawDt = t - this.lastTime || 0;
        this.update(rawDt * this.gameSpeed);
        this.render();
        this.lastTime = t;
        requestAnimationFrame((time) => this.loop(time));
    }
}

new Game();
