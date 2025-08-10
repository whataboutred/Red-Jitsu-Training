'use client'

import Image from 'next/image'

export default function BackgroundLogo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="relative w-[600px] h-[600px] md:w-[800px] md:h-[800px] opacity-[0.35] mix-blend-screen">
        <Image
          src="/red-jitsu-logo.png"
          alt=""
          fill
          style={{ objectFit: 'contain' }}
          priority
          className="select-none"
        />
      </div>
    </div>
  )
}