import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KSK Attendance · Maharashtra',
    short_name: 'KSK Attendance',
    description: 'Attendance for ITI instructors and principals in Maharashtra.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ececec',
    theme_color: '#ffffff',
    icons: [
      { src: '/branding/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/branding/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/branding/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
