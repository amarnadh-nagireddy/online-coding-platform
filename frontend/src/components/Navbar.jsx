import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu as LucideMenu, X } from 'lucide-react';
import { Menu, Transition, MenuButton, MenuItems, MenuItem } from '@headlessui/react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false); 
    navigate("/");
  };

  const handleOptionSelect = (path) => {
    navigate(path);
    setIsMenuOpen(false); // Close menu on navigation
  };

  return (
    <nav className="bg-white shadow-md py-4 px-6">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-primary">
          Contest Platform
        </Link>

        <button onClick={toggleMenu} className="md:hidden text-gray-600">
          {isMenuOpen ? <X size={24} /> : <LucideMenu size={24} />}
        </button>

        <ul className={`md:flex items-center gap-6 ${isMenuOpen ? 'block' : 'hidden'} md:block absolute md:static top-16 left-0 w-full md:w-auto bg-white md:bg-transparent p-4 md:p-0 z-50`}>
          <li><Link to="/" className="block py-2 text-gray-700 hover:text-primary">Home</Link></li>
          {isAuthenticated && user?.role === 'student' && (
            <>
              <li><Link to="/student/dashboard" className="block py-2 text-gray-700 hover:text-primary">Dashboard</Link></li>
              <li><Link to="/student/scores" className="block py-2 text-gray-700 hover:text-primary">Scores</Link></li>
            </>
          )}
          {isAuthenticated && user?.role === 'admin' && (
            <li><Link to="/admin/dashboard" className="block py-2 text-gray-700 hover:text-primary">Dashboard</Link></li>
          )}
          {isAuthenticated ? (
            <li><Button onClick={handleLogout} variant="outline">Logout</Button></li>
          ) : (
            <>
              <li>
                <Menu as="div" className="relative inline-block text-left">
                  <MenuButton as={Button} className="w-full">Login</MenuButton>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <MenuItems className="absolute mt-2 w-40 origin-top-left bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
                      <MenuItem>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            onClick={() => handleOptionSelect('/student/login')}
                          >
                            Student Login
                          </button>
                        )}
                      </MenuItem>
                      <MenuItem>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            onClick={() => handleOptionSelect('/admin/login')}
                          >
                            Admin Login
                          </button>
                        )}
                      </MenuItem>
                    </MenuItems>
                  </Transition>
                </Menu>
              </li>
              <li>
                <Menu as="div" className="relative inline-block text-left">
                  <MenuButton as={Button} variant="outline" className="w-full">Register</MenuButton>
                  <Transition
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <MenuItems className="absolute mt-2 w-44 origin-top-left bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
                      <MenuItem>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            onClick={() => handleOptionSelect('/student/register')}
                          >
                            Student Register
                          </button>
                        )}
                      </MenuItem>
                      <MenuItem>
                        {({ active }) => (
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            onClick={() => handleOptionSelect('/admin/register')}
                          >
                            Admin Register
                          </button>
                        )}
                      </MenuItem>
                    </MenuItems>
                  </Transition>
                </Menu>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
