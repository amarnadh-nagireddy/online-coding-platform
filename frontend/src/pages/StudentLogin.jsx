import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const StudentLogin = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData.username, formData.password);
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    console.log('Google credential response:', credentialResponse);
    if (!credentialResponse.credential) {
      console.error('No credential received from Google');
      setError('No credential received from Google');
      return;
    }
    try {
      console.log('Sending Google token to backend:', credentialResponse.credential);
      await googleLogin(credentialResponse.credential);
      navigate('/student/dashboard');
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.response?.data?.error || 'Google login failed');
    }
  };

  const handleGoogleError = () => {
    console.error('Google OAuth error');
    setError('Google login failed. Please try again.');
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Google Client ID is not configured. Please contact the administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Student Login</h1>
            <p className="mt-2 text-gray-600">Sign in to your student account</p>
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>

          <div className="flex items-center justify-center my-4">
            <span className="text-gray-600">or</span>
          </div>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            text="signin_with"
            width="100%"
          />

          <p className="text-center text-sm">
            Don't have an account?{' '}
            <Link to="/student/register" className="text-primary">
              Register
            </Link>
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default StudentLogin;