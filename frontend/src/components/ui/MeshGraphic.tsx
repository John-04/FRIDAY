import { motion } from 'framer-motion'

const NODES = [
  { cx: 300, cy: 80 },  { cx: 500, cy: 60 },  { cx: 580, cy: 180 },
  { cx: 460, cy: 260 }, { cx: 320, cy: 300 }, { cx: 160, cy: 220 },
  { cx: 100, cy: 100 }, { cx: 420, cy: 160 }, { cx: 240, cy: 160 },
  { cx: 540, cy: 300 }, { cx: 380, cy: 360 }, { cx: 200, cy: 340 },
]

const EDGES = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],
  [0,7],[1,7],[2,7],[7,3],[7,8],[8,4],[8,5],
  [3,9],[9,2],[9,10],[10,4],[10,11],[11,5],[11,8],
]

export default function MeshGraphic() {
  return (
    <svg
      viewBox="0 0 640 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      style={{ animation: 'meshMove 15s ease-in-out infinite' }}
    >
      <defs>
        <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1A6BFF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#1A6BFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {EDGES.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={NODES[a].cx} y1={NODES[a].cy}
          x2={NODES[b].cx} y2={NODES[b].cy}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: i * 0.04 }}
        />
      ))}

      {/* Nodes */}
      {NODES.map((node, i) => (
        <motion.g key={i}>
          {/* Glow ring */}
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r={12}
            fill="url(#nodeGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.15 }}
          />
          {/* Core dot */}
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r={4}
            fill="rgba(255,255,255,0.7)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
          />
        </motion.g>
      ))}

      {/* Travelling data point — fixed: use explicit cx/cy with defined initial */}
      <motion.circle
        r={3}
        fill="#1A6BFF"
        initial={{ cx: NODES[0].cx, cy: NODES[0].cy, opacity: 0 }}
        animate={{
          cx: NODES.map(n => n.cx),
          cy: NODES.map(n => n.cy),
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  )
}
