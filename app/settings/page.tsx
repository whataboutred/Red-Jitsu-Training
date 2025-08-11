'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import EnhancedSettings from '@/components/EnhancedSettings'
import DeleteAllData from '@/components/DeleteAllData'

export default function SettingsPage() {
  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 p-4 space-y-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <EnhancedSettings />
          
          {/* Keep the delete section separate */}
          <div className="mt-8">
            <DeleteAllData />
          </div>
        </div>
      </main>
    </div>
  )
}