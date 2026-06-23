import { useEffect, useRef } from 'react'

/**
 * WebGL2 chroma-stroke effect over a live webcam feed. Renders into
 * the photo slot of the Case Window. Sobel edges + posterized palette
 * mapping with the controls baked in as constants.
 *
 * Lifecycle:
 *   - On mount: request getUserMedia, pipe into a hidden <video>,
 *     compile shaders, start a rAF loop that uploads each frame as a
 *     texture and draws the quad.
 *   - On unmount: stop the rAF loop, stop every camera track, drop the
 *     GL resources. If getUserMedia or WebGL2 fails, calls onError so
 *     the parent can swap in the static photo.
 */
export function WebcamFilter({ onError }: { onError: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true })
    if (!gl) { onErrorRef.current(); return }

    let stream: MediaStream | null = null
    let rafId = 0
    let cancelled = false

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.autoplay = true

    const program = buildProgram(gl)
    if (!program) { onErrorRef.current(); return }
    gl.useProgram(program)

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const posLoc = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const u = {
      res:        gl.getUniformLocation(program, 'uResolution'),
      time:       gl.getUniformLocation(program, 'uTime'),
      texRes:     gl.getUniformLocation(program, 'uTextureResolution'),
      palette:    gl.getUniformLocation(program, 'uPalette'),
      palSize:    gl.getUniformLocation(program, 'uPaletteSize'),
      strokeCol:  gl.getUniformLocation(program, 'uStrokeColor'),
      strokeThk:  gl.getUniformLocation(program, 'uStrokeThickness'),
      strokeSen:  gl.getUniformLocation(program, 'uStrokeSensitivity'),
      smoothing:  gl.getUniformLocation(program, 'uSmoothing'),
      poster:     gl.getUniformLocation(program, 'uPosterization'),
      contrast:   gl.getUniformLocation(program, 'uContrast'),
      mirror:     gl.getUniformLocation(program, 'uMirror'),
      camView:    gl.getUniformLocation(program, 'uCameraView'),
      flat:       gl.getUniformLocation(program, 'uFlatStyle'),
    }

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // Palette baked from the reference snippet's defaults. Sorted by
    // perceptual luminance ascending so the flat shader's direct
    // index-by-bin mapping assigns the darkest input region to the
    // darkest palette color and so on — every chosen color gets a
    // brightness band, instead of two near-luminance entries colliding
    // and silently dropping a color. Padded to 10 entries (the shader's
    // array length) by cycling.
    const PALETTE_HEX = sortByLuminance(['#FFE732', '#00A168', '#E1F5FF', '#B3E6FE'])
    const paletteRgb = new Float32Array(10 * 3)
    for (let i = 0; i < 10; i++) {
      const [r, g, b] = hexToRgb(PALETTE_HEX[i % PALETTE_HEX.length])
      paletteRgb[i * 3] = r
      paletteRgb[i * 3 + 1] = g
      paletteRgb[i * 3 + 2] = b
    }
    const strokeRgb = new Float32Array(hexToRgb('#1a1a1a'))

    function resize() {
      const parent = canvas?.parentElement
      if (!parent || !canvas) return
      const w = Math.max(1, parent.clientWidth)
      const h = Math.max(1, parent.clientHeight)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl!.viewport(0, 0, w, h)
      }
    }

    function render(t: number) {
      if (cancelled) return
      resize()
      if (video.readyState >= 2 && video.videoWidth > 0) {
        gl!.bindTexture(gl!.TEXTURE_2D, texture)
        gl!.texImage2D(
          gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, video,
        )
        gl!.uniform2f(u.texRes, video.videoWidth, video.videoHeight)
      }
      gl!.uniform2f(u.res, canvas!.width, canvas!.height)
      gl!.uniform1f(u.time, t * 0.001)
      gl!.uniform3fv(u.palette, paletteRgb)
      gl!.uniform1i(u.palSize, 4)
      gl!.uniform3fv(u.strokeCol, strokeRgb)
      gl!.uniform1f(u.strokeThk, 1.7)
      gl!.uniform1f(u.strokeSen, 2)
      gl!.uniform1f(u.smoothing, 2)
      gl!.uniform1f(u.poster, 4)
      gl!.uniform1f(u.contrast, 1.2)
      gl!.uniform1f(u.mirror, 1)
      gl!.uniform1f(u.camView, 0)
      gl!.uniform1f(u.flat, 1)
      gl!.bindVertexArray(vao)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(render)
    }

    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md || typeof md.getUserMedia !== 'function') {
      onErrorRef.current()
      return
    }
    md.getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        video.srcObject = s
        video.play().catch(() => { /* autoplay blocked — first frame still uploads */ })
        rafId = requestAnimationFrame(render)
      })
      .catch(() => {
        onErrorRef.current()
      })

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      video.pause()
      video.srcObject = null
      gl.deleteProgram(program)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buf)
      gl.deleteVertexArray(vao)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function sortByLuminance(hexes: string[]): string[] {
  return [...hexes].sort((a, b) => luminance(a) - luminance(b))
}

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('WebcamFilter program link error:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('WebcamFilter shader compile error:', gl.getShaderInfoLog(sh))
    return null
  }
  return sh
}

const VERT_SRC = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform sampler2D uTexture;
uniform vec2 uTextureResolution;

uniform vec3 uPalette[10];
uniform int uPaletteSize;
uniform vec3 uStrokeColor;
uniform float uStrokeThickness;
uniform float uStrokeSensitivity;
uniform float uSmoothing;
uniform float uPosterization;
uniform float uContrast;
uniform float uMirror;
uniform float uCameraView;
uniform float uFlatStyle;

float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec2 getCoverUV(vec2 uv, vec2 texRes, vec2 screenRes) {
  float screenAspect = screenRes.x / screenRes.y;
  float texAspect = texRes.x / texRes.y;
  vec2 correctedUV = uv;
  if (screenAspect > texAspect) {
    float scale = screenAspect / texAspect;
    correctedUV.y = (uv.y - 0.5) * scale + 0.5;
  } else {
    float scale = texAspect / screenAspect;
    correctedUV.x = (uv.x - 0.5) * scale + 0.5;
  }
  return correctedUV;
}

vec4 getSmoothedColor(vec2 uv, float sigma) {
  vec4 centerColor = texture(uTexture, uv);
  if (sigma <= 0.1) return centerColor;
  vec4 sumColor = vec4(0.0);
  float sumWeight = 0.0;
  float colorSigma = mix(0.06, 0.015, uFlatStyle);
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(x, y) / uTextureResolution;
      vec4 sampleColor = texture(uTexture, uv + offset);
      float spatialDist = length(vec2(x, y));
      float spatialWeight = exp(-0.5 * (spatialDist * spatialDist) / (sigma * sigma));
      float colorDist = distance(centerColor.rgb, sampleColor.rgb);
      float colorWeight = exp(-0.5 * (colorDist * colorDist) / colorSigma);
      float weight = spatialWeight * colorWeight;
      sumColor += sampleColor * weight;
      sumWeight += weight;
    }
  }
  return sumColor / max(sumWeight, 0.001);
}

float getSobelEdge(vec2 uv, float thickness) {
  vec2 delta = thickness / uTextureResolution;
  float t00 = getLuminance(texture(uTexture, uv + vec2(-delta.x, -delta.y)).rgb);
  float t10 = getLuminance(texture(uTexture, uv + vec2(0.0,      -delta.y)).rgb);
  float t20 = getLuminance(texture(uTexture, uv + vec2( delta.x, -delta.y)).rgb);
  float t01 = getLuminance(texture(uTexture, uv + vec2(-delta.x,  0.0    )).rgb);
  float t21 = getLuminance(texture(uTexture, uv + vec2( delta.x,  0.0    )).rgb);
  float t02 = getLuminance(texture(uTexture, uv + vec2(-delta.x,  delta.y)).rgb);
  float t12 = getLuminance(texture(uTexture, uv + vec2(0.0,       delta.y)).rgb);
  float t22 = getLuminance(texture(uTexture, uv + vec2( delta.x,  delta.y)).rgb);
  float gx = -t00 - 2.0*t01 - t02 + t20 + 2.0*t21 + t22;
  float gy = -t00 - 2.0*t10 - t20 + t02 + 2.0*t12 + t22;
  return sqrt(gx*gx + gy*gy);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;

  if (uCameraView == 2.0) {
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    float d = length(p);
    float angle = atan(p.y, p.x);
    float wave = sin(d * 8.0 - uTime * 2.0 + angle * 4.0) * 0.5 + 0.5;
    int idx = clamp(int(floor(wave * float(uPaletteSize - 1))), 0, uPaletteSize - 1);
    fragColor = vec4(uPalette[idx], 1.0);
    return;
  }

  vec2 mainUV = getCoverUV(uv, uTextureResolution, uResolution);
  if (uMirror > 0.5) mainUV.x = 1.0 - mainUV.x;

  float effectiveSmoothing = uSmoothing + uFlatStyle * 1.5;
  vec4 smoothed = getSmoothedColor(mainUV, effectiveSmoothing);
  float edge = getSobelEdge(mainUV, uStrokeThickness);

  float lum = getLuminance(smoothed.rgb);
  lum = clamp((lum - 0.5) * uContrast + 0.5, 0.0, 1.0);

  float levels = uPosterization;
  float quantized = floor(lum * levels) / max(levels - 1.0, 1.0);
  quantized = clamp(quantized, 0.0, 1.0);

  vec3 mappedColor;

  if (uFlatStyle > 0.5) {
    // Direct bin-to-index mapping. The palette is sorted ascending by
    // luminance on the CPU side so darker bins → darker palette colors,
    // and every palette entry claims its own bin (no luminance-collision
    // dropouts).
    float qScaled = quantized * float(uPaletteSize - 1);
    int idx = clamp(int(floor(qScaled + 0.5)), 0, uPaletteSize - 1);
    mappedColor = uPalette[idx];
    float edgeVal = step(uStrokeSensitivity, edge * 6.0);
    fragColor = vec4(mix(mappedColor, uStrokeColor, edgeVal), 1.0);
  } else {
    float qScaled = quantized * float(uPaletteSize - 1);
    int idx = clamp(int(floor(qScaled)), 0, uPaletteSize - 2);
    float frac = fract(qScaled);
    mappedColor = mix(uPalette[idx], uPalette[idx + 1], frac);
    float edgeVal = smoothstep(uStrokeSensitivity - 0.1, uStrokeSensitivity + 0.1, edge * 5.0);
    fragColor = vec4(mix(mappedColor, uStrokeColor, edgeVal), 1.0);
  }
}
`
