const hintBox = document.getElementById('hintBox');

function showHint(text, duration = 2500) {
  hintBox.textContent = text;
  hintBox.classList.add('show');
  clearTimeout(hintBox._timer);
  hintBox._timer = setTimeout(() => {
    hintBox.classList.remove('show');
  }, duration);
}

AFRAME.registerComponent('float-motion', {
  schema: {
    speed: { type: 'number', default: 1 },
    range: { type: 'number', default: 0.2 }
  },
  init: function () {
    this.startY = this.el.object3D.position.y;
    this.startX = this.el.object3D.position.x;
    this.startZ = this.el.object3D.position.z;
    this.offset = Math.random() * Math.PI * 2;
    this.startRot = {
      x: this.el.object3D.rotation.x,
      y: this.el.object3D.rotation.y,
      z: this.el.object3D.rotation.z
    };
  },
  tick: function (time) {
    const t = time / 1000;
    this.el.object3D.position.x = this.startX;
    this.el.object3D.position.z = this.startZ;
    this.el.object3D.position.y = this.startY + Math.sin(t * this.data.speed + this.offset) * this.data.range;
    this.el.object3D.rotation.x = this.startRot.x + Math.sin(t * 0.18 + this.offset) * 0.04;
    this.el.object3D.rotation.y = this.startRot.y + Math.sin(t * 0.22 + this.offset) * 0.06;
  }
});

AFRAME.registerComponent('interactive-shape', {
  schema: {
    hope: { type: 'boolean', default: false },
    radius: { type: 'number', default: 1.85 }
  },
  init: function () {
    this.state = 0;
    this.isInside = false;
    this.hasBeenExplored = false;
    this.infoEl = null;
  },
  triggerProximity: function () {
    if (this.isInside) return;
    this.isInside = true;

    const title = this.el.getAttribute('data-title');
    const line1 = this.el.getAttribute('data-line1');
    const line2 = this.el.getAttribute('data-line2');

    showHint(title + ': ' + line1, 5000);
    this.spawnText(title, line2);

    if (this.data.hope) {
      this.el.setAttribute(
        'animation__proximityGlow',
        'property: scale; to: 1.28 1.28 1.28; dir: alternate; dur: 900; loop: true; easing: easeInOutSine'
      );
      document.querySelector('a-scene').setAttribute('background', 'color: #0c1010');
    } else {
      this.el.setAttribute(
        'animation__proximityPulse',
        'property: scale; to: 1.22 1.22 1.22; dir: alternate; dur: 500; loop: true; easing: easeInOutSine'
      );
      this.el.setAttribute(
        'animation__proximityTilt',
        'property: rotation; to: 12 25 8; dir: alternate; dur: 1400; loop: true; easing: easeInOutSine'
      );
    }

    this.state = 1;

    if (!this.hasBeenExplored) {
      this.hasBeenExplored = true;
      this.el.emit('shape-explored');
    }
  },
  resetProximity: function () {
    if (!this.isInside) return;
    this.isInside = false;
    this.el.removeAttribute('animation__proximityPulse');
    this.el.removeAttribute('animation__proximityTilt');
    this.el.removeAttribute('animation__proximityGlow');
    this.el.setAttribute('scale', '1 1 1');

    if (this.infoEl && this.infoEl.parentNode) {
      this.infoEl.parentNode.removeChild(this.infoEl);
      this.infoEl = null;
    }
  },
  spawnText: function (title, body) {
    const existing = this.el.querySelector('.infoText');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    const text = document.createElement('a-entity');
    text.classList.add('infoText');
    text.setAttribute('text', {
      value: `${title}\n${body}`,
      align: 'center',
      color: '#FFFFFF',
      width: 1.35,
      wrapCount: 12
    });
    text.setAttribute('position', '0 0.82 0');
    text.setAttribute('look-at', '#camera');
    this.el.appendChild(text);
    this.infoEl = text;
  },
  deepenInteraction: function () {
    if (this.data.hope) {
      this.el.setAttribute(
        'animation__glowhope',
        'property: scale; to: 1.6 1.6 1.6; dur: 700; direction: alternate; loop: 1'
      );
      showHint('Hope becomes visible only after you decide it is worth approaching.', 4500);
    } else {
      this.el.setAttribute(
        'animation__spinburst',
        'property: rotation; to: 260 320 180; dur: 900; easing: easeInOutQuad'
      );
    }
  }
});

AFRAME.registerComponent('proximity-manager', {
  init: function () {
    this.camera = this.el;
    this.prompt = document.getElementById('interactionText');
    this.shapes = Array.from(document.querySelectorAll('.clickable'));
  },
  tick: function () {
    const cameraPos = new THREE.Vector3();
    this.camera.object3D.getWorldPosition(cameraPos);

    let nearest = null;
    let nearestDistance = Infinity;

    this.shapes.forEach((shape) => {
      const shapePos = new THREE.Vector3();
      shape.object3D.getWorldPosition(shapePos);
      const distance = cameraPos.distanceTo(shapePos);
      const comp = shape.components['interactive-shape'];
      if (!comp) return;

      if (distance < comp.data.radius) {
        comp.triggerProximity();
      } else {
        comp.resetProximity();
      }

      if (distance < nearestDistance) {
        nearest = shape;
        nearestDistance = distance;
      }
    });

    if (nearest && this.prompt) {
      const title = nearest.getAttribute('data-title');
      const prompt = nearest.getAttribute('data-prompt');
      this.prompt.setAttribute('text', 'value', `${title}\n${prompt}`);
    }
  }
});

AFRAME.registerComponent('progress-manager', {
  init: function () {
    this.totalShapes = 0;
    this.explored = new Set();
    this.completionText = null;
    this.portalWall = null;
  },
  play: function () {
    this.totalShapes = document.querySelectorAll('.clickable').length;
    this.completionText = document.getElementById('completionText');
    this.portalWall = document.getElementById('portalWall');
    const shapes = document.querySelectorAll('.clickable');

    shapes.forEach((shape, index) => {
      shape.dataset.shapeId = String(index);
      shape.addEventListener('shape-explored', () => {
        this.explored.add(shape.dataset.shapeId);
        this.updateProgress();
      });
    });
  },
  updateProgress: function () {
    if (!this.completionText) return;

    if (this.explored.size < this.totalShapes) {
      this.completionText.setAttribute('text', 'value', `Explored: ${this.explored.size}/${this.totalShapes}`);
      this.completionText.setAttribute('visible', true);
      return;
    }

    this.completionText.setAttribute('text', 'value', 'You have explored all there is. Proceed to the next phase.');
    this.completionText.setAttribute('visible', true);

    if (this.portalWall) {
      this.portalWall.setAttribute('visible', true);
    }

    showHint(
      'A path forward has appeared. Approach the wall and scan the QR code to continue. Use a phone camera for best results.',
      7000
    );
  }
});

AFRAME.registerComponent('look-at', {
  schema: { type: 'selector' },
  tick: function () {
    if (!this.data) return;
    const target = this.data.object3D.position;
    this.el.object3D.lookAt(target);
  }
});

AFRAME.registerComponent('particle-field', {
  schema: {
    count: { type: 'int', default: 30 }
  },
  init: function () {
    for (let i = 0; i < this.data.count; i++) {
      const p = document.createElement('a-sphere');
      const x = (Math.random() - 0.5) * 22;
      const y = Math.random() * 5 + 0.5;
      const z = (Math.random() - 0.5) * 22;
      const scale = (Math.random() * 0.08 + 0.02).toFixed(2);
      p.setAttribute('position', `${x} ${y} ${z}`);
      p.setAttribute('radius', scale);
      p.setAttribute('color', Math.random() > 0.75 ? '#d9f99d' : '#777777');
      p.setAttribute('material', 'emissive: #666; emissiveIntensity: 0.6; shader: standard');
      p.setAttribute('float-motion', `speed: ${0.12 + Math.random() * 0.25}; range: ${0.015 + Math.random() * 0.035}`);
      this.el.appendChild(p);
    }
  }
});
