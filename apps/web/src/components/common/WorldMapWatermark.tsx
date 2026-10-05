/**
 * Dot-matrix world map watermark. A coarse equirectangular landmass bitmap
 * (72 columns × 24 rows, one dot per land cell) rendered as small squares —
 * "digital" style, deliberately abstract. Inherits color via currentColor and
 * sits at very low opacity so it reads as a watermark in both light and dark
 * modes without ever competing with page content.
 */

/** Land bands per row: inclusive column ranges [startCol, endCol]. */
const LAND_BANDS: Array<Array<[number, number]>> = [
  [],                                     // row 0 — arctic
  [[23, 27], [48, 52]],                   // N. Greenland, arctic Russia
  [[20, 29], [44, 66]],                   // Greenland, N. Canada / Siberia
  [[3, 7], [10, 22], [31, 33], [43, 67]], // Alaska, Canada, Scandinavia, Russia
  [[2, 8], [9, 21], [33, 34], [36, 42], [43, 68]], // + UK, N. Europe
  [[3, 8], [10, 20], [33, 34], [35, 43], [44, 66]], // Canada, US, UK, Europe, Russia
  [[4, 9], [11, 21], [34, 44], [46, 63], [63, 65]], // US, S. Europe, Asia, Japan
  [[5, 10], [12, 20], [34, 44], [46, 62]], // US, S. Europe, Asia
  [[6, 11], [13, 19], [33, 45], [47, 61]], // US south, N. Africa, Middle East, China
  [[7, 12], [14, 19], [30, 46], [48, 60]], // Mexico, N. Africa, Africa+ME, India
  [[8, 13], [15, 17], [29, 44], [49, 58]], // Mexico, C. America, Africa, SE Asia
  [[9, 13], [16, 17], [29, 43], [50, 57]], // C. America, Africa, SE Asia
  [[10, 13], [17, 18], [30, 42], [52, 56]], // Panama, Africa, SE Asia
  [[11, 13], [18, 26], [33, 42], [54, 60]], // S. America, Africa, Indonesia
  [[17, 26], [33, 41], [56, 62]],         // S. America, S. Africa, Indonesia
  [[16, 25], [34, 40], [57, 63]],         // S. America, S. Africa, New Guinea
  [[16, 24], [35, 39]],                   // S. America, S. Africa
  [[16, 23], [58, 66]],                   // S. America, Australia
  [[16, 22], [58, 66]],                   // S. America, Australia
  [[16, 21], [58, 66], [68, 69]],         // S. America, Australia, NZ
  [[16, 21], [59, 65], [68, 69]],         // S. America, Australia, NZ
  [[17, 20], [60, 64], [68, 69]],         // S. America tip, Australia, NZ
  [[17, 20], [68, 69]],                   // S. America tip, NZ
  [[18, 19]],                             // S. America tip
]

const COLS = 72
const ROWS = LAND_BANDS.length
const CELL = 10 // px per grid cell

interface Dot {
  x: number
  y: number
}

function buildDots(): Dot[] {
  const dots: Dot[] = []
  LAND_BANDS.forEach((bands, row) => {
    bands.forEach(([start, end]) => {
      for (let col = start; col <= end; col++) {
        dots.push({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 })
      }
    })
  })
  return dots
}

const DOTS = buildDots()

export function WorldMapWatermark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {DOTS.map((dot, index) => (
        <rect key={index} x={dot.x - 1.6} y={dot.y - 1.6} width={3.2} height={3.2} rx={0.8} />
      ))}
    </svg>
  )
}
