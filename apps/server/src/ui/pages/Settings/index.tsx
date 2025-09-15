import { Route, Routes, Navigate } from 'react-router-dom'
import SettingsNav from './components/SettingsNav'
import GeneralSettings from './GeneralSettings'
import TeamSettings from './TeamSettings'
import GitHubSettings from './GitHubSettings'

function Settings() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content">Settings</h1>
        <p className="text-base-content/70 mt-2">
          Manage your team, integrations, and general preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 flex-shrink-0">
          <SettingsNav />
        </div>

        <div className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="general" replace />} />
            <Route path="/general" element={<GeneralSettings />} />
            <Route path="/team" element={<TeamSettings />} />
            <Route path="/github" element={<GitHubSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Settings