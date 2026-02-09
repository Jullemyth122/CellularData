import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// Utility: Detect device performance level
const getDeviceQuality = () => {
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Check for low-end devices (rough estimate based on hardware concurrency)
  const isLowEnd = navigator.hardwareConcurrency <= 4

  if (isMobile || isLowEnd) return 'low'
  if (navigator.hardwareConcurrency >= 8) return 'high'
  return 'medium'
}


// Generate random text/numbers
const generateRandomText = () => {
  const types = ['number', 'hex', 'code']
  const type = types[Math.floor(Math.random() * types.length)]

  switch (type) {
    case 'number':
      return Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    case 'hex':
      return '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()
    case 'code':
      const codes = ['SYS', 'NET', 'CPU', 'MEM', 'IO', 'REF', 'ACK', 'ERR', 'OK', 'RX', 'TX']
      return codes[Math.floor(Math.random() * codes.length)]
    default:
      return Math.floor(Math.random() * 999).toString()
  }
}

// Custom shader material for animated lines with per-vertex opacity
const AnimatedLineMaterial = {
  vertexShader: `
    attribute float aOpacity;
    varying float vOpacity;
    void main() {
      vOpacity = aOpacity;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vOpacity;
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, vOpacity);
    }
  `
}

// Animated line segments - lines move in/out like data pulses
const AnimatedLines = ({ segments, color = "#ffffff", isBloom = false }) => {
  const meshRef = useRef()
  const geometryRef = useRef()
  const materialRef = useRef()

  // Store base line data for animation reference
  const lineData = useMemo(() => {
    return segments.map((seg, idx) => {
      const angle = Math.atan2(seg.start[1], seg.start[0])
      const ringZ = seg.start[2]

      // Calculate base distances from center for this line
      const startDist = Math.sqrt(seg.start[0] ** 2 + seg.start[1] ** 2)
      const endDist = Math.sqrt(seg.end[0] ** 2 + seg.end[1] ** 2)
      const lineLength = endDist - startDist

      // Random phase offset for staggered animation
      const phase = Math.random() * Math.PI * 2
      // Random speed multiplier for variety
      const speed = 0.8 + Math.random() * 0.8
      // Random delay so lines don't all animate together
      const delay = Math.random() * 3

      return {
        angle,
        ringZ,
        startDist,      // Original start distance from center
        lineLength,     // Original line length
        phase,
        speed,
        delay,
        opacity: seg.opacity,
        ringIndex: seg.ringIndex || 0
      }
    })
  }, [segments])

  // Create position and opacity buffers
  const positions = useRef(new Float32Array(segments.length * 6))
  const opacities = useRef(new Float32Array(segments.length * 2))
  const colorVec = useMemo(() => new THREE.Color(color), [color])

  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions.current, 3))
      geometryRef.current.setAttribute('aOpacity', new THREE.BufferAttribute(opacities.current, 1))
    }
  }, [segments])

  // Animate line positions - lines shoot out and retract like data pulses
  useFrame((state) => {
    if (!geometryRef.current) return

    const time = state.clock.elapsedTime
    const posAttr = geometryRef.current.getAttribute('position')
    const opacityAttr = geometryRef.current.getAttribute('aOpacity')
    if (!posAttr || !opacityAttr) return

    for (let i = 0; i < lineData.length; i++) {
      const data = lineData[i]
      const { angle, ringZ, startDist, lineLength, phase, speed, delay, opacity } = data

      // Animation progress (0 to 1, looping)
      // Each line has its own cycle based on phase and delay
      const cycleTime = ((time * speed) + delay) % 4 // 4 second cycle

      let progress, fadeOpacity

      if (cycleTime < 1.5) {
        // Phase 1: Line shoots outward (0 to 1.5s)
        progress = cycleTime / 1.5
        fadeOpacity = Math.min(1, progress * 2) // Fade in quickly
      } else if (cycleTime < 2.5) {
        // Phase 2: Line holds at full extension (1.5 to 2.5s)
        progress = 1
        fadeOpacity = 1
      } else if (cycleTime < 4) {
        // Phase 3: Line retracts and fades (2.5 to 4s)
        progress = 1 - ((cycleTime - 2.5) / 1.5)
        fadeOpacity = progress // Fade out as it retracts
      } else {
        progress = 0
        fadeOpacity = 0
      }

      // Ease the progress for smoother animation
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      // Calculate animated line positions
      // Start point stays near the ring, end point extends outward
      const animatedStartDist = startDist
      const animatedEndDist = startDist + (lineLength * easedProgress)

      // Convert polar to cartesian
      const startX = Math.cos(angle) * animatedStartDist
      const startY = Math.sin(angle) * animatedStartDist
      const endX = Math.cos(angle) * animatedEndDist
      const endY = Math.sin(angle) * animatedEndDist

      // Update position buffer
      const posIdx = i * 6
      positions.current[posIdx] = startX
      positions.current[posIdx + 1] = startY
      positions.current[posIdx + 2] = ringZ
      positions.current[posIdx + 3] = endX
      positions.current[posIdx + 4] = endY
      positions.current[posIdx + 5] = ringZ

      // Update opacity
      const opIdx = i * 2
      opacities.current[opIdx] = opacity * fadeOpacity
      opacities.current[opIdx + 1] = opacity * fadeOpacity
    }

    posAttr.array = positions.current
    posAttr.needsUpdate = true
    opacityAttr.array = opacities.current
    opacityAttr.needsUpdate = true

    geometryRef.current.computeBoundingSphere()
  })

  return (
    <lineSegments ref={meshRef} frustumCulled={true} layers-enable={isBloom ? 1 : 0}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={AnimatedLineMaterial.vertexShader}
        fragmentShader={AnimatedLineMaterial.fragmentShader}
        uniforms={{ uColor: { value: colorVec } }}
        transparent
        depthWrite={false}
        toneMapped={!isBloom}
      />
    </lineSegments>
  )
}

// Static lines for non-animated display (fallback/performance)
const StaticLines = ({ segments, color = "white", sharedMaterial }) => {
  const meshRef = useRef()
  const geometryRef = useRef()

  const { positions, opacities } = useMemo(() => {
    const positions = []
    const opacities = []

    segments.forEach(seg => {
      positions.push(
        seg.start[0], seg.start[1], seg.start[2],
        seg.end[0], seg.end[1], seg.end[2]
      )
      opacities.push(seg.opacity, seg.opacity)
    })

    return {
      positions: new Float32Array(positions),
      opacities: new Float32Array(opacities)
    }
  }, [segments])

  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometryRef.current.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1))
      geometryRef.current.computeBoundingSphere()
    }
  }, [positions, opacities])

  return (
    <lineSegments ref={meshRef} frustumCulled={true}>
      <bufferGeometry ref={geometryRef} />
      {sharedMaterial ? (
        <primitive object={sharedMaterial} attach="material" />
      ) : (
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          vertexColors={false}
        />
      )}
    </lineSegments>
  )
}

// Instanced circles using ring geometry with reduced segments and shared material
const InstancedCircles = ({ circles, color = "white", bloom = false, segments = 32, sharedMaterial }) => {
  const meshRef = useRef()

  useEffect(() => {
    if (!meshRef.current || circles.length === 0) return

    const dummy = new THREE.Object3D()

    circles.forEach((circle, i) => {
      dummy.position.set(circle.position[0], circle.position[1], circle.position[2])
      dummy.scale.setScalar(circle.radius)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = circles.length
  }, [circles])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, Math.max(circles.length, 1)]}
      frustumCulled={true}
    >
      <ringGeometry args={[0.995, 1.0, segments]} />
      {sharedMaterial ? (
        <primitive object={sharedMaterial} attach="material" />
      ) : (
        <meshBasicMaterial
          color={bloom ? "#ffffff" : color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      )}
    </instancedMesh>
  )
}

// Instanced circles for bloom layer (brighter, fewer) with reduced segments
const BloomCircles = ({ circles, lightsRef, segments = 32, sharedMaterial }) => {
  const meshRef = useRef()

  useEffect(() => {
    if (!meshRef.current || circles.length === 0) return

    const dummy = new THREE.Object3D()

    circles.forEach((circle, i) => {
      dummy.position.set(circle.position[0], circle.position[1], circle.position[2])
      dummy.scale.setScalar(circle.radius)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = circles.length

    // Add to bloom selection
    if (lightsRef) {
      lightsRef.current = meshRef.current
    }
  }, [circles, lightsRef])

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, Math.max(circles.length, 1)]}
      frustumCulled={true}
      layers-enable={1}
    >
      <ringGeometry args={[1.0, 1.005, segments]} />
      {sharedMaterial ? (
        <primitive object={sharedMaterial} attach="material" />
      ) : (
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      )}
    </instancedMesh>
  )
}

// Text labels component (sparse for performance)
const TextLabels = ({ labels, color = "white" }) => {
  return (
    <>
      {labels.map((t, i) => (
        <Text
          key={i}
          position={t.position}
          rotation={[0, 0, t.rotation]}
          fontSize={t.size}
          color={color}
          anchorX="left"
          anchorY="middle"
          fillOpacity={t.opacity}
          frustumCulled={true}
        >
          {t.text}
        </Text>
      ))}
    </>
  )
}

// Main scene with all geometry data, adaptive quality, and animations
const Scene = ({ bloomLightsRef }) => {
  const { camera } = useThree()
  const groupRef = useRef()

  useEffect(() => {
    // Set fixed camera position and lookAt from debug values
    camera.position.set(6.69, -0.28, -9.17)
    camera.lookAt(-0.87, -2.02, 0.76)
  }, [camera])

  // Animate the scene - rotate to simulate cellular data signal propagation
  useFrame((state) => {
    if (groupRef.current) {
      // Slow rotation on Y-axis to simulate signal rotation
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1

      // Subtle pulsing effect using sine wave (unchanged)
      const sinValue = Math.sin(state.clock.elapsedTime * 0.5)
      groupRef.current.scale.setScalar(1 + sinValue * 0.05)

      // NEW: Animate FOV in sync with the pulse for a dynamic POV "breathing/zoom" effect
      // When the structure expands (sinValue > 0), we decrease FOV (zoom in) for intensity
      // When it contracts, we increase FOV (zoom out)
      camera.fov = 45 - sinValue * 12 // Results in ~33–57 FOV range for dramatic but smooth feel
      camera.updateProjectionMatrix()
    }
  })

  // Detect device quality for adaptive settings
  const quality = useMemo(() => getDeviceQuality(), [])

  // Quality-based settings
  const qualitySettings = useMemo(() => {
    switch (quality) {
      case 'low':
        return {
          numRings: 12,          // Reduce rings on mobile (18 → 12)
          ringSegments: 24,       // Lower polygon count (32 → 24)
          lineMultiplier: 0.6,    // 40% fewer lines
          textMultiplier: 0.5     // Half the text labels
        }
      case 'medium':
        return {
          numRings: 25,
          ringSegments: 60,
          lineMultiplier: 0.8,
          textMultiplier: 0.75
        }
      default: // 'high'
        return {
          numRings: 32,
          ringSegments: 128,
          lineMultiplier: 1.0,
          textMultiplier: 1.0
        }
    }
  }, [quality])

  // Create shared materials for better performance
  const sharedMaterials = useMemo(() => ({
    circleMaterial: new THREE.MeshBasicMaterial({
      color: 'white',
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    }),
    bloomMaterial: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  }), [])

  // Generate all geometry data with adaptive quality
  const { circles, bloomCircles, lineSegments, bloomLineSegments, textLabels } = useMemo(() => {
    const circles = []
    const bloomCircles = []
    const lineSegments = []
    const bloomLineSegments = []
    const textLabels = []

    const numRings = qualitySettings.numRings
    const baseRadius = 0.5
    let r = baseRadius

    const offsetX = 0
    const offsetY = 0
    const offsetZ = 0.2

    for (let ringIdx = 0; ringIdx < numRings; ringIdx++) {
      const ringProgress = ringIdx / numRings
      const position = [ringIdx * offsetX, ringIdx * offsetY, ringIdx * offsetZ]

      // Add circle
      circles.push({
        radius: r,
        position,
        opacity: 0.3 + Math.random() * 0.7
      })

      // Add bloom circle for some rings (every 4th ring)
      if (ringIdx % 4 === 0) {
        bloomCircles.push({
          radius: r,
          position: [...position],
          opacity: 0.3 + Math.random() * 0.7
        })
      }

      // Generate external lines for this ring (adjusted by quality)
      const baseNumLines = 8 + Math.floor(ringProgress * 25) + Math.floor(Math.random() * 10)
      const numLines = Math.floor(baseNumLines * qualitySettings.lineMultiplier)
      const maxLength = 0.3 + ringProgress * 1.2
      const baseDensity = 0.25 + ringProgress * 0.15
      const textDensity = baseDensity * qualitySettings.textMultiplier
      const usedAngles = []
      const minAngleDiff = 0.2

      for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
        const angle = Math.random() * Math.PI * 2
        const startR = r + Math.random() * 0.2
        const length = 0.3 + Math.random() * maxLength
        const endR = startR + length
        const isSegmented = Math.random() > 0.6
        const opacity = 0.15 + Math.random() * 0.4

        if (isSegmented) {
          let currentR = startR
          while (currentR < endR) {
            const segLen = 0.1 + Math.random() * 0.2
            const gapLen = 0.05 + Math.random() * 0.1
            const segEndR = Math.min(currentR + segLen, endR)

            const lineData = {
              start: [
                Math.cos(angle) * currentR + position[0],
                Math.sin(angle) * currentR + position[1],
                position[2]
              ],
              end: [
                Math.cos(angle) * segEndR + position[0],
                Math.sin(angle) * segEndR + position[1],
                position[2]
              ],
              opacity,
              ringIndex: ringIdx
            }

            // ~20% of lines get bloom effect
            if (Math.random() < 0.2) {
              bloomLineSegments.push(lineData)
            } else {
              lineSegments.push(lineData)
            }
            currentR = segEndR + gapLen
          }
        } else {
          const lineData = {
            start: [
              Math.cos(angle) * startR + position[0],
              Math.sin(angle) * startR + position[1],
              position[2]
            ],
            end: [
              Math.cos(angle) * endR + position[0],
              Math.sin(angle) * endR + position[1],
              position[2]
            ],
            opacity,
            ringIndex: ringIdx
          }

          // ~20% of lines get bloom effect
          if (Math.random() < 0.2) {
            bloomLineSegments.push(lineData)
          } else {
            lineSegments.push(lineData)
          }
        }

        // Add text labels (sparse, quality-adjusted)
        if (Math.random() < textDensity) {
          const tooClose = usedAngles.some(usedAngle =>
            Math.abs(angle - usedAngle) < minAngleDiff ||
            Math.abs(angle - usedAngle) > (Math.PI * 2 - minAngleDiff)
          )

          if (!tooClose) {
            usedAngles.push(angle)
            const textR = endR + 0.1 + Math.random() * 0.2
            textLabels.push({
              text: generateRandomText(),
              position: [
                Math.cos(angle) * textR + position[0],
                Math.sin(angle) * textR + position[1],
                position[2]
              ],
              rotation: angle - Math.PI / 2,
              opacity: 0.3 + Math.random() * 0.4,
              size: 0.08 + Math.random() * 0.04
            })
          }
        }
      }

      r += 0.25 + Math.random() * 0.3
    }

    return { circles, bloomCircles, lineSegments, bloomLineSegments, textLabels }
  }, [qualitySettings])

  return (
    <group ref={groupRef} rotation={[Math.PI / 5, 0, -0.3]}>
      {/* Main circles (instanced with shared material) */}
      <InstancedCircles
        circles={circles}
        segments={qualitySettings.ringSegments}
        sharedMaterial={sharedMaterials.circleMaterial}
      />

      {/* Bloom circles (instanced, selective bloom with shared material) */}
      <BloomCircles
        circles={bloomCircles}
        lightsRef={bloomLightsRef}
        segments={qualitySettings.ringSegments}
        sharedMaterial={sharedMaterials.bloomMaterial}
      />

      {/* Animated line segments (no bloom) */}
      <AnimatedLines
        segments={lineSegments}
        color="#ffffff"
        isBloom={false}
      />

      {/* Bloom line segments (selective bloom) */}
      {bloomLineSegments.length > 0 && (
        <AnimatedLines
          segments={bloomLineSegments}
          color="#ffffff"
          isBloom={true}
        />
      )}

      {/* Text labels */}
      <TextLabels labels={textLabels} color="white" />
    </group>
  )
}

const Symphony = () => {
  const bloomLightsRef = useRef()

  // Detect device quality for adaptive bloom settings
  const quality = useMemo(() => getDeviceQuality(), [])

  // Adaptive bloom settings based on device quality
  const bloomSettings = useMemo(() => {
    switch (quality) {
      case 'low':
        return {
          intensity: 1.2,          // Reduced intensity (2.0 → 1.2)
          radius: 0.3,             // Smaller radius (0.4 → 0.3)
          luminanceThreshold: 0.7, // Higher threshold (0.6 → 0.7)
          luminanceSmoothing: 0.1  // More smoothing for performance
        }
      case 'medium':
        return {
          intensity: 1.6,
          radius: 0.35,
          luminanceThreshold: 0.65,
          luminanceSmoothing: 0.075
        }
      default: // 'high'
        return {
          intensity: 2.0,
          radius: 0.4,
          luminanceThreshold: 0.6,
          luminanceSmoothing: 0.05
        }
    }
  }, [quality])


  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0a0a', position: 'relative' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0a0a']} />
        <PerspectiveCamera
          makeDefault
          position={[6.69, -0.28, -9.17]}
          fov={45}
        />

        <Scene bloomLightsRef={bloomLightsRef} />

        {/* Adaptive Bloom Post-processing */}
        <EffectComposer>
          <Bloom
            intensity={bloomSettings.intensity}
            luminanceThreshold={bloomSettings.luminanceThreshold}
            luminanceSmoothing={bloomSettings.luminanceSmoothing}
            mipmapBlur={true}
            radius={bloomSettings.radius}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

export default Symphony