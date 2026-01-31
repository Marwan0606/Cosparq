/**
 * CoSparq AI Co-Founder 3D Orb Component
 * 
 * A floating, animated 3D orb with CoSparq gradient colors
 * that responds to voice/audio input with pulsing effects.
 */

class CofounderOrb {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Orb container not found:', containerId);
      return;
    }

    // Configuration
    this.options = {
      size: options.size || Math.min(this.container.clientWidth, this.container.clientHeight),
      idleSpeed: options.idleSpeed || 0.5,
      breatheSpeed: options.breatheSpeed || 0.8,
      breatheAmount: options.breatheAmount || 0.08,
      pulseIntensity: options.pulseIntensity || 0.3,
      ...options
    };

    // State
    this.state = 'idle'; // 'idle', 'listening', 'speaking', 'thinking'
    this.audioLevel = 0;
    this.targetAudioLevel = 0;
    this.time = 0;
    this.isInitialized = false;

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orb = null;
    this.glowMesh = null;
    this.animationId = null;

    // Initialize
    this.init();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.z = 5;

    // Create renderer with transparency
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Create the orb
    this.createOrb();

    // Create glow effect
    this.createGlow();

    // Add lights
    this.addLights();

    // Start animation
    this.animate();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    this.isInitialized = true;
  }

  createOrb() {
    // Create sphere geometry with high detail for smooth appearance
    const geometry = new THREE.SphereGeometry(1, 128, 128);

    // Custom shader material for gradient effect
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        state: { value: 0 }, // 0: idle, 1: listening, 2: speaking, 3: thinking
        color1: { value: new THREE.Color('#8400ff') },  // Purple
        color2: { value: new THREE.Color('#ba0186') },  // Magenta
        color3: { value: new THREE.Color('#f94016') },  // Red-orange
        color4: { value: new THREE.Color('#f96d16') },  // Orange
        breatheAmount: { value: this.options.breatheAmount },
        pulseIntensity: { value: this.options.pulseIntensity }
      },
      vertexShader: `
        uniform float time;
        uniform float audioLevel;
        uniform float breatheAmount;
        uniform float pulseIntensity;
        uniform float state;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplacement;
        
        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          
          // Base breathing animation
          float breathe = sin(time * 0.8) * breatheAmount;
          
          // Audio-reactive displacement
          float noiseScale = 2.0 + audioLevel * 3.0;
          float noiseSpeed = 0.5 + audioLevel * 2.0;
          float noise = snoise(position * noiseScale + time * noiseSpeed) * 0.5 + 0.5;
          
          // Voice displacement - more intense when speaking
          float voiceDisplacement = audioLevel * pulseIntensity * noise;
          
          // Thinking state - gentle wave
          float thinkingWave = 0.0;
          if (state > 2.5) {
            thinkingWave = sin(position.y * 3.0 + time * 2.0) * 0.05;
          }
          
          // Total displacement
          float totalDisplacement = breathe + voiceDisplacement + thinkingWave;
          vDisplacement = totalDisplacement;
          
          vec3 newPosition = position * (1.0 + totalDisplacement);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float audioLevel;
        uniform float state;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        uniform vec3 color4;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplacement;
        
        void main() {
          // Calculate gradient based on position and time
          float gradientPos = vPosition.y * 0.5 + 0.5;
          
          // Animate gradient flow
          float flowSpeed = 0.3 + audioLevel * 0.5;
          float flow = sin(time * flowSpeed + vPosition.x * 2.0) * 0.5 + 0.5;
          gradientPos = mix(gradientPos, flow, 0.3);
          
          // Four-color gradient
          vec3 color;
          if (gradientPos < 0.33) {
            color = mix(color1, color2, gradientPos * 3.0);
          } else if (gradientPos < 0.66) {
            color = mix(color2, color3, (gradientPos - 0.33) * 3.0);
          } else {
            color = mix(color3, color4, (gradientPos - 0.66) * 3.0);
          }
          
          // Add fresnel glow effect
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
          
          // Intensify colors based on audio
          float intensity = 1.0 + audioLevel * 0.5;
          color *= intensity;
          
          // Add rim glow
          vec3 rimColor = mix(color1, color4, 0.5);
          color = mix(color, rimColor, fresnel * 0.6);
          
          // Add subtle inner glow
          float innerGlow = 1.0 - fresnel;
          color += color * innerGlow * 0.2;
          
          // Pulsing opacity based on state
          float alpha = 0.95;
          if (state > 0.5 && state < 1.5) {
            // Listening - subtle pulse
            alpha = 0.9 + sin(time * 3.0) * 0.05;
          } else if (state > 1.5 && state < 2.5) {
            // Speaking - brighter
            alpha = 1.0;
          }
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.FrontSide
    });

    this.orb = new THREE.Mesh(geometry, material);
    this.scene.add(this.orb);
  }

  createGlow() {
    // Outer glow sphere
    const glowGeometry = new THREE.SphereGeometry(1.3, 64, 64);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 },
        color1: { value: new THREE.Color('#8400ff') },
        color4: { value: new THREE.Color('#f96d16') }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float audioLevel;
        uniform vec3 color1;
        uniform vec3 color4;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 4.0);
          
          // Gradient glow color
          float gradientPos = sin(time * 0.5 + vPosition.y) * 0.5 + 0.5;
          vec3 glowColor = mix(color1, color4, gradientPos);
          
          // Audio-reactive intensity
          float intensity = 0.3 + audioLevel * 0.7;
          
          // Pulsing
          float pulse = sin(time * 2.0) * 0.1 + 0.9;
          
          float alpha = fresnel * intensity * pulse * 0.4;
          
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(this.glowMesh);
  }

  addLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Point lights for dynamic lighting
    const purpleLight = new THREE.PointLight(0x8400ff, 1, 10);
    purpleLight.position.set(-2, 2, 2);
    this.scene.add(purpleLight);

    const orangeLight = new THREE.PointLight(0xf96d16, 1, 10);
    orangeLight.position.set(2, -2, 2);
    this.scene.add(orangeLight);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    this.time += 0.016; // ~60fps

    // Smooth audio level transition
    this.audioLevel += (this.targetAudioLevel - this.audioLevel) * 0.1;

    // Update uniforms
    if (this.orb && this.orb.material.uniforms) {
      this.orb.material.uniforms.time.value = this.time;
      this.orb.material.uniforms.audioLevel.value = this.audioLevel;
      this.orb.material.uniforms.state.value = this.getStateValue();
    }

    if (this.glowMesh && this.glowMesh.material.uniforms) {
      this.glowMesh.material.uniforms.time.value = this.time;
      this.glowMesh.material.uniforms.audioLevel.value = this.audioLevel;
    }

    // Idle floating animation
    if (this.orb) {
      this.orb.rotation.y = this.time * 0.1;
      this.orb.position.y = Math.sin(this.time * this.options.idleSpeed) * 0.1;
    }

    if (this.glowMesh) {
      this.glowMesh.rotation.y = this.time * 0.1;
      this.glowMesh.position.y = this.orb.position.y;
    }

    this.renderer.render(this.scene, this.camera);
  }

  getStateValue() {
    switch (this.state) {
      case 'listening': return 1;
      case 'speaking': return 2;
      case 'thinking': return 3;
      default: return 0;
    }
  }

  // Public API methods

  /**
   * Set the current state of the orb
   * @param {string} state - 'idle', 'listening', 'speaking', 'thinking'
   */
  setState(state) {
    this.state = state;
  }

  /**
   * Set the audio level for voice-reactive animation
   * @param {number} level - Audio level from 0 to 1
   */
  setAudioLevel(level) {
    this.targetAudioLevel = Math.min(1, Math.max(0, level));
  }

  /**
   * Simulate speaking with random audio levels
   * Useful for testing or when using TTS without audio analysis
   */
  simulateSpeaking(duration = 3000) {
    this.setState('speaking');
    
    const startTime = Date.now();
    const pulse = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        // Random but smooth audio level simulation
        const base = Math.sin(elapsed * 0.01) * 0.3 + 0.5;
        const noise = Math.random() * 0.3;
        this.setAudioLevel(base + noise);
        requestAnimationFrame(pulse);
      } else {
        this.setAudioLevel(0);
        this.setState('idle');
      }
    };
    pulse();
  }

  /**
   * Pulse animation for thinking state
   */
  startThinking() {
    this.setState('thinking');
    this.setAudioLevel(0.2);
  }

  /**
   * Stop thinking animation
   */
  stopThinking() {
    this.setState('idle');
    this.setAudioLevel(0);
  }

  /**
   * Start listening state
   */
  startListening() {
    this.setState('listening');
  }

  /**
   * Stop listening state
   */
  stopListening() {
    this.setState('idle');
    this.setAudioLevel(0);
  }

  onResize() {
    if (!this.container || !this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }

    if (this.orb) {
      this.orb.geometry.dispose();
      this.orb.material.dispose();
    }

    if (this.glowMesh) {
      this.glowMesh.geometry.dispose();
      this.glowMesh.material.dispose();
    }

    window.removeEventListener('resize', () => this.onResize());
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CofounderOrb;
}
