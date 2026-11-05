/** Small line icons for buttons and links, drawn in the current text colour (no icon library needed). */
const PATHS = {
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  plus: ['M12 5v14', 'M5 12h14'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
  upload: ['M12 15V3', 'M7 8l5-5 5 5', 'M4 21h16'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 15h10l1-15', 'M10 11v6', 'M14 11v6'],
  edit: ['M4 20h4L20 8l-4-4L4 16v4z', 'M14 6l4 4'],
  play: ['M7 4l13 8-13 8V4z'],
  save: ['M5 3h11l4 4v14H5z', 'M8 3v6h8', 'M8 21v-7h9v7'],
  tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z', 'M8 8h.01'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M3 20h18'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  power: ['M12 3v9', 'M6.3 6.3a8 8 0 1 0 11.4 0'],
  check: ['M5 12l5 5 9-10'],
  back: ['M15 5l-7 7 7 7'],
  next: ['M9 5l7 7-7 7'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  nfc: ['M7 8a6 6 0 0 1 0 8', 'M11 5a10 10 0 0 1 0 14', 'M15 2.5a14 14 0 0 1 0 19', 'M3.5 11h.01'],
  trophy: ['M8 4h8v6a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 14v4', 'M8 21h8'],
  camera: ['M4 8h4l2-3h4l2 3h4v11H4z', 'M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  sound: ['M4 9v6h4l5 4V5L8 9H4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'],
  mute: ['M4 9v6h4l5 4V5L8 9H4z', 'M17 9l5 6', 'M22 9l-5 6'],
  eraser: [
    'M7 21h13',
    'M5.5 13.5l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19H8.5l-3-3a1.8 1.8 0 0 1 0-2.5z',
    'M9.5 10.5l5 5',
  ],
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
