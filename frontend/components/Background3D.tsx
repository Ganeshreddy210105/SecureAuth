'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points } from '@react-three/drei';
import * as THREE from 'three';
import ErrorBoundary from './ErrorBoundary';

function createStarTexture() {
  if (typeof window === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(240, 246, 255, 0.35)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function DistantStars({ speed = 0.02, starTexture, warpState }: { speed?: number; starTexture: THREE.Texture | null; warpState: string }) {
  const ref = useRef<THREE.Points>(null);
  const count = 8000;

  const [positions, baseColors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const radius = 6 + Math.random() * 4;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      cols[i * 3] = 1.0;
      cols[i * 3 + 1] = 1.0;
      cols[i * 3 + 2] = 1.0;
    }
    return [pos, cols];
  }, []);

  const activeColors = useMemo(() => new Float32Array(baseColors), [baseColors]);

  useFrame((state, delta) => {
    if (ref.current) {
      let rotationSpeedMult = 1.0;
      if (warpState === 'warping') {
        rotationSpeedMult = 4.0;
      } else if (warpState === 'authenticated') {
        rotationSpeedMult = 0.3;
      }

      ref.current.rotation.y += delta * speed * 0.015 * rotationSpeedMult;
      ref.current.rotation.x += delta * speed * 0.008 * rotationSpeedMult;

      const time = state.clock.getElapsedTime();
      const cols = ref.current.geometry.attributes.color.array as Float32Array;
      
      for (let i = 0; i < count; i++) {
        const freq = 0.6 + (i % 6) * 0.35;
        const phase = i * 0.2;
        const twinkle = 0.15 + 0.85 * Math.sin(time * freq + phase);

        cols[i * 3] = baseColors[i * 3] * twinkle;
        cols[i * 3 + 1] = baseColors[i * 3 + 1] * twinkle;
        cols[i * 3 + 2] = baseColors[i * 3 + 2] * twinkle;
      }
      ref.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <Points ref={ref} positions={positions} colors={activeColors} stride={3} frustumCulled={false}>
      <pointsMaterial
        transparent
        vertexColors
        size={0.015}
        sizeAttenuation={true}
        depthWrite={false}
        map={starTexture || undefined}
        alphaTest={0.001}
        opacity={0.6}
      />
    </Points>
  );
}

interface FloatingStarsProps {
  speed?: number;
  count?: number;
  size?: number;
  starTexture: THREE.Texture | null;
  warpState: 'idle' | 'warping' | 'authenticated';
  warpProgress: number;
}

function FloatingStars({ speed = 0.05, count = 200, size = 0.04, starTexture, warpState, warpProgress }: FloatingStarsProps) {
  const ref = useRef<THREE.Points>(null);

  const [positions, baseColors, starData] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 2.7;
      
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.sin(angle) * r;
      pos[i * 3 + 2] = -Math.random() * 8;
      
      cols[i * 3] = 1.0;
      cols[i * 3 + 1] = 1.0;
      cols[i * 3 + 2] = 1.0;

      data.push({
        speedMult: 0.5 + Math.random() * 0.5,
        twinkleFreq: 0.8 + Math.random() * 1.8,
        twinklePhase: Math.random() * Math.PI
      });
    }
    return [pos, cols, data];
  }, [count]);

  const activeColors = useMemo(() => new Float32Array(baseColors), [baseColors]);

  useFrame((state, delta) => {
    if (ref.current) {
      const posArray = ref.current.geometry.attributes.position.array as Float32Array;
      const colArray = ref.current.geometry.attributes.color.array as Float32Array;
      const time = state.clock.getElapsedTime();
      
      if (warpState === 'warping') {
        const warpSpeed = speed + Math.sin(warpProgress * Math.PI) * 5.0;
        
        for (let i = 0; i < count; i++) {
          posArray[i * 3 + 2] += delta * warpSpeed * starData[i].speedMult;
          if (posArray[i * 3 + 2] > 1) {
            posArray[i * 3 + 2] = -8;
            const angle = Math.random() * Math.PI * 2;
            const r = 0.3 + Math.random() * 2.7;
            posArray[i * 3] = Math.cos(angle) * r;
            posArray[i * 3 + 1] = Math.sin(angle) * r;
          }
        }
        
        ref.current.scale.z = 1.0 + Math.sin(warpProgress * Math.PI) * 12.0;
        ref.current.rotation.z += delta * (0.02 + warpProgress * 0.4);
        
      } else if (warpState === 'authenticated') {
        ref.current.scale.z = 1.0;
        ref.current.rotation.z += delta * 0.04;
        
      } else {
        ref.current.scale.z = 1.0;
        
        for (let i = 0; i < count; i++) {
          posArray[i * 3 + 2] += delta * speed * starData[i].speedMult;
          if (posArray[i * 3 + 2] > 1) {
            posArray[i * 3 + 2] = -8;
            const angle = Math.random() * Math.PI * 2;
            const r = 0.3 + Math.random() * 2.7;
            posArray[i * 3] = Math.cos(angle) * r;
            posArray[i * 3 + 1] = Math.sin(angle) * r;
          }
        }
        
        ref.current.rotation.z += delta * speed * 0.01;
      }

      for (let i = 0; i < count; i++) {
        const twinkle = 0.25 + 0.75 * Math.sin(time * starData[i].twinkleFreq + starData[i].twinklePhase);
        colArray[i * 3] = baseColors[i * 3] * twinkle;
        colArray[i * 3 + 1] = baseColors[i * 3 + 1] * twinkle;
        colArray[i * 3 + 2] = baseColors[i * 3 + 2] * twinkle;
      }
      
      ref.current.geometry.attributes.position.needsUpdate = true;
      ref.current.geometry.attributes.color.needsUpdate = true;
      
      const swayMult = warpState === 'authenticated' ? 0.3 : 1.0;
      ref.current.position.x = Math.sin(time * 0.15) * 0.12 * swayMult;
      ref.current.position.y = Math.cos(time * 0.15) * 0.12 * swayMult;
    }
  });

  return (
    <Points ref={ref} positions={positions} colors={activeColors} stride={3} frustumCulled={false}>
      <pointsMaterial
        transparent
        vertexColors
        size={size}
        sizeAttenuation={true}
        depthWrite={false}
        map={starTexture || undefined}
        alphaTest={0.001}
        opacity={0.8}
      />
    </Points>
  );
}

export default function Background3D() {
  const pathname = usePathname();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [warpState, setWarpState] = useState<'idle' | 'warping' | 'authenticated'>('idle');
  const [warpProgress, setWarpProgress] = useState(0);
  const prevPathRef = useRef<string>(pathname);

  const starTexture = useMemo(() => createStarTexture(), []);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const isPublic = ['/', '/login', '/register', '/otp-login', '/forgot-password', '/verify-email'].includes(pathname);
    const wasPublic = ['/', '/login', '/register', '/otp-login', '/forgot-password', '/verify-email'].includes(prevPathRef.current);

    if (prevPathRef.current !== pathname) {
      if (wasPublic && !isPublic) {
        setWarpState('warping');
        let start = Date.now();
        const duration = 1800;
        
        const interval = setInterval(() => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          setWarpProgress(progress);
          
          if (progress >= 1) {
            clearInterval(interval);
            setWarpState('authenticated');
            setWarpProgress(0);
          }
        }, 16);
      } else if (!wasPublic && isPublic) {
        setWarpState('idle');
      }
      prevPathRef.current = pathname;
    } else {
      setWarpState(isPublic ? 'idle' : 'authenticated');
    }
  }, [pathname]);

  if (!mounted) {
    return <div className="absolute inset-0 bg-[#09090B] -z-10" />;
  }

  const activeSpeed = reduceMotion ? 0 : 1;

  return (
    <div className="absolute inset-0 bg-[#09090B] overflow-hidden -z-10">
      <div className="absolute top-[-30%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-900/15 blur-[150px] mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '15s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-blue-900/15 blur-[150px] mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '20s' }} />
      <div className="absolute top-[25%] right-[15%] w-[35vw] h-[35vw] rounded-full bg-cyan-900/10 blur-[120px] mix-blend-screen pointer-events-none" />

      <ErrorBoundary>
        <Canvas 
          camera={{ position: [0, 0, 1], fov: 75 }} 
          gl={{ powerPreference: "high-performance", antialias: false }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <color attach="background" args={["#09090B"]} />
          <ambientLight intensity={0.4} />

          <DistantStars speed={activeSpeed * 0.05} starTexture={starTexture} warpState={warpState} />

          <FloatingStars 
            speed={activeSpeed * 0.03} 
            count={6000} 
            size={0.015} 
            starTexture={starTexture} 
            warpState={warpState}
            warpProgress={warpProgress}
          />

          <FloatingStars 
            speed={activeSpeed * 0.07} 
            count={2500} 
            size={0.025} 
            starTexture={starTexture} 
            warpState={warpState}
            warpProgress={warpProgress}
          />
          <FloatingStars 
            speed={activeSpeed * 0.05} 
            count={1500} 
            size={0.02} 
            starTexture={starTexture} 
            warpState={warpState}
            warpProgress={warpProgress}
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}
