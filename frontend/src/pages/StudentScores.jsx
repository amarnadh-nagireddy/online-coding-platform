import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import axios from 'axios';

const StudentScores = () => {
  const { isAuthenticated, user } = useAuth();
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'student') {
      const fetchScores = async () => {
        try {
          const response = await axios.get('http://localhost:8000/api/contests/student/scores/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          setAttempts(response.data.attempts);
        } catch (error) {
          console.error('Failed to fetch scores:', error);
        }
      };
      fetchScores();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || user?.role !== 'student') return <div>Unauthorized</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Your Scores</h1>
        <div className="space-y-6">
          {attempts.map((attempt) => (
            <div key={attempt.contest_id} className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold">{attempt.contest_name}</h2>
              <p>Score: {attempt.score} / {attempt.max_score}</p>
              <p>Submitted At: {new Date(attempt.submitted_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentScores;