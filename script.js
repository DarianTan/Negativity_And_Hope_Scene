const hintBox = document.getElementById('hintBox');

function showHint(text, duration = 2500) {
  hintBox.textContent = text;
  hintBox.classList.add('show');
  clearTimeout(hintBox._timer);
  hintBox._timer = setTimeout(() => {
    hintBox.classList.remove('show');
  }, duration);
}

const aspectDescription = document.getElementById('aspectDescription');

function showAspectDescription(title, line1, line2) {
  if (!aspectDescription) return;
  aspectDescription.innerHTML = `<strong>${title}</strong><br>${line1}<br>${line2}`;
  aspectDescription.classList.add('show');
}

function hideAspectDescription() {
  if (!aspectDescription) return;
  aspectDescription.classList.remove('show');
  aspectDescription.textContent = '';
}

const mobileMoveState = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

function isMobileLike() {
  return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
}

let currentChoiceShape = null;

window.addEventListener('keydown', (event) => {
  if (!currentChoiceShape) return;

  let targetComponent = null;

  if (currentChoiceShape.components['interactive-shape']) {
    targetComponent = currentChoiceShape.components['interactive-shape'];
  } else if (currentChoiceShape.components['portal-link']) {
    targetComponent = currentChoiceShape.components['portal-link'];
  }

  if (!targetComponent) return;

  if (event.key === '1') {
    targetComponent.chooseStay();
  }

  if (event.key === '2') {
    targetComponent.chooseLeave();
    currentChoiceShape = null;
  }
});

function setMoveState(direction, isPressed) {
  if (direction in mobileMoveState) {
    mobileMoveState[direction] = isPressed;
  }
}

function bindHoldButton(button, direction) {
  if (!button) return;

  const start = (event) => {
    event.preventDefault();
    setMoveState(direction, true);
  };

  const end = (event) => {
    event.preventDefault();
    setMoveState(direction, false);
  };

  button.addEventListener('touchstart', start, { passive: false });
  button.addEventListener('touchend', end, { passive: false });
  button.addEventListener('touchcancel', end, { passive: false });

  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', end);
  button.addEventListener('mouseleave', end);
}

window.addEventListener('DOMContentLoaded', () => {
  bindHoldButton(document.querySelector('[data-move="forward"]'), 'forward');
  bindHoldButton(document.querySelector('[data-move="backward"]'), 'backward');
  bindHoldButton(document.querySelector('[data-move="left"]'), 'left');
  bindHoldButton(document.querySelector('[data-move="right"]'), 'right');

  const stayBtn = document.getElementById('choiceStay');
  const leaveBtn = document.getElementById('choiceLeave');

if (stayBtn) {
  stayBtn.addEventListener('click', () => {
    if (!currentChoiceShape) return;

    let targetComponent = null;

    if (currentChoiceShape.components['interactive-shape']) {
      targetComponent = currentChoiceShape.components['interactive-shape'];
    } else if (currentChoiceShape.components['portal-link']) {
      targetComponent = currentChoiceShape.components['portal-link'];
    }

    if (targetComponent) targetComponent.chooseStay();
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener('click', () => {
    if (!currentChoiceShape) return;

    let targetComponent = null;

    if (currentChoiceShape.components['interactive-shape']) {
      targetComponent = currentChoiceShape.components['interactive-shape'];
    } else if (currentChoiceShape.components['portal-link']) {
      targetComponent = currentChoiceShape.components['portal-link'];
    }

    if (targetComponent) {
      targetComponent.chooseLeave();
      currentChoiceShape = null;
    }
  });
}
});

AFRAME.registerComponent('mobile-move-controls', {
  schema: {
    speed: { type: 'number', default: 1.9 }
  },

  tick: function (_, delta) {
    const dt = delta / 1000;
    if (!dt) return;

    const moveX =
      (mobileMoveState.right ? 1 : 0) - (mobileMoveState.left ? 1 : 0);

    const moveForward =
      (mobileMoveState.forward ? 1 : 0) - (mobileMoveState.backward ? 1 : 0);

    if (moveX === 0 && moveForward === 0) return;

    const camera = document.getElementById('camera');
    if (!camera) return;

    const yaw = camera.object3D.rotation.y;
    const speed = this.data.speed * dt;

    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    this.el.object3D.position.x +=
      (rightX * moveX + forwardX * moveForward) * speed;

    this.el.object3D.position.z +=
      (rightZ * moveX + forwardZ * moveForward) * speed;
  }
});

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
    this.awaitingChoice = false;
    this.isActiveRabbitHole = false;
    this.revealTimer = null;
    this.deepTimer = null;
  },

  triggerProximity: function () {
    if (this.isInside) return;
    this.isInside = true;

    const title = this.el.getAttribute('data-title');
    const prompt = this.el.getAttribute('data-prompt');

    this.awaitingChoice = true;
    this.isActiveRabbitHole = false;

    const choiceText = isMobileLike()
  ? 'Use the Stay or Leave buttons'
  : '[1] Yes, stay with it   [2] Explore other elements';

showAspectDescription(title, prompt, choiceText);

    if (this.data.hope) {
      this.el.setAttribute(
        'animation__proximityGlow',
        'property: scale; to: 1.16 1.16 1.16; dir: alternate; dur: 1200; loop: true; easing: easeInOutSine'
      );
    } else {
      this.el.setAttribute(
        'animation__proximityPulse',
        'property: scale; to: 1.14 1.14 1.14; dir: alternate; dur: 700; loop: true; easing: easeInOutSine'
      );
      this.el.setAttribute(
        'animation__proximityTilt',
        'property: rotation; to: 8 18 6; dir: alternate; dur: 1800; loop: true; easing: easeInOutSine'
      );
    }
  },

  chooseStay: function () {
    if (!this.awaitingChoice || !this.isInside) return;

    this.awaitingChoice = false;
    this.isActiveRabbitHole = true;

    const title = this.el.getAttribute('data-title');
    const line1 = this.el.getAttribute('data-line1');
    const line2 = this.el.getAttribute('data-line2');
    const second = this.el.getAttribute('data-second');

    showAspectDescription(title, line1, '');

    this.revealTimer = setTimeout(() => {
      if (!this.isInside || !this.isActiveRabbitHole) return;
      showAspectDescription(title, line1, line2);
    }, 1600);

    this.deepTimer = setTimeout(() => {
      if (!this.isInside || !this.isActiveRabbitHole) return;
      showAspectDescription(title, line2, second);
      showHint(`${title} is pulling you deeper.`, 2800);
    }, 3800);

    if (!this.hasBeenExplored) {
      this.hasBeenExplored = true;
      this.el.emit('shape-explored');
    }
  },

  chooseLeave: function () {
  if (!this.awaitingChoice || !this.isInside) return;

  this.awaitingChoice = false;
  this.isActiveRabbitHole = false;

  showHint('You chose to move on.', 1800);
  hideAspectDescription();

  this.el.removeAttribute('animation__proximityPulse');
  this.el.removeAttribute('animation__proximityTilt');
  this.el.removeAttribute('animation__proximityGlow');
  this.el.setAttribute('scale', '1 1 1');

  clearTimeout(this.revealTimer);
  clearTimeout(this.deepTimer);

  // Keep the player marked as inside so the prompt does not instantly reopen
  // until they actually step out of the radius.
  this.isInside = true;
},

  resetProximity: function () {
  if (!this.isInside && !this.awaitingChoice && !this.isActiveRabbitHole) return;

  this.isInside = false;
  this.awaitingChoice = false;
  this.isActiveRabbitHole = false;

  clearTimeout(this.revealTimer);
  clearTimeout(this.deepTimer);

  this.el.removeAttribute('animation__proximityPulse');
  this.el.removeAttribute('animation__proximityTilt');
  this.el.removeAttribute('animation__proximityGlow');
  this.el.setAttribute('scale', '1 1 1');

  hideAspectDescription();
}
});

AFRAME.registerComponent('portal-link', {
  schema: {
    radius: { type: 'number', default: 2.2 }
  },

  init: function () {
    this.isInside = false;
    this.awaitingChoice = false;
  },

  triggerProximity: function () {
    if (this.isInside) return;
    this.isInside = true;
    this.awaitingChoice = true;

    const choiceText = isMobileLike()
      ? 'Use the Stay or Leave buttons'
      : '[1] Yes, go to the next scene   [2] Stay here';

    showAspectDescription(
      'Continue Forward',
      'Would you like to be directed to the next scene through Instagram?',
      choiceText
    );

    this.el.setAttribute(
      'animation__portalPulse',
      'property: scale; to: 1.03 1.03 1.03; dir: alternate; dur: 900; loop: true; easing: easeInOutSine'
    );
  },

  chooseStay: function () {
    if (!this.awaitingChoice || !this.isInside) return;

    this.awaitingChoice = false;

    const url = this.el.getAttribute('data-url');
    showHint('Opening the next scene...', 1800);

    window.open(url, '_blank');
  },

  chooseLeave: function () {
    if (!this.awaitingChoice || !this.isInside) return;

    this.awaitingChoice = false;
    showHint('You chose to remain here.', 1800);
    hideAspectDescription();
  },

  resetProximity: function () {
    if (!this.isInside && !this.awaitingChoice) return;

    this.isInside = false;
    this.awaitingChoice = false;

    this.el.removeAttribute('animation__portalPulse');
    this.el.setAttribute('scale', '1 1 1');

    hideAspectDescription();
  }
});

AFRAME.registerComponent('proximity-manager', {
  init: function () {
    this.camera = this.el;
    this.shapes = Array.from(document.querySelectorAll('.clickable'));
    this.portals = Array.from(document.querySelectorAll('.portal-interactive'));
  },

  tick: function () {
    const cameraPos = new THREE.Vector3();
    this.camera.object3D.getWorldPosition(cameraPos);

    let nearestChoiceShape = null;
    let nearestChoiceDistance = Infinity;

    const handleTarget = (target, componentName) => {
      if (!target.getAttribute('visible')) return;

      const comp = target.components[componentName];
      if (!comp) return;

      const targetPos = new THREE.Vector3();
      target.object3D.getWorldPosition(targetPos);
      const distance = cameraPos.distanceTo(targetPos);

      if (distance < comp.data.radius) {
        comp.triggerProximity();

        if (comp.awaitingChoice && distance < nearestChoiceDistance) {
          nearestChoiceShape = target;
          nearestChoiceDistance = distance;
        }
      } else {
        comp.resetProximity();

        if (currentChoiceShape === target) {
          currentChoiceShape = null;
        }
      }
    };

    this.shapes.forEach((shape) => handleTarget(shape, 'interactive-shape'));
    this.portals.forEach((portal) => handleTarget(portal, 'portal-link'));

    currentChoiceShape = nearestChoiceShape;
  }
});

AFRAME.registerComponent('progress-manager', {
  init: function () {
    this.negativeTotal = 0;
    this.negativeExplored = new Set();
    this.hopeExplored = false;
    this.hopeShape = null;
    this.portalWall = null;
    this.progressCounter = null;
  },

  play: function () {
    this.hopeShape = document.getElementById('hopeShape');
    this.portalWall = document.getElementById('portalWall');
    this.progressCounter = document.getElementById('progressCounter');

    const shapes = document.querySelectorAll('.clickable');
    const negativeShapes = [...shapes].filter(
      (shape) => shape.getAttribute('data-group') === 'negative'
    );

    this.negativeTotal = negativeShapes.length;

    if (this.progressCounter) {
      this.progressCounter.textContent = `Negative aspects explored: 0/${this.negativeTotal}`;
    }

    shapes.forEach((shape, index) => {
      shape.dataset.shapeId = String(index);

      shape.addEventListener('shape-explored', () => {
        const group = shape.getAttribute('data-group');
        const title = shape.getAttribute('data-title');

        if (group === 'negative') {
          this.negativeExplored.add(shape.dataset.shapeId);
          this.updateNegativeProgress();
        }

        if (group === 'hope') {
          this.hopeExplored = true;
          this.updateHopeProgress(title);
        }
      });
    });
  },

  updateNegativeProgress: function () {
    if (this.progressCounter) {
      this.progressCounter.textContent =
        `Negative aspects explored: ${this.negativeExplored.size}/${this.negativeTotal}`;
    }

    if (this.negativeExplored.size === this.negativeTotal && this.hopeShape) {
      this.hopeShape.setAttribute('visible', true);

      if (this.progressCounter) {
        this.progressCounter.textContent = 'All negative aspects explored. Hope has appeared.';
      }

      showHint(
        'You have faced every negative force. Hope now reveals itself.',
        5000
      );
    }
  },

  updateHopeProgress: function (title) {
    if (!this.hopeExplored) return;

    if (this.progressCounter) {
      this.progressCounter.textContent = `${title} explored. A path forward is now open.`;
    }

    if (this.portalWall) {
      this.portalWall.setAttribute('visible', true);
    }

    showHint(
  'Hope has been explored. Approach the wall with the Instagram logo to continue.',
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

window.addEventListener('DOMContentLoaded', () => {
  function centerModelToPlaceholder(modelId, placeholderId) {
    const modelEl = document.getElementById(modelId);
    const placeholderEl = document.getElementById(placeholderId);

    if (!modelEl || !placeholderEl) return;

    modelEl.addEventListener('model-loaded', () => {
      const object3D = modelEl.object3D;
      const parent = object3D.parent;
      const mesh = modelEl.getObject3D('mesh');

      if (!mesh || !parent) return;

      console.log(`${modelId} loaded successfully`);

      const placeholderRadius =
        parseFloat(placeholderEl.getAttribute('radius')) || 0.7;
      const targetDiameter = placeholderRadius * 2;

      object3D.position.set(0, 0, 0);
      object3D.rotation.set(0, 0, 0);
      object3D.scale.set(1, 1, 1);
      object3D.updateMatrixWorld(true);

      const initialBox = new THREE.Box3().setFromObject(mesh);
      const initialSize = new THREE.Vector3();
      initialBox.getSize(initialSize);

      const largestDimension =
        Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;

      const uniformScale = targetDiameter / largestDimension;
      object3D.scale.set(uniformScale, uniformScale, uniformScale);
      object3D.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(mesh);
      const worldCenter = new THREE.Vector3();
      scaledBox.getCenter(worldCenter);

      const localCenter = parent.worldToLocal(worldCenter.clone());

      object3D.position.set(
        -localCenter.x,
        -localCenter.y,
        -localCenter.z
      );

      object3D.rotation.set(0, 0, 0);
      object3D.updateMatrixWorld(true);
    });

  modelEl.addEventListener('model-error', (event) => {
  console.error(`${modelId} failed to load`);
  console.error('detail:', event.detail);
  console.error('src:', modelEl.getAttribute('gltf-model'));
});
  }

centerModelToPlaceholder('fearModel', 'fearPlaceholder');
centerModelToPlaceholder('jealousyModel', 'jealousyPlaceholder');
centerModelToPlaceholder('chaosModel', 'chaosPlaceholder');
centerModelToPlaceholder('diseaseModel', 'diseasePlaceholder');
centerModelToPlaceholder('hopeModel', 'hopePlaceholder');
});