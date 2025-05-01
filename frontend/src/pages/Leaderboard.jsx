import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import axios from 'axios';

const Leaderboard = () => {
  const { contestId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      const fetchLeaderboard = async () => {
        try {
          const response = await axios.get(`http://localhost:8000/api/contests/admin/contest/leaderboard/${contestId}/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          setLeaderboard(response.data);
        } catch (error) {
          console.error('Failed to fetch leaderboard:', error);
        }
      };
      fetchLeaderboard();
    }
  }, [isAuthenticated, user, contestId]);

  if (!isAuthenticated || user?.role !== 'admin') return <div>Unauthorized</div>;
  if (!leaderboard) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Leaderboard: {leaderboard.contest.name}</h1>
        <p>Max Score: {leaderboard.contest.max_score}</p>
        <p>Participants: {leaderboard.contest.participant_count}</p>
        <div className="mt-6 space-y-4">
          {leaderboard.leaderboard.map((entry, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-md">
              <p className="font-semibold">{index + 1}. {entry.student_name}</p>
              <p>Score: {entry.score}</p>
              <p>Submitted: {new Date(entry.submitted_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;