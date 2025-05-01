import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import axios from 'axios';

const StudentDashboard = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [contests, setContests] = useState([]);
  const [isFetchingContests, setIsFetchingContests] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !user || user.role?.toLowerCase() !== 'student') {
      navigate('/login', { replace: true });
      return;
    }

    const fetchContests = async () => {
      setIsFetchingContests(true);
      setFetchError(null);
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get('http://localhost:8000/api/contests/student/dashboard/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setContests(response.data.contests || []);
      } catch (error) {
        setFetchError('Failed to load contests. Please try again.');
        if (error.response?.status === 401) {
          navigate('/login', { replace: true });
        }
      } finally {
        setIsFetchingContests(false);
      }
    };

    fetchContests();
  }, [loading, isAuthenticated, user, navigate]);

  if (loading || isFetchingContests) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Student Dashboard</h1>
        {fetchError && <div className="text-red-600 mb-4">{fetchError}</div>}
        {contests.length === 0 ? (
          <p className="text-gray-600">No contests available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.map((contest) => (
              <div key={contest.contest_id} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold">{contest.name}</h2>
                <p className="text-gray-600">Status: {contest.status}</p>
                <p className="text-gray-600">
                  Start: {new Date(contest.start_datetime).toLocaleString()}
                </p>
                <p className="text-gray-600">
                  End: {new Date(contest.end_datetime).toLocaleString()}
                </p>
                <Button asChild className="mt-4 w-full" disabled={contest.status === 'Attempted'}>
                  <Link to={`/student/contest/${contest.contest_id}`}>Attempt Contest</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;