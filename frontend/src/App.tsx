import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/izden/AppLayout'
import { AssignmentPage } from '@/pages/AssignmentPage'
import { AssignmentsPage } from '@/pages/AssignmentsPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WorkPage } from '@/pages/WorkPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<AssignmentsPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentPage />} />
          <Route path="works/:workId" element={<WorkPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
