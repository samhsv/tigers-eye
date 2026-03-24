import { useRef, useCallback, useEffect, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { useApp } from '../context/useApp';
import { getClusterConfig } from '../lib/clustering';
import { computeAllSignals, SIGNAL_COLORS } from '../lib/signals';
import type { GalaxyViewHandle, GraphNode, NodeUserData, SignalType } from '../types';

const GalaxyView = forwardRef<GalaxyViewHandle>(function GalaxyView(_props, ref) {
  const { state, dispatch } = useApp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const clusterLabelsRef = useRef<THREE.Object3D[]>([]);
  const starsRef = useRef<THREE.Points | null>(null);

  const signalFlags = useMemo(() => {
    if (!state.markets.length) return new Map<string, SignalType[]>();
    return computeAllSignals(state.markets).flaggedNodeIds;
  }, [state.markets]);

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose flyToNode via ref
  useImperativeHandle(ref, () => ({
    flyToNode: (nodeId: string) => {
      if (!fgRef.current) return;
      const graphNode = (state.graphData.nodes as GraphNode[]).find(n => n.id === nodeId);
      if (!graphNode || graphNode.x === undefined) return;

      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(graphNode.x!, graphNode.y!, graphNode.z!);

      fgRef.current.cameraPosition(
        {
          x: graphNode.x! * distRatio,
          y: graphNode.y! * distRatio,
          z: graphNode.z! * distRatio,
        },
        { x: graphNode.x, y: graphNode.y, z: graphNode.z },
        1500,
      );
    },
  }), [state.graphData.nodes]);

  // Setup starfield + clustering forces + category labels
  useEffect(() => {
    if (!fgRef.current || state.graphData.nodes.length === 0) return;

    const fg = fgRef.current;
    const scene = fg.scene();

    // Starfield
    if (!starsRef.current) {
      const starCount = 2500;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 4000;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      });
      const stars = new THREE.Points(geometry, material);
      scene.add(stars);
      starsRef.current = stars;
    }

    // ── Dynamic clustering based on active lens ──
    const config = getClusterConfig(state.activeCluster, state.markets);

    const forceTimer = setTimeout(() => {
      if (!fgRef.current) return;
      try {
        fg.d3Force('cluster', (alpha: number) => {
          const nodes = state.graphData.nodes as GraphNode[];
          for (const node of nodes) {
            const clusterKey = config.assignments.get(node.id);
            const center = clusterKey ? config.centers[clusterKey] : undefined;
            if (!center) continue;
            const k = alpha * 0.3;
            node.vx! += (center.x - node.x!) * k;
            node.vy! += (center.y - node.y!) * k;
            node.vz! += (center.z - node.z!) * k;
          }
        });

        fg.d3Force('center', null);
        fg.d3Force('charge')?.strength?.(-30);
        fg.d3ReheatSimulation();
      } catch {
        // Simulation not yet ready — forces will apply on next data update
      }
    }, 0);

    // ── Dynamic cluster labels ──
    clusterLabelsRef.current.forEach(s => scene.remove(s));
    clusterLabelsRef.current = [];

    for (const lbl of config.labels) {
      const sprite = new SpriteText(lbl.label, 8, lbl.color || '#8B95A5');
      Object.assign(sprite, {
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: '500',
      });
      sprite.position.set(lbl.position.x, lbl.position.y, lbl.position.z);
      sprite.material.opacity = 0.35;
      sprite.material.transparent = true;
      sprite.material.depthWrite = false;
      scene.add(sprite);
      clusterLabelsRef.current.push(sprite);
    }

    return () => {
      clearTimeout(forceTimer);
      clusterLabelsRef.current.forEach(s => scene.remove(s));
      clusterLabelsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.graphData.nodes, state.activeCluster, state.markets]);

  // Camera animation on data load
  useEffect(() => {
    if (!state.dataLoaded || !fgRef.current) return;

    fgRef.current.cameraPosition({ x: 0, y: 0, z: 1200 });

    const timer = setTimeout(() => {
      fgRef.current?.cameraPosition(
        { x: 0, y: 100, z: 500 },
        { x: 0, y: 0, z: 0 },
        2500,
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [state.dataLoaded]);

  // Custom orb node renderer
  const createOrbNode = useCallback((node: GraphNode) => {
    const radius = node.orbSize || 2;
    const color = new THREE.Color(node.orbColor || '#FF6B1A');

    const group = new THREE.Group();

    // Core sphere
    const coreGeo = new THREE.SphereGeometry(radius, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Glow sphere
    const glowGeo = new THREE.SphereGeometry(radius * 1.6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // Signal ring for flagged nodes
    const nodeSignals = signalFlags.get(node.id);
    let signalRing: THREE.Mesh | undefined;
    let signalRingMat: THREE.MeshBasicMaterial | undefined;

    if (nodeSignals && nodeSignals.length > 0) {
      const ringColor = SIGNAL_COLORS[nodeSignals[0]];
      const ringGeo = new THREE.RingGeometry(radius * 2.2, radius * 2.5, 32);
      signalRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(ringColor),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      signalRing = new THREE.Mesh(ringGeo, signalRingMat);
      signalRing.rotation.x = Math.PI / 2;
      group.add(signalRing);
    }

    group.userData = {
      glow,
      coreMat,
      glowMat,
      baseRadius: radius,
      pulseSpeed: node.pulseSpeed || 0,
      signalRing,
      signalRingMat,
    } satisfies NodeUserData;

    return group;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalFlags]);

  // Hover handler
  const handleNodeHover = useCallback(
    (node: GraphNode | null, prevNode: GraphNode | null) => {
      // Restore previous node
      const prevObj = prevNode?.__threeObj;
      if (prevObj?.userData?.coreMat) {
        (prevObj.userData as NodeUserData).coreMat.opacity = 0.85;
        prevObj.scale.setScalar(1);
      }
      // Highlight current node
      const currObj = node?.__threeObj;
      if (currObj?.userData?.coreMat) {
        (currObj.userData as NodeUserData).coreMat.opacity = 1.0;
        currObj.scale.setScalar(1.15);
      }
      dispatch({ type: 'HOVER_MARKET', payload: node || null });
    },
    [dispatch],
  );

  // Click handler
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (!node || !fgRef.current) return;

      const market = state.markets.find(m => m.id === node.id);
      if (!market) return;

      // Fly to node
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x!, node.y!, node.z!);
      fgRef.current.cameraPosition(
        { x: node.x! * distRatio, y: node.y! * distRatio, z: node.z! * distRatio },
        { x: node.x, y: node.y, z: node.z },
        1500,
      );

      dispatch({ type: 'SELECT_MARKET', payload: market });
    },
    [state.markets, dispatch],
  );

  // Pulse animation + signal ring animation
  const handleEngineTick = useCallback(() => {
    const now = Date.now();
    const nodes = state.graphData.nodes as GraphNode[];
    if (!nodes || nodes.length === 0) return;

    for (const node of nodes) {
      const obj = node.__threeObj;
      if (!obj?.userData?.glow) continue;
      const ud = obj.userData as NodeUserData;

      // Glow pulse
      if (ud.pulseSpeed > 0) {
        const scale = 1 + 0.15 * Math.sin(now * 0.001 * ud.pulseSpeed);
        ud.glow.scale.setScalar(scale);
      }

      // Signal ring animation
      if (ud.signalRing && ud.signalRingMat) {
        ud.signalRing.rotation.z += 0.002;
        ud.signalRingMat.opacity = 0.3 + 0.2 * Math.sin(now * 0.002);
      }
    }
  }, [state.graphData.nodes]);

  if (state.graphData.nodes.length === 0) return null;

  return (
    <div className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        graphData={state.graphData}
        nodeThreeObject={createOrbNode}
        nodeThreeObjectExtend={false}
        backgroundColor="#0A0E1A"
        width={dimensions.width}
        height={dimensions.height}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineTick={handleEngineTick}
        warmupTicks={50}
        cooldownTicks={200}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        showNavInfo={false}
        enableNodeDrag={false}
        linkColor={() => '#4A90B8'}
        linkWidth={0.5}
        linkOpacity={0.2}
      />
    </div>
  );
});

export default GalaxyView;
