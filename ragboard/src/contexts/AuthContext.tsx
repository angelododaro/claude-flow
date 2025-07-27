import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// User interface
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'owner' | 'collaborator' | 'viewer' | 'guest';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        const userData = localStorage.getItem(USER_DATA_KEY);

        if (token && userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            
            // Verify token is still valid
            await verifyToken(token);
          } catch (error) {
            console.error('Invalid stored user data:', error);
            logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Verify token with backend
  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
      }

      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      logout();
      return false;
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      // Store tokens and user data
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));

      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = (): void => {
    // Clear all stored data
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);

    setUser(null);
    
    // Redirect to login page or show login modal
    // This could be handled by the parent application
  };

  // Refresh token function
  const refreshToken = async (): Promise<void> => {
    try {
      const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (!refreshTokenValue) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update stored tokens
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      // Update user data if provided
      if (data.user) {
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      throw error;
    }
  };

  // Update user data
  const updateUser = (userData: Partial<User>): void => {
    if (!user) return;

    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
  };

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;

    // Parse JWT to get expiration time
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // Refresh token 5 minutes before expiration
      const refreshTime = Math.max(timeUntilExpiration - 5 * 60 * 1000, 0);

      if (refreshTime > 0) {
        const timeoutId = setTimeout(() => {
          refreshToken().catch(console.error);
        }, refreshTime);

        return () => clearTimeout(timeoutId);
      } else {
        // Token is already expired or close to expiration
        refreshToken().catch(() => logout());
      }
    } catch (error) {
      console.error('Error parsing token:', error);
    }
  }, [isAuthenticated]);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requiredRole?: User['role'];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback = <div>Please log in to access this page.</div>,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check role-based access if required
  if (requiredRole && user?.role !== requiredRole) {
    return <div>You don't have permission to access this page.</div>;
  }

  return <>{children}</>;
};

export default AuthContext;