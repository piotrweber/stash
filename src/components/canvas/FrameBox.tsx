import type { Frame } from '../../types/collection'

interface FrameBoxProps {
  frame: Frame
}

export function FrameBox({ frame }: FrameBoxProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        backgroundColor: frame.color + '33', // ~20% opacity
        border: `2px solid ${frame.color}`,
        borderRadius: 8,
        zIndex: 0,
      }}
    >
      <span
        className="absolute top-1.5 left-2.5 text-xs font-semibold select-none"
        style={{ color: frame.color }}
      >
        {frame.label}
      </span>
    </div>
  )
}
