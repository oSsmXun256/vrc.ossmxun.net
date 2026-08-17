/*!
 * minaui.glass.js V2.0
 * MinaUI optional WebGL liquid-glass module
 *
 * Copyright (c) 2026 oSsmXun
 */

class MinaGlass {
    constructor(options = {}) {
        this.canvas = options.canvas || document.getElementById('mina-glcanvas');
        if (!this.canvas) {
            console.warn('MinaGlass: Canvas element not found');
            return;
        }

        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: true,
            alpha: true
        });

        if (!this.gl) {
            console.error('MinaGlass: WebGL2 not supported');
            return;
        }

        // Configuration
        this.config = {
            saturate: options.saturate === undefined ? 1.2 : options.saturate,
            ...options
        };

        // State
        this.texture = null;
        this.program = null;
        this.uniforms = {};
        this.vao = null;
        this.imgW = 1;
        this.imgH = 1;
        this.whiteness = options.whiteLevel || 0;
        this.maxCards = Math.max(1, Math.min(8, options.maxCards || 4));

        this.initialize();
        this.setupEventListeners();
    }

    /**
     * Initialize WebGL and shaders
     */
    initialize() {
        const gl = this.gl;

        // Vertex shader
        const vsSource = `#version 300 es
            precision highp float;

            in vec2 position;
            out vec2 fragCoord;

            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
                fragCoord = (position + 1.0) / 2.0;
            }
        `;

        // Liquid lens-refraction fragment shader (multi-card)
        const fsSource = `#version 300 es
            precision highp float;

            uniform vec3 resolution;
            uniform sampler2D uTexture;
            uniform vec2 imgRes;
            uniform vec2 cardPos[8];
            uniform vec2 cardHalf[8];
            uniform int cardCount;
            uniform float white;
            uniform float saturate;

            in vec2 fragCoord;
            out vec4 outColor;

            vec3 rgbToHsl(vec3 rgb) {
                float maxC = max(rgb.r, max(rgb.g, rgb.b));
                float minC = min(rgb.r, min(rgb.g, rgb.b));
                float l = (maxC + minC) / 2.0;
                float h = 0.0;
                float s = 0.0;
                if (maxC != minC) {
                    float d = maxC - minC;
                    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
                    if (maxC == rgb.r) {
                        h = mod((rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0), 6.0) / 6.0;
                    } else if (maxC == rgb.g) {
                        h = ((rgb.b - rgb.r) / d + 2.0) / 6.0;
                    } else {
                        h = ((rgb.r - rgb.g) / d + 4.0) / 6.0;
                    }
                }
                return vec3(h, s, l);
            }

            vec3 hslToRgb(vec3 hsl) {
                float c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
                float hp = hsl.x * 6.0;
                float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
                vec3 rgb = vec3(0.0);
                if (hp < 1.0) rgb = vec3(c, x, 0.0);
                else if (hp < 2.0) rgb = vec3(x, c, 0.0);
                else if (hp < 3.0) rgb = vec3(0.0, c, x);
                else if (hp < 4.0) rgb = vec3(0.0, x, c);
                else if (hp < 5.0) rgb = vec3(x, 0.0, c);
                else rgb = vec3(c, 0.0, x);
                float m = hsl.z - c / 2.0;
                return rgb + vec3(m);
            }

            vec3 adjustSaturation(vec3 rgb, float sat) {
                vec3 hsl = rgbToHsl(rgb);
                hsl.y = clamp(hsl.y * sat, 0.0, 1.0);
                return hslToRgb(hsl);
            }

            // "cover"-fit UV mapping (like CSS background-size: cover)
            vec2 coverUv(vec2 uv) {
                float ca = resolution.x / resolution.y;
                float ia = imgRes.x / imgRes.y;
                vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
                return (uv - 0.5) * s + 0.5;
            }

            void main() {
                vec2 fragPx = fragCoord * resolution.xy;
                vec2 uv = fragCoord;

                vec4 bg = texture(uTexture, coverUv(uv));
                vec4 color = bg;

                for (int c = 0; c < 8; c++) {
                    if (c >= cardCount) break;
                    vec2 chalf = cardHalf[c];
                    float radius = min(min(chalf.x, chalf.y), 32.0);
                    vec2 q = abs(fragPx - cardPos[c]) - (chalf - radius);
                    float sdf = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
                    float roundedBox = 1.0 + sdf / radius;

                    float rb1 = clamp((1.0 - roundedBox) * 8.0, 0.0, 1.0);
                    float rb2 = clamp((0.955 - roundedBox * 0.95) * 16.0, 0.0, 1.0) -
                                clamp((0.91  - roundedBox * 0.95) * 16.0, 0.0, 1.0);
                    float rb3 = clamp((1.5 - roundedBox * 1.1) * 2.0, 0.0, 1.0) -
                                clamp((1.0 - roundedBox * 1.1) * 2.0, 0.0, 1.0);

                    float transition = smoothstep(0.0, 1.0, rb1 + rb2);
                    if (transition <= 0.0) continue;

                    vec2 cuv = cardPos[c] / resolution.xy;
                    vec2 lens = cuv + (uv - cuv) * (1.0 - roundedBox * 0.18);

                    vec4 acc = vec4(0.0);
                    float total = 0.0;
                    for (float x = -2.0; x <= 2.0; x++) {
                        for (float y = -2.0; y <= 2.0; y++) {
                            vec2 off = vec2(x, y) * 2.0 / resolution.xy;
                            acc += texture(uTexture, coverUv(lens + off));
                            total += 1.0;
                        }
                    }
                    acc /= total;

                    float dy = uv.y - cuv.y;
                    float gradient = clamp((clamp(dy, 0.0, 0.2) + 0.1) / 2.0, 0.0, 1.0) +
                                     clamp((clamp(-dy, -1000.0, 0.2) * rb3 + 0.1) / 2.0, 0.0, 1.0);
                    vec4 lighting = clamp(acc + vec4(rb1) * gradient + vec4(rb2) * 0.3, 0.0, 1.0);

                    lighting.rgb = adjustSaturation(lighting.rgb, saturate);

                    // Auto-contrast for legible white text: pull bright
                    // backgrounds toward a mid-dark tone, leave dark ones alone.
                    float luma = dot(lighting.rgb, vec3(0.299, 0.587, 0.114));
                    float darken = smoothstep(0.45, 0.85, luma) * 0.55;
                    lighting.rgb = mix(lighting.rgb, lighting.rgb * 0.35, darken);

                    lighting = mix(lighting, vec4(1.0), white * 0.97);

                    color = mix(color, lighting, transition);
                }

                outColor = vec4(color.rgb, 1.0);
            }
        `;

        // Compile shaders
        const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);

        if (!vs || !fs) return;

        // Create program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('MinaGlass: Program linking failed:', gl.getProgramInfoLog(this.program));
            return;
        }

        gl.useProgram(this.program);

        // Setup VAO
        this.setupVAO();

        // Get uniform locations
        this.uniforms = {
            resolution: gl.getUniformLocation(this.program, 'resolution'),
            texture: gl.getUniformLocation(this.program, 'uTexture'),
            imgRes: gl.getUniformLocation(this.program, 'imgRes'),
            cardPos: gl.getUniformLocation(this.program, 'cardPos'),
            cardHalf: gl.getUniformLocation(this.program, 'cardHalf'),
            cardCount: gl.getUniformLocation(this.program, 'cardCount'),
            white: gl.getUniformLocation(this.program, 'white'),
            saturate: gl.getUniformLocation(this.program, 'saturate')
        };

        // Setup default texture
        this.setupDefaultTexture();

        // Set canvas size
        this.setCanvasSize();
    }

    /**
     * Compile a shader
     */
    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('MinaGlass: Shader compilation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Setup Vertex Array Object
     */
    setupVAO() {
        const gl = this.gl;

        // Fullscreen quad vertices
        const vertices = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const posLocation = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(posLocation);
        gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    /**
     * Setup default texture
     */
    setupDefaultTexture() {
        const gl = this.gl;

        // Create a gradient texture
        const width = 512;
        const height = 512;
        const data = new Uint8Array(width * height * 4);

        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                const idx = (j * width + i) * 4;
                const dist = Math.sqrt(Math.pow(i - width/2, 2) + Math.pow(j - height/2, 2));
                const grad = Math.floor(Math.max(0, 200 - dist / 2));
                data[idx] = grad;
                data[idx + 1] = grad;
                data[idx + 2] = grad;
                data[idx + 3] = 255;
            }
        }

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.imgW = width;
        this.imgH = height;
    }

    /**
     * Upload texture from image
     */
    uploadTexture(image) {
        const gl = this.gl;

        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.imgW = image.naturalWidth || image.width;
        this.imgH = image.naturalHeight || image.height;

        if (this.requestRender) this.requestRender();
    }

    /**
     * Set canvas size based on window size
     */
    setCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Set saturation (0-2)
     */
    setSaturate(value) {
        this.config.saturate = Math.max(0, Math.min(2, value));
    }

    /**
     * Set whiteness effect (0-1)
     */
    setWhiteness(value) {
        this.whiteness = Math.max(0, Math.min(1, value));
    }

    /**
     * Render frame.
     * options.cards: Array<{ pos:[x,y] (CSS px, top-left origin), half:[w,h] }>
     *   Pass DOMRect-derived center/half-extent of each glass element.
     *   Falls back to options.cardPos/cardHalf for a single card (legacy).
     */
    render(options = {}) {
        const gl = this.gl;

        if (!this.program || !this.vao) return;

        const dpr = window.devicePixelRatio || 1;
        let cards = options.cards;
        if (!cards) {
            const cardPos = options.cardPos || [this.canvas.width / (2 * dpr), this.canvas.height / (2 * dpr)];
            const cardHalf = options.cardHalf || [300, 200];
            cards = [{ pos: cardPos, half: cardHalf }];
        }
        cards = cards.slice(0, this.maxCards);

        const posArr = new Float32Array(this.maxCards * 2);
        const halfArr = new Float32Array(this.maxCards * 2);
        cards.forEach((card, i) => {
            posArr[i * 2] = card.pos[0] * dpr;
            posArr[i * 2 + 1] = this.canvas.height - card.pos[1] * dpr;
            halfArr[i * 2] = card.half[0] * dpr;
            halfArr[i * 2 + 1] = card.half[1] * dpr;
        });

        gl.useProgram(this.program);

        gl.uniform3f(this.uniforms.resolution, this.canvas.width, this.canvas.height, 1.0);
        gl.uniform2f(this.uniforms.imgRes, this.imgW, this.imgH);
        gl.uniform2fv(this.uniforms.cardPos, posArr);
        gl.uniform2fv(this.uniforms.cardHalf, halfArr);
        gl.uniform1i(this.uniforms.cardCount, cards.length);
        gl.uniform1f(this.uniforms.white, this.whiteness);
        gl.uniform1f(this.uniforms.saturate, this.config.saturate);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.uniforms.texture, 0);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
    }

    /**
     * Start render loop
     */
    startRender(renderFn) {
        const loop = () => {
            if (renderFn) {
                renderFn();
            } else {
                this.render();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.setCanvasSize();
        });
    }

    /**
     * Get canvas element
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get WebGL context
     */
    getContext() {
        return this.gl;
    }

    /**
     * Destroy instance
     */
    destroy() {
        const gl = this.gl;
        if (this.program) gl.deleteProgram(this.program);
        if (this.texture) gl.deleteTexture(this.texture);
        if (this.vao) gl.deleteVertexArray(this.vao);
    }

    /**
     * Auto-bind to all Mina liquid-glass elements on the page and start
     * the render loop. Up to maxCards elements are tracked simultaneously
     * (4 by default).
     *
     * @param {Object} options - passed through to the MinaGlass constructor
     * @param {string} [options.background] - image URL used as the lens source
     * @returns {MinaGlass}
     */
    static autoInit(options = {}) {
        const instance = new MinaGlass(options);
        if (!instance.gl) return instance;

        // On-demand rendering: draw only when something actually changes
        // (scroll/resize/texture load) instead of an unconditional 60fps
        // loop, which otherwise keeps the GPU busy indefinitely.
        let rafPending = false;
        const renderNow = () => {
            rafPending = false;
            instance.render({ cards: cachedCards });
        };
        instance.requestRender = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(renderNow);
        };

        if (options.background) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { instance.uploadTexture(img); };
            img.src = options.background;
        }

        const collectCards = () => {
            const els = Array.from(document.querySelectorAll('.mina-glass-liquid, .mina-glass--liquid')).slice(0, instance.maxCards);
            return els.map((el) => {
                const r = el.getBoundingClientRect();
                return {
                    pos: [r.left + r.width / 2, r.top + r.height / 2],
                    half: [r.width / 2 + 4, r.height / 2 + 4]
                };
            });
        };

        let cachedCards = collectCards();
        const refreshCards = () => { cachedCards = collectCards(); instance.requestRender(); };
        window.addEventListener('scroll', refreshCards, { passive: true });
        window.addEventListener('resize', () => { instance.setCanvasSize(); refreshCards(); });

        instance.requestRender();

        return instance;
    }
}

// Export for module systems
if (typeof window !== 'undefined') {
    window.MinaGlass = MinaGlass;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinaGlass;
}
