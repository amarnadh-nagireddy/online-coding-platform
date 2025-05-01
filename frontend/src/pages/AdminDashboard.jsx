import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import axios from 'axios';

const AdminDashboard = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user || user.role?.toLowerCase() !== 'admin') {
      navigate('/admin/login', { replace: true });
      return;
    }

    const fetchContests = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://localhost:8000/api/contests/admin/dashboard/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setContests(response.data.contests || []);
      } catch (error) {
        console.error('Failed to fetch contests:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContests();
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleDelete = async (contestId) => {
    try {
      await axios.delete(`http://localhost:8000/api/contests/admin/contest/delete/${contestId}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      setContests(contests.filter((c) => c.contest_id !== contestId));
    } catch (error) {
      console.error('Failed to delete contest:', error);
    }
  };

  if (authLoading || loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated || user?.role?.toLowerCase() !== 'admin') return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Unauthorized</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button asChild>
            <Link to="/admin/contest/create">Create Contest</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contests.map((contest) => (
            <div key={contest.contest_id} className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold">{contest.name}</h2>
              <p>Status: {contest.status}</p>
              <p>Participants: {contest.participant_count}</p>
              <p>Start: {new Date(contest.start_datetime).toLocaleString()}</p>
              <p>End: {new Date(contest.end_datetime).toLocaleString()}</p>
              <div className="flex gap-2 mt-4">
                <Button asChild variant="outline">
                  <Link to={`/admin/contest/edit/${contest.contest_id}`}>Edit</Link>
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(contest.contest_id)}>
                  Delete
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/admin/contest/leaderboard/${contest.contest_id}`}>Leaderboard</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;