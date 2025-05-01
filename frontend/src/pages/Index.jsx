import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import axios from 'axios';
import { Menu, Transition } from '@headlessui/react';

const Index = () => {
  const { isAuthenticated, user } = useAuth();
  const [contests, setContests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user?.role === 'student') {
      const fetchContests = async () => {
        try {
          const response = await axios.get('http://localhost:8000/api/contests/student/dashboard/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          setContests(response.data.contests.slice(0, 3)); // Limit to 3 for featured section
        } catch (error) {
          console.error('Failed to fetch contests:', error);
        }
      };
      fetchContests();
    }
  }, [isAuthenticated, user]);

  const handleOptionSelect = (path) => {
    navigate(path);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 flex flex-col md:flex-row items-center justify-center py-12 px-4 md:px-6 bg-gradient-to-b from-secondary/50 to-background">
        <div className="flex flex-col gap-6 md:w-1/2 text-center md:text-left animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Contest Platform</h1>
          <p className="text-xl text-muted-foreground max-w-[600px]">
            Participate in engaging contests, challenge your knowledge, and track your progress all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            {!isAuthenticated ? (
              <>
                <Menu as="div" className="relative">
                  <Menu.Button as={Button} size="lg" className="font-semibold bg-purple-600 hover:bg-purple-700 text-white">
                    Sign In
                  </Menu.Button>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute z-10 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${
                              active ? 'bg-purple-50 text-purple-600' : ''
                            }`}
                            onClick={() => handleOptionSelect('/student/login')}
                          >
                            Student Login
                          </button>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${
                              active ? 'bg-purple-50 text-purple-600' : ''
                            }`}
                            onClick={() => handleOptionSelect('/admin/login')}
                          >
                            Admin Login
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>

                <Menu as="div" className="relative">
                  <Menu.Button as={Button} variant="outline" size="lg" className="font-semibold border-purple-600 text-purple-600 hover:bg-purple-50">
                    Register
                  </Menu.Button>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute z-10 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${
                              active ? 'bg-purple-50 text-purple-600' : ''
                            }`}
                            onClick={() => handleOptionSelect('/student/register')}
                          >
                            Student Register
                          </button>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${
                              active ? 'bg-purple-50 text-purple-600' : ''
                            }`}
                            onClick={() => handleOptionSelect('/admin/register')}
                          >
                            Admin Register
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </>
            ) : (
              <Button asChild size="lg" className="font-semibold bg-purple-600 hover:bg-purple-700 text-white">
                <Link to={user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'}>
                  Go to Dashboard
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-8 md:mt-0 md:w-1/2 flex justify-center animate-slide-in">
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-primary to-accent opacity-75 blur"></div>
            <div className="relative bg-card shadow-lg rounded-lg p-6 border">
              <h3 className="text-xl font-semibold mb-4">Features</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="rounded-full bg-primary/10 p-1 text-primary">✓</span>
                  <span>Time-bound contests with real-time tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="rounded-full bg-primary/10 p-1 text-primary">✓</span>
                  <span>Multiple question types: MCQ, MSQ, and Fill-in-the-Blanks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="rounded-full bg-primary/10 p-1 text-primary">✓</span>
                  <span>Track your progress with detailed leaderboards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="rounded-full bg-primary/10 p-1 text-primary">✓</span>
                  <span>Responsive design works on all your devices</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Contests Section */}
      <section className="py-12 px-4 md:px-6 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Featured Contests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.length > 0 ? (
              contests.map((contest) => (
                <div key={contest.contest_id} className="bg-card rounded-lg shadow-md border overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="bg-primary/10 p-4">
                    <span className="inline-block px-3 py-1 text-sm font-medium text-primary bg-primary/20 rounded-full">
                      {contest.status}
                    </span>
                    <h3 className="mt-2 text-xl font-semibold">{contest.name}</h3>
                    <p className="text-muted-foreground">Test your skills</p>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Start Date:</span>
                      <span className="text-sm font-medium">{contest.start_datetime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Duration:</span>
                      <span className="text-sm font-medium">{contest.duration_minutes || 60} minutes</span>
                    </div>
                    <Button asChild variant="outline" className="w-full mt-4">
                      <Link to={isAuthenticated ? `/student/contest/${contest.contest_id}` : '/login'}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center col-span-full">No contests available yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 px-4 md:px-6">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Register</h3>
              <p className="text-muted-foreground">Create your account to get started</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Browse Contests</h3>
              <p className="text-muted-foreground">Find contests that match your interests</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Participate</h3>
              <p className="text-muted-foreground">Take part and check the leaderboard</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-muted py-8 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-xl font-bold">Contest Platform</h3>
              <p className="text-muted-foreground mt-1">© 2025 All rights reserved.</p>
            </div>
            <div className="flex gap-6">
              <Link to="/about" className="text-foreground hover:text-primary transition-colors">About</Link>
              <Link to="/help" className="text-foreground hover:text-primary transition-colors">Help</Link>
              <Link to="/contact" className="text-foreground hover:text-primary transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;