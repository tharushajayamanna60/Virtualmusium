import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { createScene } from './world/scene.js';

// --- CONFIG ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwd95TjfzbNhPTOs_eFXDNylJGTw_6OqCGtJpmicM7vd3YfHhduM1bYYKoAZtUGJ5U/exec"; 

const app = document.getElementById('app');
const scene = createScene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 0); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
app.appendChild(renderer.domElement);

// --- State & Controls ---
const controls = new PointerLockControls(camera, document.body);
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let isMuseumGenerated = false;

// --- TOUCH LOOK LOGIC ---
let isTouching = false;
let previousTouch = { x: 0, y: 0 };
const touchSensitivity = 0.005;

renderer.domElement.addEventListener('touchstart', (e) => {
    isTouching = true;
    previousTouch.x = e.touches[0].pageX;
    previousTouch.y = e.touches[0].pageY;
}, { passive: false });

renderer.domElement.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    
    const touchX = e.touches[0].pageX;
    const touchY = e.touches[0].pageY;
    
    const deltaX = touchX - previousTouch.x;
    const deltaY = touchY - previousTouch.y;

    // Manually rotate camera for touch users
    camera.rotation.y -= deltaX * touchSensitivity;
    camera.rotation.x -= deltaY * touchSensitivity;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

    previousTouch.x = touchX;
    previousTouch.y = touchY;
}, { passive: false });

renderer.domElement.addEventListener('touchend', () => isTouching = false);

// --- DESKTOP CLICK TO LOCK ---
renderer.domElement.addEventListener('click', () => {
    // Only lock on non-touch devices to avoid errors
    if (isMuseumGenerated && !('ontouchstart' in window)) {
        controls.lock();
    }
});

// --- UI & MOVEMENT BUTTONS ---
const createControlButtons = () => {
    if (document.getElementById('on-screen-controls')) return;
    const btnContainer = document.createElement('div');
    btnContainer.id = 'on-screen-controls';
    btnContainer.innerHTML = `
        <style>
            #on-screen-controls { position: fixed; bottom: 30px; left: 30px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1000; }
            .row { display: flex; gap: 8px; }
            .ctrl-btn { width: 70px; height: 70px; background: rgba(0,0,0,0.6); border: 2px solid #00ff88; color: #00ff88; border-radius: 15px; font-size: 28px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
            .ctrl-btn:active { background: #00ff88; color: black; }
        </style>
        <button class="ctrl-btn" id="btn-up">▲</button>
        <div class="row">
            <button class="ctrl-btn" id="btn-left">◀</button>
            <button class="ctrl-btn" id="btn-down">▼</button>
            <button class="ctrl-btn" id="btn-right">▶</button>
        </div>
    `;
    document.body.appendChild(btnContainer);

    const bindBtn = (id, key) => {
        const el = document.getElementById(id);
        const start = (e) => { e.preventDefault(); moveState[key] = true; };
        const end = (e) => { e.preventDefault(); moveState[key] = false; };
        
        el.addEventListener('touchstart', start);
        el.addEventListener('touchend', end);
        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', end);
    };

    bindBtn('btn-up', 'forward'); bindBtn('btn-down', 'backward');
    bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
};

// --- MUSEUM BUILDER ---
async function buildGallery(rawInput) {
    const folderId = rawInput.includes('folders/') ? rawInput.split('folders/')[1].split('?')[0] : rawInput;
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?id=${folderId}`);
        const imageIds = await response.json();
        
        // Floor
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        const loader = new THREE.TextureLoader();
        imageIds.forEach((id, i) => {
            const angle = (i / imageIds.length) * Math.PI * 2;
            const url = `https://lh3.googleusercontent.com/d/${id}`;
            loader.load(url, (texture) => {
                const aspect = texture.image.width / texture.image.height;
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4 * aspect, 4), new THREE.MeshStandardMaterial({ map: texture }));
                mesh.position.set(Math.cos(angle) * 12, 2.5, Math.sin(angle) * 12);
                mesh.lookAt(0, 2.5, 0);
                scene.add(mesh);
            });
        });
    } catch (err) { console.error(err); }
}

const generateBtn = document.querySelector('button');
const folderInput = document.querySelector('input');

const startApp = (id) => {
    document.getElementById('ui').style.display = 'none';
    isMuseumGenerated = true;
    createControlButtons();
    buildGallery(id);
};

generateBtn.addEventListener('click', () => startApp(folderInput.value.trim()));

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * 400.0 * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * 400.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    renderer.render(scene, camera);
}
animate();

// --- ROUTE RESOLVER ---
if (window.location.pathname.startsWith('/f/')) {
    startApp(window.location.pathname.replace('/f/', ''));
}