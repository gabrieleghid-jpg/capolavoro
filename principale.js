import { GameScene } from './GameScene.js';

document.addEventListener('DOMContentLoaded', () => {
    // Basic UI for damage percentage
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.bottom = '20px';
    ui.style.width = '100%';
    ui.style.display = 'flex';
    ui.style.justifyContent = 'space-around';
    ui.style.fontFamily = 'Orbitron, sans-serif';
    ui.style.color = 'white';
    ui.style.pointerEvents = 'none';

    ui.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 1.2rem; color: #ff4444;">PLAYER 1</div>
            <div id="p1-damage" style="font-size: 3rem; text-shadow: 0 0 10px #ff4444;">0%</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: 1.2rem; color: #4444ff;">PLAYER 2 (AI)</div>
            <div id="p2-damage" style="font-size: 3rem; text-shadow: 0 0 10px #4444ff;">0%</div>
        </div>
    `;

    document.body.appendChild(ui);

    // Controls Help
    const help = document.createElement('div');
    help.style.position = 'absolute';
    help.style.top = '20px';
    help.style.left = '20px';
    help.style.color = '#888';
    help.style.fontFamily = 'monospace';
    help.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; border: 1px solid #666; backdrop-filter: blur(5px);">
            <b style="color: #fff; font-size: 1.1rem;">CONTROLS:</b><br>
            <span style="color: #ddd;">
            WASD / ARROWS: Move (3D!)<br>
            SPACE / UP: Jump (Double Jump)<br>
            F / Z: Attack<br>
            SHIFT / E: Dash<br>
            </span>
            <br>
            <i style="color: #aaa;">Knock the opponent out of the arena!</i>
        </div>
    `;
    document.body.appendChild(help);

    const gameContainer = document.createElement('div');
    gameContainer.style.width = '100vw';
    gameContainer.style.height = '100vh';
    gameContainer.style.position = 'fixed';
    gameContainer.style.top = '0';
    gameContainer.style.left = '0';
    gameContainer.style.zIndex = '-1';
    document.body.appendChild(gameContainer);

    // Prevent duplicate initialization
    if (window._gameInstance) {
        return;
    }
    window._gameInstance = new GameScene(gameContainer);
});
