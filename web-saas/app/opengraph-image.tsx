import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(circle at 20% 20%, #a855f7 0%, #7c3aed 42%, #1a1625 100%)',
          color: '#f8f7fb',
          padding: '56px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            borderRadius: '999px',
            border: '2px solid rgba(248, 247, 251, 0.52)',
            padding: '10px 18px',
            fontSize: 28,
            fontWeight: 600
          }}
        >
          Spokio
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>Complete IELTS SaaS Platform</div>
          <div style={{ fontSize: 32, opacity: 0.92 }}>
            Speaking-safe web + mobile experience for speaking, writing, reading, and listening.
          </div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
