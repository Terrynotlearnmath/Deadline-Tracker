/* ============================================================
   Fireworks & Confetti Celebration Module
   Standalone canvas-based particle animation system
   ============================================================ */

(function () {
  'use strict';

  var COLORS = [
    '#FFD700', // Gold
    '#FF453A', // Red
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF2D55', // Magenta
    '#5AC8FA', // Cyan
  ];

  var TOTAL_DURATION = 3000;
  var BURST_COUNT_MIN = 5;
  var BURST_COUNT_MAX = 8;
  var BURST_STAGGER_WINDOW = 1500;
  var PARTICLES_PER_BURST_MIN = 40;
  var PARTICLES_PER_BURST_MAX = 80;
  var CONFETTI_COUNT_MIN = 30;
  var CONFETTI_COUNT_MAX = 50;
  var GRAVITY = 0.15;
  var AIR_RESISTANCE = 0.98;
  var PARTICLE_FADE_MIN = 1.5;
  var PARTICLE_FADE_MAX = 2.5;
  var CONFETTI_FADE_DURATION = 3.0;

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function pickColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 255, b: 255 };
  }

  /* ----------------------------------------------------------
     Particle class
     ---------------------------------------------------------- */
  function Particle(x, y, color) {
    var angle = Math.random() * Math.PI * 2;
    var speed = randomRange(2, 10);

    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - randomRange(1, 3);
    this.color = hexToRgb(color);
    this.alpha = 1;
    this.fadeRate = 1 / (randomRange(PARTICLE_FADE_MIN, PARTICLE_FADE_MAX) * 60);
    this.size = randomRange(2, 5);
    this.isStreak = Math.random() < 0.3;
    this.streakLength = randomRange(4, 10);
    this.alive = true;
  }

  Particle.prototype.update = function () {
    this.vy += GRAVITY;
    this.vx *= AIR_RESISTANCE;
    this.vy *= AIR_RESISTANCE;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.fadeRate;
    if (this.alpha <= 0) {
      this.alpha = 0;
      this.alive = false;
    }
  };

  Particle.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    var r = this.color.r;
    var g = this.color.g;
    var b = this.color.b;

    if (this.isStreak) {
      var prevX = this.x - this.vx * this.streakLength * 0.3;
      var prevY = this.y - this.vy * this.streakLength * 0.3;
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + this.alpha + ')';
      ctx.lineWidth = this.size * 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + this.alpha + ')';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  /* ----------------------------------------------------------
     Confetti class
     ---------------------------------------------------------- */
  function Confetti(canvasWidth, canvasHeight) {
    this.x = randomRange(canvasWidth * 0.1, canvasWidth * 0.9);
    this.y = randomRange(-50, canvasHeight * 0.3);
    this.width = randomRange(6, 12);
    this.height = randomRange(4, 8);
    this.color = hexToRgb(pickColor());
    this.alpha = 1;
    this.fadeRate = 1 / (CONFETTI_FADE_DURATION * 60);
    this.vy = randomRange(1.5, 3.5);
    this.vx = randomRange(-0.8, 0.8);
    this.swayAmplitude = randomRange(0.5, 2);
    this.swayFrequency = randomRange(0.02, 0.05);
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = randomRange(-0.08, 0.08);
    this.scaleX = 1;
    this.wobbleSpeed = randomRange(0.03, 0.08);
    this.tick = Math.random() * 100;
    this.alive = true;
  }

  Confetti.prototype.update = function () {
    this.tick++;
    this.x += this.vx + Math.sin(this.tick * this.swayFrequency) * this.swayAmplitude;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
    this.scaleX = Math.cos(this.tick * this.wobbleSpeed);
    this.alpha -= this.fadeRate;
    if (this.alpha <= 0) {
      this.alpha = 0;
      this.alive = false;
    }
  };

  Confetti.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, 1);

    var r = this.color.r;
    var g = this.color.g;
    var b = this.color.b;
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + this.alpha + ')';
    ctx.fillRect(-this.width * 0.5, -this.height * 0.5, this.width, this.height);

    ctx.restore();
  };

  /* ----------------------------------------------------------
     Main celebration function
     ---------------------------------------------------------- */
  window.showCelebration = function (onComplete) {
    var dpr = window.devicePixelRatio || 1;
    var width = window.innerWidth;
    var height = window.innerHeight;

    /* --- Create overlay container --- */
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;pointer-events:none;';

    /* --- Create canvas --- */
    var canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    overlay.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    /* --- Create congrats text --- */
    var congratsEl = document.createElement('div');
    congratsEl.textContent = '🎉 Congrats!';
    congratsEl.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%) scale(0.5)',
      'font-size:52px',
      'font-weight:700',
      'color:#fff',
      'font-family:-apple-system,Inter,sans-serif',
      'text-shadow:0 0 20px rgba(255,215,0,0.6),0 0 40px rgba(255,215,0,0.3),0 0 80px rgba(255,215,0,0.15)',
      'opacity:0',
      'pointer-events:none',
      'user-select:none',
      'white-space:nowrap',
      'z-index:10000',
    ].join(';');
    overlay.appendChild(congratsEl);

    document.body.appendChild(overlay);

    /* --- Particle systems --- */
    var particles = [];
    var confetti = [];

    /* --- Schedule firework bursts --- */
    var burstCount = randomInt(BURST_COUNT_MIN, BURST_COUNT_MAX);
    for (var b = 0; b < burstCount; b++) {
      (function (index) {
        var delay = (index / burstCount) * BURST_STAGGER_WINDOW;
        setTimeout(function () {
          spawnBurst();
        }, delay);
      })(b);
    }

    function spawnBurst() {
      var bx = randomRange(width * 0.2, width * 0.8);
      var by = randomRange(height * 0.15, height * 0.45);
      var count = randomInt(PARTICLES_PER_BURST_MIN, PARTICLES_PER_BURST_MAX);
      for (var i = 0; i < count; i++) {
        particles.push(new Particle(bx, by, pickColor()));
      }
    }

    /* --- Spawn confetti --- */
    var confettiCount = randomInt(CONFETTI_COUNT_MIN, CONFETTI_COUNT_MAX);
    for (var c = 0; c < confettiCount; c++) {
      confetti.push(new Confetti(width, height));
    }

    /* --- Animate congrats text with spring effect --- */
    var textStartTime = null;
    var TEXT_APPEAR_DELAY = 300;
    var TEXT_SPRING_DURATION = 500;
    var TEXT_VISIBLE_DURATION = 1700;
    var TEXT_FADE_DURATION = 500;

    function updateCongratsText(elapsed) {
      var textElapsed = elapsed - TEXT_APPEAR_DELAY;
      if (textElapsed < 0) {
        congratsEl.style.opacity = '0';
        congratsEl.style.transform = 'translate(-50%,-50%) scale(0.5)';
        return;
      }

      if (textElapsed < TEXT_SPRING_DURATION) {
        var t = textElapsed / TEXT_SPRING_DURATION;
        var springT = 1 - Math.pow(1 - t, 3);
        var overshoot = 1 + 0.15 * Math.sin(t * Math.PI);
        var scale = 0.5 + (overshoot - 0.5) * springT;
        var opacity = Math.min(1, t * 2);
        congratsEl.style.opacity = String(opacity);
        congratsEl.style.transform =
          'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
      } else if (textElapsed < TEXT_SPRING_DURATION + TEXT_VISIBLE_DURATION) {
        congratsEl.style.opacity = '1';
        congratsEl.style.transform = 'translate(-50%,-50%) scale(1)';
      } else {
        var fadeElapsed =
          textElapsed - TEXT_SPRING_DURATION - TEXT_VISIBLE_DURATION;
        var fadeT = Math.min(1, fadeElapsed / TEXT_FADE_DURATION);
        var opacity2 = 1 - fadeT;
        var scaleFade = 1 + fadeT * 0.05;
        congratsEl.style.opacity = String(Math.max(0, opacity2));
        congratsEl.style.transform =
          'translate(-50%,-50%) scale(' + scaleFade.toFixed(3) + ')';
      }
    }

    /* --- Animation loop --- */
    var startTime = performance.now();
    var animationId = null;
    var finished = false;

    function animate(now) {
      if (finished) return;

      var elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      /* Update and draw particles */
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.update();
        if (p.alive) {
          p.draw(ctx);
        } else {
          particles.splice(i, 1);
        }
      }

      /* Update and draw confetti */
      for (var j = confetti.length - 1; j >= 0; j--) {
        var cf = confetti[j];
        cf.update();
        if (cf.alive) {
          cf.draw(ctx);
        } else {
          confetti.splice(j, 1);
        }
      }

      /* Update congrats text */
      updateCongratsText(elapsed);

      /* Check completion */
      if (elapsed >= TOTAL_DURATION && particles.length === 0 && confetti.length === 0) {
        cleanup();
        return;
      }

      /* Force cleanup after generous timeout */
      if (elapsed >= TOTAL_DURATION + 1500) {
        cleanup();
        return;
      }

      animationId = requestAnimationFrame(animate);
    }

    function cleanup() {
      if (finished) return;
      finished = true;

      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      /* Fade out overlay gracefully */
      overlay.style.transition = 'opacity 0.3s ease';
      overlay.style.opacity = '0';

      setTimeout(function () {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 350);
    }

    /* --- Start --- */
    animationId = requestAnimationFrame(animate);
  };
})();
