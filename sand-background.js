/**
 * Premium Interactive Sand Background
 * Procedural generation, 3D footprint carving, wind-blown particles, and parallax dunes.
 */

class SandBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Configuration & styling
    this.config = {
      grainSize: 256, // size of pre-rendered grain tile
      sandColors: {
        highlight: 'hsl(35, 14%, 77%)',  // Illuminated crest (light beige-grey)
        base: 'hsl(34, 13%, 68%)',       // Valley ground (neutral sand)
        shadow: 'hsl(32, 10%, 50%)'       // Shaded slope (darker earthy grey-brown)
      },
      footprintFadeTime: 12000, // ms before footprints fully fade
      particleLife: 1500,       // ms for wind particles
      particleColor: 'rgba(230, 215, 185, 0.4)',
      maxParticles: 80
    };

    // State
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.footprints = [];
    this.particles = [];
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0, isDown: false, inside: false };
    this.scrollOffset = 0;
    this.grainPattern = null;
    this.isAnimActive = false;
    this.lastTime = 0;

    this.init();
  }

  init() {
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    
    // Generate the procedural grain tile pattern once to save performance
    this.generateGrainPattern();

    // Event listeners
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('scroll', () => {
      this.scrollOffset = window.scrollY;
      this.wakeUp();
    }, { passive: true });

    // Mouse & touch events
    const container = document.body; // Listen on body to cover all content interactions
    
    container.addEventListener('mousemove', (e) => this.handlePointerMove(e.clientX, e.clientY));
    container.addEventListener('mousedown', (e) => {
      // Ignore clicks on buttons, links, and other interactive elements
      if (e.target.closest('a, button, input, textarea, select, [role="button"]')) return;
      this.mouse.isDown = true;
      this.addFootprint(e.clientX, e.clientY + this.scrollOffset, true);
    });
    container.addEventListener('mouseup', () => this.mouse.isDown = false);
    container.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
      this.mouse.isDown = false;
    });
    container.addEventListener('mouseenter', () => {
      this.mouse.inside = true;
    });

    // Touch support
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.handlePointerMove(touch.clientX, touch.clientY);
        if (this.mouse.isDown) {
          this.addFootprint(touch.clientX, touch.clientY + this.scrollOffset, false);
        }
      }
    }, { passive: true });
    container.addEventListener('touchstart', (e) => {
      this.mouse.isDown = true;
      this.mouse.inside = true;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.mouse.x = touch.clientX;
        this.mouse.y = touch.clientY + this.scrollOffset;
        this.mouse.lastX = this.mouse.x;
        this.mouse.lastY = this.mouse.y;
        this.addFootprint(this.mouse.x, this.mouse.y, true);
      }
    }, { passive: true });
    container.addEventListener('touchend', () => {
      this.mouse.isDown = false;
      this.mouse.inside = false;
    });

    // Initial draw and wake loop
    this.wakeUp();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.wakeUp();
  }

  generateGrainPattern() {
    const tile = document.createElement('canvas');
    tile.width = this.config.grainSize;
    tile.height = this.config.grainSize;
    const tCtx = tile.getContext('2d');
    
    // Draw base fine noise grains
    const imgData = tCtx.createImageData(tile.width, tile.height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Procedural fine sand color noise matching the greyish-beige photo
      const val = Math.random();
      if (val > 0.982) {
        // Highly reflective silica sand grains (white/gold sparkles) - higher contrast & opacity
        data[i] = 255;
        data[i+1] = 252;
        data[i+2] = 240;
        data[i+3] = Math.floor(Math.random() * 110) + 70; 
      } else if (val > 0.93) {
        // Dark mineral grains (dark grey-brown) - darker & more visible
        data[i] = 65;
        data[i+1] = 58;
        data[i+2] = 50;
        data[i+3] = Math.floor(Math.random() * 90) + 40;
      } else if (val > 0.5) {
        // Fine textured background grains - higher opacity
        data[i] = 165;
        data[i+1] = 156;
        data[i+2] = 146;
        data[i+3] = Math.floor(Math.random() * 35) + 15;
      } else {
        // Transparent gap
        data[i+3] = 0;
      }
    }
    
    tCtx.putImageData(imgData, 0, 0);
    this.grainPattern = this.ctx.createPattern(tile, 'repeat');
  }

  handlePointerMove(clientX, clientY) {
    const pageX = clientX;
    const pageY = clientY + this.scrollOffset;
    
    this.mouse.x = pageX;
    this.mouse.y = pageY;
    
    // Calculate speed
    this.mouse.vx = this.mouse.x - this.mouse.lastX;
    this.mouse.vy = this.mouse.y - this.mouse.lastY;
    
    this.mouse.lastX = this.mouse.x;
    this.mouse.lastY = this.mouse.y;
    this.mouse.inside = true;

    this.wakeUp();

    // Spawn wind-blown dust particles when moving fast
    const speed = Math.sqrt(this.mouse.vx * this.mouse.vx + this.mouse.vy * this.mouse.vy);
    if (speed > 4 && this.particles.length < this.config.maxParticles) {
      const count = Math.min(Math.floor(speed / 3), 3);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.mouse.x + (Math.random() - 0.5) * 15,
          y: this.mouse.y + (Math.random() - 0.5) * 15,
          vx: this.mouse.vx * 0.15 + (Math.random() - 0.3) * 1.5,
          vy: this.mouse.vy * 0.15 + (Math.random() - 0.5) * 1.0 - 0.5, // slightly drift up
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.6 + 0.2,
          life: this.config.particleLife,
          maxLife: this.config.particleLife
        });
      }
    }

    // Add footprint depressions if mouse is clicked/dragging
    if (this.mouse.isDown) {
      this.addFootprint(this.mouse.x, this.mouse.y, false);
    }
  }

  addFootprint(x, y, isClick = false) {
    // Prevent footprint overcrowding
    if (this.footprints.length > 0) {
      const last = this.footprints[this.footprints.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      if (!isClick && dist < 12) return; // skip if too close
    }

    this.footprints.push({
      x,
      y,
      radius: isClick ? Math.random() * 6 + 18 : Math.random() * 4 + 10,
      opacity: 1.0,
      creationTime: Date.now(),
      // subtle direction offset for shadow representation
      angle: Math.atan2(this.mouse.vy || 1, this.mouse.vx || 1) + (Math.random() - 0.5) * 0.5
    });

    this.wakeUp();
  }

  wakeUp() {
    if (!this.isAnimActive) {
      this.isAnimActive = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  loop(timestamp) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    // Power saving: pause the loop if no footprints are active, no particles, and mouse is idle
    const hasActiveParticles = this.particles.length > 0;
    const hasFadingFootprints = this.footprints.length > 0;
    
    if (hasActiveParticles || hasFadingFootprints || (this.mouse.inside && Math.abs(this.mouse.vx) > 0.01)) {
      requestAnimationFrame((t) => this.loop(t));
    } else {
      this.isAnimActive = false;
      this.mouse.vx = 0;
      this.mouse.vy = 0;
    }
  }

  update(dt) {
    // 1. Update footprints (fade them out)
    const now = Date.now();
    this.footprints = this.footprints.filter(f => {
      const elapsed = now - f.creationTime;
      f.opacity = 1 - (elapsed / this.config.footprintFadeTime);
      return f.opacity > 0;
    });

    // 2. Update particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      // Add a slight wind resistance/gravity to particles
      p.vx *= 0.98;
      p.vy += 0.01; // subtle fall
      p.life -= dt;
      p.alpha = Math.max(0, (p.life / p.maxLife) * 0.7);
      return p.life > 0 && p.x >= 0 && p.x <= this.width && p.y >= 0 && p.y <= this.height;
    });

    // 3. Slow down mouse velocity coordinates
    this.mouse.vx *= 0.9;
    this.mouse.vy *= 0.9;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw base warm sand dunes (parallaxes relative to scroll)
    this.drawDunes();

    // Draw procedural fine sand grains tile on top of everything
    if (this.grainPattern) {
      ctx.save();
      ctx.fillStyle = this.grainPattern;
      ctx.globalAlpha = 1.0;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // Draw interactive carved footprints
    this.drawFootprints();

    // Draw wind-blown sand particles
    this.drawParticles();

    // Draw a subtle cursor aura (simulating sand dust lifting)
    if (this.mouse.inside) {
      ctx.save();
      const grad = ctx.createRadialGradient(this.mouse.x, this.mouse.y, 0, this.mouse.x, this.mouse.y, 60);
      grad.addColorStop(0, 'rgba(255, 245, 220, 0.15)');
      grad.addColorStop(1, 'rgba(255, 245, 220, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(this.mouse.x - 60, this.mouse.y - 60, 120, 120);
      ctx.restore();
    }
  }

  drawDunes() {
    const ctx = this.ctx;
    
    // Draw solid ground background using neutral sand base
    ctx.fillStyle = this.config.sandColors.base;
    ctx.fillRect(0, 0, this.width, this.height);

    // Setup diagonal ridge constants matching the photo's geometry
    const spacing = 135; // distance between ridges in pixels
    const angle = 40 * Math.PI / 180; // 40 degrees diagonal angle matching the photo
    
    const uX = Math.cos(angle);
    const uY = Math.sin(angle);
    const vX = -Math.sin(angle); // perpendicular vector coordinates
    const vY = Math.cos(angle);

    // Calculate projection range along the perpendicular axis to cover the screen
    const minP = -this.width * Math.sin(angle);
    const maxP = this.height * Math.cos(angle);
    const startP = Math.floor(minP / spacing) * spacing - spacing * 2;
    const endP = Math.ceil(maxP / spacing) * spacing + spacing * 2;

    // Draw wavy diagonal sand ridges from bottom-left to top-right
    for (let p = startP; p <= endP; p += spacing) {
      ctx.save();

      // Parallax scroll shift along the perpendicular direction
      const scrollShift = this.scrollOffset * 0.12; 
      const shiftedP = p - scrollShift;

      // Create a linear gradient perpendicular to the ridge to render 3D lighting shadows
      const x0 = (shiftedP - spacing) * vX;
      const y0 = (shiftedP - spacing) * vY;
      const x1 = shiftedP * vX;
      const y1 = shiftedP * vY;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, this.config.sandColors.highlight); // top of previous crest
      grad.addColorStop(0.2, this.config.sandColors.shadow);   // drop-off shadow in trough
      grad.addColorStop(0.65, this.config.sandColors.base);    // mid-tone flat valley
      grad.addColorStop(1.0, this.config.sandColors.highlight); // crest of current ridge

      ctx.fillStyle = grad;

      // Draw the wavy diagonal line representing this ridge
      ctx.beginPath();

      const minS = -600;
      const maxS = Math.max(this.width, this.height) + 600;
      const step = 20; // resolution of wavy segment lines
      let isFirst = true;

      for (let s = minS; s <= maxS; s += step) {
        // Straight diagonal coordinate
        let x = shiftedP * vX + s * uX;
        let y = shiftedP * vY + s * uY;

        // Apply organic wave noise (combination of sine/cosine waves)
        const phase = p * 0.04;
        const wave1 = Math.sin(s * 0.0035 + phase) * 35;
        const wave2 = Math.cos(s * 0.009 - phase * 1.5) * 14;
        const wave3 = Math.sin(s * 0.02 + p) * 6; // fine detail wiggle
        const noise = wave1 + wave2 + wave3;

        // Displace point perpendicular to the ridge direction
        x += noise * vX;
        y += noise * vY;

        if (isFirst) {
          ctx.moveTo(x, y);
          isFirst = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Close the path around the bottom-left boundary of the canvas to fill the slope
      ctx.lineTo(-600, this.height + 600);
      ctx.lineTo(-600, -600);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawFootprints() {
    const ctx = this.ctx;

    this.footprints.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.opacity;
      
      // Embossed/debossed 3D drop-shadow footprint effect:
      // We clip a circle, then draw offset inner shadows
      
      // 1. Dark Shadow (bottom-right edge representing depression depth)
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x + 1.5, f.y + 1.5, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(75, 55, 30, 0.16)'; // dark shadow inside
      ctx.fill();
      ctx.restore();

      // 2. Light Highlight (top-left edge representing pushed sand rim)
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x - 1.2, f.y - 1.2, f.radius - 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; // sand highlight rim
      ctx.fill();
      ctx.restore();

      // 3. Center cavity blending
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius - 1.2, 0, Math.PI * 2);
      // Create radial gradient to make center look deeper (darker)
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
      grad.addColorStop(0, 'rgba(80, 60, 40, 0.14)');
      grad.addColorStop(0.7, 'rgba(80, 60, 40, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      ctx.restore();
    });
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 235, 185, ${p.alpha})`;
      ctx.shadowBlur = 2;
      ctx.shadowColor = 'rgba(255, 235, 185, 0.3)';
      ctx.fill();
    });
    
    ctx.restore();
  }
}

// Instantiate background when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvasElement = document.createElement('canvas');
  canvasElement.id = 'sand-bg-canvas';
  
  // Basic inline fallback styling to guarantee position behind content
  Object.assign(canvasElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '-1',
    pointerEvents: 'none', // Set to none so it doesn't hijack events from page elements
    display: 'block'
  });

  // Prepend to body so it stays behind all container nodes
  document.body.prepend(canvasElement);

  // Initialize
  window.sandBackground = new SandBackground('sand-bg-canvas');
});
