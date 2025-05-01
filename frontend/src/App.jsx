import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Index from '@/pages/Index';

import StudentDashboard from '@/pages/StudentDashboard';
import ContestAttempt from '@/pages/ContestAttempt';
import StudentScores from '@/pages/StudentScores';
import AdminDashboard from '@/pages/AdminDashboard';
import CreateContest from '@/pages/CreateContest';
import EditContest from '@/pages/EditContest';
import Leaderboard from '@/pages/Leaderboard';

import StudentRegister from '@/pages/StudentRegister';
import AdminRegister from '@/pages/AdminRegister';
import StudentLogin from '@/pages/StudentLogin';
import AdminLogin from '@/pages/AdminLogin';
function App() {
 


  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/contest/:contestId" element={<ContestAttempt />} />
          <Route path="/student/scores" element={<StudentScores />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/contest/create" element={<CreateContest />} />
          <Route path="/admin/contest/edit/:contestId" element={<EditContest />} />
          <Route path="/student/register" element={<StudentRegister />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/contest/leaderboard/:contestId" element={<Leaderboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;