import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated');
    return <Navigate to="/" replace />;
  }

  if (requiredRole) {
    console.log('ProtectedRoute: Checking role', { userRole: user?.role, requiredRole });
    if (user?.role && user.role.toLowerCase() !== requiredRole.toLowerCase()) {
      console.log('ProtectedRoute: Role mismatch, redirecting');
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
