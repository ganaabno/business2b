// src/Pages/AccountStatus.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { supabase } from "../supabaseClient";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  Mail, 
  User,
  AlertCircle 
} from "lucide-react";
import Logo from "../assets/last logo.png";

interface PendingRequest {
  id: string;
  email: string;
  username: string;
  role_requested: 'user' | 'manager' | 'provider';
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  approved_at?: string;
  notes?: string;
}

export default function AccountStatus() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'no-request' | 'pending' | 'approved' | 'declined'>('loading');
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (currentUser.role === "user") {
      checkPendingRequest();
    } else {
      // If user is already approved or has different role, redirect to dashboard
      const homePath = currentUser.role === "admin" || currentUser.role === "superadmin" ? "/admin" :
        currentUser.role === "provider" ? "/provider" :
          currentUser.role === "manager" ? "/manager" : "/user";
      navigate(homePath, { replace: true });
    }
  }, [currentUser, navigate]);

  const checkPendingRequest = async () => {
    try {
      setStatus('loading');
      setError('');

      // Check if user has a pending request
      const { data, error } = await supabase
        .from('pending_users')
        .select('*')
        .eq('email', currentUser?.email || '')
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        setRequest(data);
        setStatus('pending');
      } else {
        // Check if they have an approved or declined request
        const { data: allRequests } = await supabase
          .from('pending_users')
          .select('*')
          .eq('email', currentUser?.email || '')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (allRequests) {
          if (allRequests.status === 'approved') {
            setRequest(allRequests);
            setStatus('approved');
          } else {
            setRequest(allRequests);
            setStatus('declined');
          }
        } else {
          setStatus('no-request');
        }
      }
    } catch (err: any) {
      console.error('Error checking account status:', err);
      setError('Failed to check your account status. Please try again.');
      setStatus('loading');
    }
  };

  const handleResendRequest = async () => {
    try {
      setError('');
      
      // Delete the declined request and create a new one
      if (request?.status === 'declined') {
        await supabase
          .from('pending_users')
          .delete()
          .eq('id', request.id);
      }

      // Create new pending request
      const { error } = await supabase.from("pending_users").insert({
        email: currentUser?.email || '',
        username: currentUser?.username || currentUser?.email?.split('@')[0] || '',
        role_requested: request?.role_requested || 'user',
        status: "pending",
        created_at: new Date(),
      });

      if (error) throw error;

      // Refresh the status
      setTimeout(() => {
        checkPendingRequest();
        alert('✅ Your request has been resubmitted! An admin will review it shortly.');
      }, 1000);

    } catch (err: any) {
      console.error('Error resubmitting request:', err);
      setError('Failed to resubmit your request. Please try again.');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending': return <Clock className="w-16 h-16 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'declined': return <XCircle className="w-16 h-16 text-red-500" />;
      default: return <Shield className="w-16 h-16 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return 'from-yellow-50 to-amber-50';
      case 'approved': return 'from-green-50 to-emerald-50';
      case 'declined': return 'from-red-50 to-rose-50';
      default: return 'from-gray-50 to-gray-100';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending': return 'Request Pending';
      case 'approved': return 'Account Approved!';
      case 'declined': return 'Request Declined';
      case 'no-request': return 'No Request Found';
      default: return 'Checking Status...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'pending':
        return 'Your account request is being reviewed by our administrators. You will receive an email notification once your account is approved.';
      case 'approved':
        return 'Congratulations! Your account has been approved. You can now log in with your credentials.';
      case 'declined':
        return request?.notes ? `Your request was declined: "${request.notes}". You can resubmit a new request if you believe this was a mistake.` : 
               'Your account request was declined. You can resubmit a new request below.';
      case 'no-request':
        return 'No pending account request was found for your email. Please create a new account request.';
      default:
        return '';
    }
  };

  const getActionButton = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="space-y-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 shadow-lg"
            >
              Check Login Status
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
            >
              Modify Request
            </button>
          </div>
        );
      case 'approved':
        return (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-green-700 hover:to-emerald-700 focus:ring-2 focus:ring-green-500 shadow-lg"
          >
            <CheckCircle className="w-4 h-4 mr-2 inline" />
            Log In Now
          </button>
        );
      case 'declined':
        return (
          <div className="space-y-3">
            <button
              onClick={handleResendRequest}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 shadow-lg"
            >
              Resubmit Request
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
            >
              Create New Request
            </button>
          </div>
        );
      case 'no-request':
        return (
          <button
            onClick={() => navigate('/signup')}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 shadow-lg"
          >
            Create Account Request
          </button>
        );
      default:
        return null;
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <Shield className="h-8 w-8 text-white animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Checking Status</h1>
            <p className="text-gray-600 mb-6">Please wait while we check your account status...</p>
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-lg">
        {/* Main card */}
        <div className={`bg-white/90 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 transition-all duration-300 ${getStatusColor()}`}>
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <img src={Logo} alt="LogoPic" className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-2">
              Account Status
            </h1>
            <p className="text-gray-600">Here's the current status of your account request</p>
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          {/* Status Message */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{getStatusText()}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{getStatusDescription()}</p>
          </div>

          {/* Request Details (if exists) */}
          {request && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-500" />
                Request Details
              </h3>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Username:</span>
                  <span className="font-medium text-gray-900">{request.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{request.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Role Requested:</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    request.role_requested === 'user' ? 'bg-blue-100 text-blue-800' :
                    request.role_requested === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {request.role_requested}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Requested On:</span>
                  <span className="text-gray-900">{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                {request.approved_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Approved On:</span>
                    <span className="text-gray-900">{new Date(request.approved_at).toLocaleDateString()}</span>
                  </div>
                )}
                {request.notes && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Notes:</span>
                    <span className="text-red-600 text-xs italic">"{request.notes}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {getActionButton()}
            
            {/* Always show contact support */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center mb-2">
                Need help? Contact our support team
              </p>
              <button
                onClick={() => window.location.href = 'mailto:support@yourapp.com'}
                className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors flex items-center justify-center"
              >
                <Mail className="w-3 h-3 mr-1" />
                Email Support
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Secure account management powered by advanced encryption</p>
        </div>
      </div>
    </div>
  );
}