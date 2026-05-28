import * as THREE from 'three'

export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, 0) },
      uWindSpeed: { value: 0.4 },
      uWaterColor: { value: new THREE.Color(0x3b9ed4) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSunIntensity: { value: 1.3 },
      uAmbientColor: { value: new THREE.Color(0xd0e8ff) },
      uAmbientIntensity: { value: 0.55 },
    },
    vertexShader: `
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindSpeed;
      varying vec3 vNormal;
      varying vec2 vWorldXZ;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPos.xz;
        vNormal = normalMatrix * normal;
        float wave = sin(worldPos.x * 0.5 + uTime * 1.5) * 0.05
                   + sin(worldPos.z * 0.3 + uTime * 1.2) * 0.03;
        vec3 pos = position;
        pos.y += wave * uWindSpeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindSpeed;
      uniform vec3 uWaterColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uAmbientColor;
      uniform float uAmbientIntensity;
      varying vec3 vNormal;
      varying vec2 vWorldXZ;
      void main() {
        float diff = max(dot(normalize(vNormal), normalize(uSunDir)), 0.0);
        // Floor ambient at 0.5 so water stays visible at dawn/dusk — a top-face-only mesh
        // gets no side-lit brightening that terrain voxels have baked into vertex colors.
        vec3 lighting = uAmbientColor * max(uAmbientIntensity, 0.5) + uSunColor * diff * uSunIntensity;
        vec2 scrollUV = vWorldXZ * 0.08 + uWindDir * uTime * 0.015;
        float shimmer = sin(scrollUV.x * 6.0 + uTime * 1.8) * sin(scrollUV.y * 5.0 + uTime * 1.4) * 0.06 + 0.94;
        gl_FragColor = vec4(uWaterColor * shimmer * lighting, 1.0);
      }
    `,
  })
}
