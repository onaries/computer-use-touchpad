// External pad commands reuse noVNC's pointer mapping and view-only enforcement.
export class Touchpad {
    constructor(container, getRFB, releaseCapture) {
        this.container = container;
        this.getRFB = getRFB;
        this.releaseCapture = releaseCapture;
        this.mode = 'touch';
        this.pointer = { x: 0.5, y: 0.5 };
        this.nativeActive = false;
        this.generatedMouse = new WeakSet();
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
            container.addEventListener(type, event => {
                if (event.target.tagName !== 'CANVAS') return;
                if (this.mode !== 'touchpad' || this.nativeActive || !this.getRFB() || this.getRFB().viewOnly) {
                    // Let a direct-touch gesture finish before changing input modes.
                    this.nativeActive = event.touches.length > 0;
                    return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
            }, { capture: true, passive: false });
        }
        for (const type of ['mousedown', 'mouseup', 'mousemove', 'click', 'contextmenu']) {
            container.addEventListener(type, event => {
                if (this.mode === 'touchpad' && !this.nativeActive && event.sourceCapabilities?.firesTouchEvents) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
        }
        for (const type of ['mousemove', 'gesturestart', 'gesturemove']) {
            container.addEventListener(type, event => {
                if (event.target.tagName !== 'CANVAS' || this.generatedMouse.has(event)) return;
                const point = type === 'mousemove' ? event : event.detail;
                const rect = event.target.getBoundingClientRect();
                if (rect.width && rect.height) this.pointer = {
                    x: Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width)),
                    y: Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height)),
                };
            }, true);
        }
    }

    setMode(mode) {
        if (['touch', 'touchpad'].includes(mode)) this.mode = mode;
    }

    mouse(canvas, type, button = 0, delta = {}) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const options = { bubbles: true, cancelable: true, button,
            clientX: rect.left + Math.min(rect.width - 1, this.pointer.x * rect.width),
            clientY: rect.top + Math.min(rect.height - 1, this.pointer.y * rect.height), ...delta };
        const event = type === 'wheel' ? new WheelEvent(type, options) : new MouseEvent(type, options);
        this.generatedMouse.add(event);
        canvas.dispatchEvent(event);
        if (type === 'mouseup') this.releaseCapture();
    }

    command(data) {
        const rfb = this.getRFB();
        if (this.mode !== 'touchpad' || !rfb || rfb.viewOnly) return;
        const canvas = this.container.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        if (data.action === 'move' || data.action === 'scroll') {
            if (![data.dx, data.dy].every(value => Number.isFinite(value) && Math.abs(value) <= 4096)) return;
            if (data.action === 'move') {
                this.pointer.x = Math.max(0, Math.min(1, this.pointer.x + data.dx / rect.width));
                this.pointer.y = Math.max(0, Math.min(1, this.pointer.y + data.dy / rect.height));
                this.mouse(canvas, 'mousemove');
            } else this.mouse(canvas, 'wheel', 0, { deltaX: -data.dx, deltaY: -data.dy, deltaMode: 0 });
        } else if (data.action === 'click' && [0, 2].includes(data.button)) {
            this.mouse(canvas, 'mousemove');
            this.mouse(canvas, 'mousedown', data.button);
            this.mouse(canvas, 'mouseup', data.button);
        }
    }
}

if (typeof window !== 'undefined') {
    const { default: UI } = await import('./ui.js');
    const { releaseCapture } = await import('../core/util/events.js');
    const touchpad = new Touchpad(document.getElementById('noVNC_container'), () => UI.rfb, releaseCapture);
    let parentOrigin = null;
    try {
        const referrer = new URL(document.referrer);
        if (referrer.hostname === location.hostname && referrer.port === '8088'
            && ['http:', 'https:'].includes(referrer.protocol)) parentOrigin = referrer.origin;
    } catch { /* Direct noVNC access keeps its original touch controls. */ }
    if (parentOrigin && window.parent !== window) {
        function reportStatus() {
            window.parent.postMessage({ type: 'cu-pad-status', enabled: touchpad.mode === 'touchpad'
                && document.documentElement.classList.contains('noVNC_connected') && Boolean(UI.rfb && !UI.rfb.viewOnly) }, parentOrigin);
        }
        window.addEventListener('message', event => {
            if (event.source !== window.parent || event.origin !== parentOrigin) return;
            if (event.data?.type === 'cu-input-mode' && ['touch', 'touchpad'].includes(event.data.mode)) {
                touchpad.setMode(event.data.mode);
                document.documentElement.dataset.inputMode = touchpad.mode;
                reportStatus();
            } else if (event.data?.type === 'cu-pad-input') {
                touchpad.command(event.data);
                reportStatus();
            }
        });
        new MutationObserver(reportStatus).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        window.parent.postMessage({ type: 'cu-input-ready' }, parentOrigin);
    }
}
