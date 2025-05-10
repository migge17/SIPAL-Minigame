const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD Elements
const playerNameDisplay = document.getElementById('playerNameDisplay');
const timerInfoDiv = document.getElementById('timer-info');
const taskInfoDiv = document.getElementById('task-info');
const targetBayMonitorDiv = document.getElementById('target-bay-monitor');
const progressBarSegments = document.querySelectorAll('#progress-bar-container .progress-segment');
const leaderboardList = document.getElementById('leaderboard-list');

// Modals and Inputs
const nameEntryModal = document.getElementById('name-entry-modal');
const playerNameInput = document.getElementById('playerNameInput');
const startGameButton = document.getElementById('startGameButton');
const winMessageModal = document.getElementById('win-message-modal');
const winPlayerNameSpan = document.getElementById('winPlayerName');
const finalTimeSpan = document.getElementById('final-time');
const playAgainButton = document.getElementById('playAgainButton');
const gameWrapper = document.querySelector('.game-wrapper');

// Overlay Control Buttons
const overlayUp = document.getElementById('overlay-up');
const overlayDown = document.getElementById('overlay-down');
const overlayLeft = document.getElementById('overlay-left');
const overlayRight = document.getElementById('overlay-right');
const overlayShift = document.getElementById('overlay-shift');
const overlayEnter = document.getElementById('overlay-enter');
const overlayControlsContainer = document.getElementById('overlay-controls');


// Game constants
const GAME_RESOLUTION_WIDTH = 800;
const GAME_RESOLUTION_HEIGHT = 600;
canvas.width = GAME_RESOLUTION_WIDTH;
canvas.height = GAME_RESOLUTION_HEIGHT;

const FORKLIFT_BODY_WIDTH = 32;
const FORKLIFT_BODY_HEIGHT = 48;
const FORKLIFT_CABIN_HEIGHT = FORKLIFT_BODY_HEIGHT * 0.45;
const FORKLIFT_CABIN_WIDTH = FORKLIFT_BODY_WIDTH * 0.85;
const FORKLIFT_MAST_WIDTH = FORKLIFT_BODY_WIDTH * 0.35;
const FORKLIFT_MAST_HEIGHT = FORKLIFT_BODY_HEIGHT * 0.75;
const FORK_WIDTH = 6;
const FORK_LENGTH = 42;
const FORK_SPACING = FORKLIFT_BODY_WIDTH * 0.45;

const FORKLIFT_BASE_SPEED = 1.3;
const FORKLIFT_BOOST_MULTIPLIER = 1.8;
const FORKLIFT_TURN_SPEED = 0.045;

const PACKAGE_WIDTH = 48;
const PACKAGE_HEIGHT = 28;
const PACKAGE_COLOR = '#b8860b';
const PACKAGE_STRAP_COLOR = '#2F4F4F';
const PACKAGE_ID_FONT_SIZE = 9;
const PACKAGE_ID_COLOR = '#FFFFFF';

const ZONE_LINE_WIDTH = 5;
const ZONE_LINE_COLOR = 'rgba(255, 255, 255, 0.9)';
const ZONE_DASH_PATTERN = [20, 12];

let forklift = {
    x: 60, y: GAME_RESOLUTION_HEIGHT / 2 - FORKLIFT_BODY_HEIGHT / 2,
    width: FORKLIFT_BODY_WIDTH, height: FORKLIFT_BODY_HEIGHT,
    angle: 0, color: '#FFA500',
    wheelColor: '#303030', forkColor: '#A9A9A9',
    hasPackage: false, packageData: null,
};

let activePackage = {
    id: '', x: 0, y: 0, width: PACKAGE_WIDTH, height: PACKAGE_HEIGHT,
    onForklift: false, visible: true
};

const pickupArea = { x: 50, y: 50, width: 160, height: 130, name: "PICK-UP" };
const STORAGE_BAY_WIDTH = 140;
const STORAGE_BAY_HEIGHT = 170;
const STORAGE_START_X = GAME_RESOLUTION_WIDTH - STORAGE_BAY_WIDTH - 50;
const STORAGE_Y_SPACING = 20;
const STORAGE_SLOTS_DEEP = 4;
const STORAGE_SLOTS_HIGH = 3;

let storageBays = [
    { id: "A1:1", x: STORAGE_START_X, y: 30, width: STORAGE_BAY_WIDTH, height: STORAGE_BAY_HEIGHT, name: "A1:1", packages: [] },
    { id: "A1:2", x: STORAGE_START_X, y: 30 + STORAGE_BAY_HEIGHT + STORAGE_Y_SPACING, width: STORAGE_BAY_WIDTH, height: STORAGE_BAY_HEIGHT, name: "A1:2", packages: [] },
    { id: "A1:3", x: STORAGE_START_X, y: 30 + (STORAGE_BAY_HEIGHT + STORAGE_Y_SPACING) * 2, width: STORAGE_BAY_WIDTH, height: STORAGE_BAY_HEIGHT, name: "A1:3", packages: [] },
];

let keys = {};
let playerName = "OPERATOR";
let currentTask = null;
const TOTAL_PACKAGES_TO_DELIVER = 3;
let packagesDeliveredCorrectly = 0;
let gameRunning = false;
let startTime = 0;
let gameTimerInterval = null;
let leaderboardData = [];
let gameLoopRequestId = null;

const terrainCanvas = document.createElement('canvas');
const terrainCtx = terrainCanvas.getContext('2d');
terrainCanvas.width = GAME_RESOLUTION_WIDTH;
terrainCanvas.height = GAME_RESOLUTION_HEIGHT;
let terrainGenerated = false;

let audioCtx;
let drivingSoundOscillator = null;
let drivingSoundGain = null;
let isDrivingSoundPlaying = false;

// --- Audio Functions ---
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API is not supported. Sounds will be disabled.", e);
        }
    }
}

function playTone(type, duration, frequency, volume = 0.1, detune = 0, attack = 0.01, decay = 0.01, startTimeOffset = 0) {
    if (!audioCtx) return;
    const playTime = audioCtx.currentTime + startTimeOffset;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, playTime);
    if (detune) oscillator.detune.setValueAtTime(detune, playTime);
    
    gainNode.gain.setValueAtTime(0, playTime); // Start silent
    gainNode.gain.linearRampToValueAtTime(volume, playTime + attack); // Attack
    // Simple sustain then release
    gainNode.gain.setValueAtTime(volume, playTime + attack + (duration - attack - decay)); // Sustain
    gainNode.gain.linearRampToValueAtTime(0, playTime + duration); // Release
    
    oscillator.start(playTime);
    oscillator.stop(playTime + duration);
}

function playArcadeStartSound() {
    playTone('square', 0.08, 261.63, 0.15, 0, 0.01, 0.05, 0);    // C4
    playTone('square', 0.08, 329.63, 0.15, 0, 0.01, 0.05, 0.07); // E4
    playTone('square', 0.12, 392.00, 0.18, 0, 0.01, 0.08, 0.15); // G4
    playTone('square', 0.25, 523.25, 0.2,  0, 0.01, 0.1,  0.25); // C5
}

function startDrivingSound() {
    if (!audioCtx || isDrivingSoundPlaying) return;
    isDrivingSoundPlaying = true;

    drivingSoundOscillator = audioCtx.createOscillator();
    drivingSoundGain = audioCtx.createGain();
    const biquadFilter = audioCtx.createBiquadFilter();

    drivingSoundOscillator.connect(biquadFilter);
    biquadFilter.connect(drivingSoundGain);
    drivingSoundGain.connect(audioCtx.destination);

    drivingSoundOscillator.type = 'sawtooth'; 
    drivingSoundOscillator.frequency.setValueAtTime(35, audioCtx.currentTime); 
    
    biquadFilter.type = "lowpass"; 
    biquadFilter.frequency.setValueAtTime(350, audioCtx.currentTime); 
    biquadFilter.Q.setValueAtTime(2.5, audioCtx.currentTime);

    drivingSoundGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    drivingSoundOscillator.start();
}
function stopDrivingSound() {
    if (drivingSoundOscillator && isDrivingSoundPlaying) {
        if (drivingSoundGain && drivingSoundGain.gain) { // Check if gainNode still exists
             drivingSoundGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        }
        drivingSoundOscillator.stop(audioCtx.currentTime + 0.11);
        // It's good practice to disconnect nodes when done
        if(drivingSoundOscillator) drivingSoundOscillator.disconnect();
        if(drivingSoundGain) drivingSoundGain.disconnect();
        drivingSoundOscillator = null; 
        drivingSoundGain = null;
        isDrivingSoundPlaying = false;
    }
}
function playPickupSound() { playTone('sine', 0.10, 987.77, 0.18, 0, 0.01, 0.04); } // B5
function playDropSound(deliveryNum) {
    const freqs = [523.25, 587.33, 659.25]; // C5, D5, E5
    const vols = [0.18, 0.20, 0.22];
    playTone('triangle', 0.20, freqs[deliveryNum-1] || 523.25, vols[deliveryNum-1] || 0.18, 0, 0.02, 0.08);
}
function playWinSound() {
    playTone('triangle', 0.1, 523.25, 0.2,0,0.01,0.02,0); 
    playTone('triangle', 0.1, 659.25, 0.2,0,0.01,0.02,0.1); 
    playTone('triangle', 0.1, 783.99, 0.2,0,0.01,0.02,0.2); 
    playTone('triangle', 0.3, 1046.50,0.25,0,0.01,0.05,0.3);
}
function playWrongSound() { playTone('sawtooth', 0.25, 110, 0.12, -300, 0.01, 0.1); }


// --- Canvas Resizing ---
function resizeCanvas() {
    const gameContainerElement = document.querySelector('.game-container');
    if (!gameContainerElement) return;
    const hudElement = document.querySelector('.arcade-hud');
    
    let availableWidth = gameContainerElement.clientWidth;
    if (window.innerWidth > 1150 && hudElement) { // Desktop side-by-side
        availableWidth -= (hudElement.offsetWidth + 8); // Approx HUD width + borders
    }

    const aspectRatio = GAME_RESOLUTION_WIDTH / GAME_RESOLUTION_HEIGHT;
    let newCanvasWidth = availableWidth;
    let newCanvasHeight = newCanvasWidth / aspectRatio;

    // If the height is too much for the screen (especially mobile stacked view)
    const maxDisplayHeight = window.innerHeight * (window.innerWidth <= 1150 ? 0.6 : 0.9); // More space on desktop
    if (newCanvasHeight > maxDisplayHeight) {
        newCanvasHeight = maxDisplayHeight;
        newCanvasWidth = newCanvasHeight * aspectRatio;
    }
    
    canvas.style.width = `${newCanvasWidth}px`;
    canvas.style.height = `${newCanvasHeight}px`;
}


// --- Initialization and Game Flow ---
startGameButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name && name.length <= 10 && name.length > 0) {
        playerName = name.toUpperCase();
        playerNameDisplay.textContent = playerName;
        nameEntryModal.style.display = 'none';
        gameWrapper.style.display = 'flex';
        initAudio(); 
        initGame();
        resizeCanvas(); 
    } else {
        alert("ENTER VALID NAME (1-10 CHARS)!");
    }
});

playAgainButton.addEventListener('click', () => {
    winMessageModal.style.display = 'none';
    nameEntryModal.style.display = 'flex';
    playerNameInput.value = '';
    playerNameInput.focus();
    gameWrapper.style.display = 'none';
    if (gameLoopRequestId) { cancelAnimationFrame(gameLoopRequestId); gameLoopRequestId = null; }
    stopDrivingSound();
});

function initGame() {
    playArcadeStartSound();
    if (!terrainGenerated) { drawStaticTerrain(); terrainGenerated = true; }

    forklift.x = 60; forklift.y = GAME_RESOLUTION_HEIGHT / 2 - forklift.height / 2;
    forklift.angle = 0; forklift.hasPackage = false; forklift.packageData = null;

    storageBays.forEach(bay => bay.packages = []);
    packagesDeliveredCorrectly = 0;
    updateProgressBar(); loadLeaderboard();
    
    generateNewActivePackage(); 
    assignNewTask(); 
    updateTaskInfoHUD();

    gameRunning = true; startTime = Date.now();
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(updateTimerDisplay, 100);
    updateTimerDisplay();

    if (gameLoopRequestId) cancelAnimationFrame(gameLoopRequestId);
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}

function generatePackageID() {
    const chars = "DWX"; const t = "PK";
    const r1 = Math.floor(Math.random()*90)+10; const r2 = Math.floor(Math.random()*900)+100;
    return `${t.charAt(Math.floor(Math.random()*t.length))}${r1}${chars.charAt(Math.floor(Math.random()*chars.length))}${r2}`;
}

function generateNewActivePackage() {
    activePackage.id = generatePackageID();
    activePackage.x = pickupArea.x + pickupArea.width / 2 - activePackage.width / 2;
    activePackage.y = pickupArea.y + pickupArea.height / 2 - activePackage.height / 2;
    activePackage.onForklift = false; // Reset this flag
    activePackage.visible = true; 
}

function updateTimerDisplay() { if (!gameRunning) { timerInfoDiv.textContent = '0.0'; return; } const e = (Date.now()-startTime)/1000; timerInfoDiv.textContent = `${e.toFixed(1)}`; }
function updateTaskInfoHUD() { if (!currentTask) { taskInfoDiv.textContent="SHIFT COMPLETE!"; taskInfoDiv.style.color="#00ff00"; targetBayMonitorDiv.textContent="DONE!"; return; } if (currentTask.type === 'PICKUP') { taskInfoDiv.textContent=`GET ${activePackage.id}`; taskInfoDiv.style.color="#ffff00"; targetBayMonitorDiv.textContent="- PICKUP -"; } else if (currentTask.type === 'DELIVER') { taskInfoDiv.textContent=`DELIVER ${forklift.packageData.id} > ${currentTask.targetBayId}`; taskInfoDiv.style.color="#00ffff"; targetBayMonitorDiv.textContent=`${currentTask.targetBayId}`; } }
function updateProgressBar() { progressBarSegments.forEach((s, i) => s.classList.toggle('filled', i < packagesDeliveredCorrectly)); }
function loadLeaderboard() { const sL=localStorage.getItem('arcadeForkliftLeaderboard'); leaderboardData=sL?JSON.parse(sL):[]; displayLeaderboard(); }
function saveToLeaderboard(name, time) { leaderboardData.push({name,time}); leaderboardData.sort((a,b)=>a.time-b.time); leaderboardData=leaderboardData.slice(0,5); localStorage.setItem('arcadeForkliftLeaderboard',JSON.stringify(leaderboardData)); displayLeaderboard(); }
function displayLeaderboard() { leaderboardList.innerHTML=''; if(leaderboardData.length===0){leaderboardList.innerHTML='<li>NO SCORES YET</li>';return;} leaderboardData.forEach((s,i)=>{const l=document.createElement('li');l.textContent=`${i+1}. ${s.name.toUpperCase()} - ${s.time.toFixed(1)}S`;leaderboardList.appendChild(l);});}

function assignNewTask() {
    if (packagesDeliveredCorrectly >= TOTAL_PACKAGES_TO_DELIVER) {
        gameRunning = false; clearInterval(gameTimerInterval); stopDrivingSound();
        const finalTime = (Date.now() - startTime) / 1000;
        winPlayerNameSpan.textContent = playerName; finalTimeSpan.textContent = finalTime.toFixed(1) + "s";
        winMessageModal.style.display = 'flex'; playWinSound(); saveToLeaderboard(playerName, finalTime);
        currentTask = null; updateTaskInfoHUD(); return;
    }
    if (forklift.hasPackage) {
        const randomIndex = Math.floor(Math.random() * storageBays.length);
        const target = storageBays[randomIndex];
        currentTask = { type: 'DELIVER', targetZone: target, targetBayId: target.id };
    } else {
        currentTask = { type: 'PICKUP', targetZone: pickupArea };
    }
    updateTaskInfoHUD();
}

function drawStaticTerrain() { terrainCtx.fillStyle = '#4a4a52'; terrainCtx.fillRect(0,0,GAME_RESOLUTION_WIDTH,GAME_RESOLUTION_HEIGHT); for(let i=0;i<200;i++){ const t=Math.random(); if(t<0.7){terrainCtx.fillStyle=`rgba(80,80,90,${Math.random()*0.2+0.05})`; const x=Math.random()*GAME_RESOLUTION_WIDTH;const y=Math.random()*GAME_RESOLUTION_HEIGHT;const w=Math.random()*40+20;const h=Math.random()*30+15; terrainCtx.fillRect(x-w/2,y-h/2,w,h);}else{terrainCtx.strokeStyle=`rgba(0,0,0,${Math.random()*0.3+0.1})`;terrainCtx.lineWidth=Math.random()*2+1;terrainCtx.beginPath();terrainCtx.moveTo(Math.random()*GAME_RESOLUTION_WIDTH,Math.random()*GAME_RESOLUTION_HEIGHT);terrainCtx.lineTo(Math.random()*GAME_RESOLUTION_WIDTH,Math.random()*GAME_RESOLUTION_HEIGHT);terrainCtx.stroke();}}}
function drawZoneMarking(zone) { ctx.strokeStyle=ZONE_LINE_COLOR;ctx.lineWidth=ZONE_LINE_WIDTH;ctx.setLineDash(ZONE_DASH_PATTERN);ctx.strokeRect(zone.x,zone.y,zone.width,zone.height);ctx.setLineDash([]);if(zone.name){ctx.font=`bold 11px 'Press Start 2P'`;const tM=ctx.measureText(zone.name);const tW=tM.width+10;const tX=zone.x+zone.width/2;const tY=zone.y+zone.height-12;ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(tX-tW/2,tY-10,tW,14);ctx.fillStyle='rgba(255,255,255,0.95)';ctx.textAlign='center';ctx.fillText(zone.name,tX,tY);}}

function drawForklift() { ctx.save();ctx.translate(forklift.x+forklift.width/2,forklift.y+forklift.height/2);ctx.rotate(forklift.angle);const fYPos=-forklift.height/2-FORK_LENGTH;ctx.fillStyle=forklift.forkColor;ctx.fillRect(-FORK_SPACING/2-FORK_WIDTH/2,fYPos,FORK_WIDTH,FORK_LENGTH);ctx.fillRect(FORK_SPACING/2-FORK_WIDTH/2,fYPos,FORK_WIDTH,FORK_LENGTH);ctx.fillStyle='#607D8B';ctx.fillRect(-FORKLIFT_MAST_WIDTH/2,-forklift.height/2-FORKLIFT_MAST_HEIGHT+forklift.height*0.4,FORKLIFT_MAST_WIDTH,FORKLIFT_MAST_HEIGHT);ctx.strokeStyle='#455A64';ctx.lineWidth=1;for(let i=1;i<3;i++){let yO=-forklift.height/2-FORKLIFT_MAST_HEIGHT+forklift.height*0.4+(FORKLIFT_MAST_HEIGHT/3)*i;ctx.beginPath();ctx.moveTo(-FORKLIFT_MAST_WIDTH/2,yO);ctx.lineTo(FORKLIFT_MAST_WIDTH/2,yO);ctx.stroke();}ctx.fillStyle=forklift.color;ctx.fillRect(-forklift.width/2,-forklift.height/2,forklift.width,forklift.height);ctx.strokeStyle='#D48800';ctx.lineWidth=2;ctx.strokeRect(-forklift.width/2,-forklift.height/2,forklift.width,forklift.height);ctx.fillStyle='#FFCA28';const cYOff=-forklift.height*0.1;ctx.fillRect(-FORKLIFT_CABIN_WIDTH/2,-forklift.height/2+cYOff+(FORKLIFT_BODY_HEIGHT-FORKLIFT_CABIN_HEIGHT)/2,FORKLIFT_CABIN_WIDTH,FORKLIFT_CABIN_HEIGHT);ctx.strokeStyle='#FB8C00';ctx.strokeRect(-FORKLIFT_CABIN_WIDTH/2,-forklift.height/2+cYOff+(FORKLIFT_BODY_HEIGHT-FORKLIFT_CABIN_HEIGHT)/2,FORKLIFT_CABIN_WIDTH,FORKLIFT_CABIN_HEIGHT);ctx.fillStyle='#212121';ctx.beginPath();ctx.arc(0,-forklift.height/2+cYOff+FORKLIFT_CABIN_HEIGHT*0.3,FORKLIFT_CABIN_WIDTH*0.2,0,Math.PI*2);ctx.fill();const wR=forklift.width*0.22;const rWYOff=forklift.height/2-wR*0.9;const fWYOff=-forklift.height/2+wR*0.9;ctx.fillStyle=forklift.wheelColor;ctx.beginPath();ctx.arc(-forklift.width/2+wR*0.7,rWYOff,wR,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(forklift.width/2-wR*0.7,rWYOff,wR,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-forklift.width/2+wR*0.8,fWYOff,wR*0.8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(forklift.width/2-wR*0.8,fWYOff,wR*0.8,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawPackageWithID(pkg,x,y,angle=0){if(!pkg||!pkg.visible)return;ctx.save();ctx.translate(x+pkg.width/2,y+pkg.height/2);if(angle)ctx.rotate(angle);ctx.fillStyle=PACKAGE_COLOR;ctx.fillRect(-pkg.width/2,-pkg.height/2,pkg.width,pkg.height);ctx.fillStyle=PACKAGE_STRAP_COLOR;const sH=pkg.height*0.25;ctx.fillRect(-pkg.width/2,-pkg.height/2+sH*0.3,pkg.width,sH);ctx.fillRect(-pkg.width/2,pkg.height/2-sH*1.3,pkg.width,sH);ctx.strokeStyle='#5D4037';ctx.lineWidth=2;ctx.strokeRect(-pkg.width/2,-pkg.height/2,pkg.width,pkg.height);ctx.fillStyle=PACKAGE_ID_COLOR;ctx.font=`bold ${PACKAGE_ID_FONT_SIZE}px 'Press Start 2P'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(pkg.id,0,0);ctx.restore();}
function drawStoredPackages() {storageBays.forEach(b=>{const pIB=b.packages;const pW_V=PACKAGE_WIDTH*0.65;const pH_V=PACKAGE_HEIGHT*0.65;const cW=b.width/STORAGE_SLOTS_DEEP;const rH=b.height/STORAGE_SLOTS_HIGH;pIB.forEach((pD,i)=>{const c=i%STORAGE_SLOTS_DEEP;const r=Math.floor(i/STORAGE_SLOTS_DEEP);if(r<STORAGE_SLOTS_HIGH){const pX=b.x+c*cW+(cW-pW_V)/2;const pY=b.y+b.height-(r+1)*rH+(rH-pH_V)/2;drawPackageWithID({id:pD.id,width:pW_V,height:pH_V,visible:true},pX,pY);}});});}

function updateForklift() { let effSpd=FORKLIFT_BASE_SPEED; if(keys['Shift']){effSpd*=FORKLIFT_BOOST_MULTIPLIER;} let actMvSpd=0; if(keys['ArrowUp'])actMvSpd=effSpd; else if(keys['ArrowDown'])actMvSpd=-effSpd/1.5; if(actMvSpd!==0&&gameRunning){if(!isDrivingSoundPlaying)startDrivingSound();}else{if(isDrivingSoundPlaying)stopDrivingSound();} if(keys['ArrowLeft'])forklift.angle-=FORKLIFT_TURN_SPEED; if(keys['ArrowRight'])forklift.angle+=FORKLIFT_TURN_SPEED; forklift.x+=Math.cos(forklift.angle)*actMvSpd; forklift.y+=Math.sin(forklift.angle)*actMvSpd; if(forklift.x<0)forklift.x=0; if(forklift.x+forklift.width>GAME_RESOLUTION_WIDTH)forklift.x=GAME_RESOLUTION_WIDTH-forklift.width; if(forklift.y<0)forklift.y=0; if(forklift.y+forklift.height>GAME_RESOLUTION_HEIGHT)forklift.y=GAME_RESOLUTION_HEIGHT-forklift.height; }
function checkZoneCollision(fO,zO){const fCX=fO.x+fO.width/2;const fCY=fO.y+fO.height/2;return fCX>zO.x&&fCX<zO.x+zO.width&&fCY>zO.y&&fCY<zO.y+zO.height;}

function handleInteractions() {
    if (!currentTask || !gameRunning) return;
    if (keys['Enter']) {
        keys['Enter'] = false; 

        if (currentTask.type === 'PICKUP' && !forklift.hasPackage && checkZoneCollision(forklift, pickupArea)) {
            forklift.hasPackage = true;
            forklift.packageData = { ...activePackage };
            activePackage.visible = false; 
            playPickupSound();
            assignNewTask();
        } else if (currentTask.type === 'DELIVER' && forklift.hasPackage && currentTask.targetZone && checkZoneCollision(forklift, currentTask.targetZone)) {
            if (currentTask.targetZone.id === currentTask.targetBayId) {
                const bay = storageBays.find(b => b.id === currentTask.targetBayId);
                if (bay) bay.packages.push({ id: forklift.packageData.id });

                forklift.hasPackage = false;
                // forklift.packageData = null; // Not strictly needed; will be overwritten or ignored
                
                packagesDeliveredCorrectly++;
                updateProgressBar();
                playDropSound(packagesDeliveredCorrectly);
                
                if (bay && bay.packages.length >= STORAGE_SLOTS_DEEP * STORAGE_SLOTS_HIGH) {
                    console.log(`ARCADE_EVENT: Bay ${bay.id} is visually full!`);
                }
                
                if (packagesDeliveredCorrectly < TOTAL_PACKAGES_TO_DELIVER) {
                    generateNewActivePackage();
                }
                assignNewTask();
            } else {
                taskInfoDiv.textContent = `WRONG BAY! > ${currentTask.targetBayId}`;
                taskInfoDiv.style.color = "#ff4757";
                playWrongSound();
            }
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT);
    if (terrainGenerated) ctx.drawImage(terrainCanvas, 0, 0);
    else { ctx.fillStyle = '#303038'; ctx.fillRect(0,0,GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT); }

    drawZoneMarking(pickupArea);
    storageBays.forEach(bay => drawZoneMarking(bay));
    drawStoredPackages(); 
    
    if (!forklift.hasPackage && activePackage.visible) {
        drawPackageWithID(activePackage, activePackage.x, activePackage.y);
    }
    
    drawForklift();
    if (forklift.hasPackage && forklift.packageData) {
        const localPackageOffsetX = 0; 
        const localPackageOffsetY = - (forklift.height / 2) - (FORK_LENGTH * 0.6); // Visual offset on forks

        ctx.save();
        ctx.translate(forklift.x + forklift.width / 2, forklift.y + forklift.height / 2);
        ctx.rotate(forklift.angle);
        // Draw packageData (which is a copy of an activePackage)
        drawPackageWithID(forklift.packageData, 
                          localPackageOffsetX - forklift.packageData.width / 2, 
                          localPackageOffsetY - forklift.packageData.height / 2, 
                          0); 
        ctx.restore();
    }

    if (gameRunning) { updateForklift(); handleInteractions(); }
    
    if (currentTask && currentTask.targetZone && gameRunning) { ctx.strokeStyle=(currentTask.type==='PICKUP')?'#FFFF00':'#00FFFF';ctx.lineWidth=ZONE_LINE_WIDTH-1;ctx.globalAlpha=Math.sin(Date.now()/150)*0.25+0.75;ctx.setLineDash([15,8]);ctx.strokeRect(currentTask.targetZone.x-1,currentTask.targetZone.y-1,currentTask.targetZone.width+2,currentTask.targetZone.height+2);ctx.setLineDash([]);ctx.globalAlpha=1.0; }
    
    if (gameRunning) gameLoopRequestId = requestAnimationFrame(gameLoop);
    else stopDrivingSound();
}

function handleButtonPress(keyName) { if (gameRunning && !audioCtx) initAudio(); keys[keyName] = true; if (gameRunning && (keyName === 'ArrowUp' || keyName === 'ArrowDown' || keyName === 'Shift')) { if (!isDrivingSoundPlaying && (keys['ArrowUp'] || keys['ArrowDown'])) { startDrivingSound(); } } }
function handleButtonRelease(keyName) { keys[keyName] = false; if (isDrivingSoundPlaying && (keyName === 'ArrowUp' || keyName === 'ArrowDown' || keyName === 'Shift')) { if (!keys['ArrowUp'] && !keys['ArrowDown']) { stopDrivingSound(); } } }

window.addEventListener('keydown', (e) => { if (document.activeElement === playerNameInput) return; handleButtonPress(e.key); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Shift',' '].includes(e.key)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { if (document.activeElement === playerNameInput) return; handleButtonRelease(e.key); });

const overlayButtonMap = { 'overlay-up':'ArrowUp','overlay-down':'ArrowDown','overlay-left':'ArrowLeft','overlay-right':'ArrowRight','overlay-shift':'Shift','overlay-enter':'Enter'};
for (const [bId, kName] of Object.entries(overlayButtonMap)) { const btn = document.getElementById(bId); if (btn) { btn.addEventListener('touchstart', (e)=>{e.preventDefault();handleButtonPress(kName);},{passive:false}); btn.addEventListener('touchend',(e)=>{e.preventDefault();handleButtonRelease(kName);},{passive:false}); btn.addEventListener('mousedown',(e)=>{e.preventDefault();handleButtonPress(kName);}); btn.addEventListener('mouseup',(e)=>{e.preventDefault();handleButtonRelease(kName);});}}
window.addEventListener('resize', resizeCanvas);

loadLeaderboard();