import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import axios from 'axios';

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/api/accounts/admin/register/', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      alert(response.data.message);
      navigate('/admin/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await axios.post('http://localhost:8000/api/accounts/google-login/', {
        token: credentialResponse.credential,
        role: 'admin'
      });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Google registration failed');
    }
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Admin Registration</h1>
            <p className="mt-2 text-gray-600">Create your admin account</p>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
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
                  placeholder="Create a password"
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
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
              />
            </div>
            <Button type="submit" className="w-full">
              Register <UserPlus className="ml-2" size={18} />
            </Button>
          </form>

          <div className="flex items-center justify-center my-4">
            <div className="border-t border-gray-300 flex-grow mr-3"></div>
            <span className="text-gray-600">or</span>
            <div className="border-t border-gray-300 flex-grow ml-3"></div>
          </div>

          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google registration failed')}
            text="signup_with"
            width="100%"
          />

          <p className="text-center text-sm">
            Already have an account? <Link to="/admin/login" className="text-primary">Login</Link>
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default AdminRegister;