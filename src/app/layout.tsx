import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GaemiStock - 실시간 주식 포트폴리오 대시보드',
  description: '친구들과 함께 실시간으로 서로의 보유 주식 현황 및 등락률을 공유하고 모니터링하는 무료 웹 대시보드',
  keywords: ['주식', '포트폴리오', '실시간 주가', '대시보드', '친구들과 주식 공유', 'Next.js'],
  authors: [{ name: 'Antigravity Stock Dashboard' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
