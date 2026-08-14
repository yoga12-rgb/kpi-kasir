import type { Metadata, Viewport } from 'next';
import { WebVitals } from '@/components/performance/WebVitals';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import './globals.css';

const IOS_SPLASH_ASSET_VERSION = '0.2.7';

function getIosSplashImageUrl(fileName: string) {
  return `/icons/splash/${fileName}?v=${IOS_SPLASH_ASSET_VERSION}`;
}

export const metadata: Metadata = {
  title: 'KPI Kasir Rajaklana',
  description: 'Aplikasi penilaian & ranking performa kasir Rajaklana',
  manifest: '/manifest.webmanifest',
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KPI Kasir',
    startupImage: [
      {
        url: getIosSplashImageUrl('640x1136.png'),
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('750x1334.png'),
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1242x2208.png'),
        media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1125x2436.png'),
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('828x1792.png'),
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1242x2688.png'),
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1170x2532.png'),
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1284x2778.png'),
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1179x2556.png'),
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1290x2796.png'),
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1536x2048.png'),
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('1668x2224.png'),
        media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: getIosSplashImageUrl('2048x2732.png'),
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
    ],
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/icons/favicon-32.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#eab308',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <QueryProvider>
          <WebVitals />
          <ServiceWorkerRegistration />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
