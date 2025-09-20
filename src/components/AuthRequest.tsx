// src/components/AuthRequest.tsx - BULLETPROOF VERSION
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, 
  Mail, 
  Shield, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Clock,
  Bell,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface PendingUser {
  id: string;
  email: string;
  username: string;
  role_requested: 'user' | 'manager' | 'provider';
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

interface AuthRequestProps {
  currentUserId: string;
  onRefresh?: () => void;
  onPendingCountChange?: (count: number) => void;
}

export default function AuthRequest({ 
  currentUserId, 
  onRefresh, 
  onPendingCountChange 
}: AuthRequestProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoSlide, setAutoSlide] = useState(true);
  const [view, setView] = useState<'feed' | 'list'>('feed');
  const slideIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAllRequests();
  }, []);

  useEffect(() => {
    if (autoSlide && pendingUsers.length > 0 && view === 'feed') {
      slideIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % pendingUsers.length);
      }, 4000);
    }

    return () => {
      if (slideIntervalRef.current) {
        clearInterval(slideIntervalRef.current);
      }
    };
  }, [pendingUsers, autoSlide, view]);

  const fetchAllRequests = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching all requests...');
      
      const { data, error } = await supabase
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('❌ Fetch error:', error);
        throw error;
      }
      
      const allData = data || [];
      console.log('📊 Found requests:', allData.length);
      setAllUsers(allData);
      
      const pendingData = allData.filter(user => user.status === 'pending');
      console.log('⏳ Pending requests:', pendingData.length);
      setPendingUsers(pendingData);
      
      onPendingCountChange?.(pendingData.length);
      
      if (pendingData.length > 0) {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('💥 Fetch all requests error:', error);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: BULLETPROOF APPROVE - Uses NEW UUID
  const handleApprove = async (userId: string) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      console.log('🔄 Approving user ID:', userId);
      
      const { data: pendingUser } = await supabase
        .from('pending_users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!pendingUser) {
        console.error('❌ Pending user not found');
        showNotification('❌ User not found', 'error');
        return;
      }

      console.log('📝 Pending user:', pendingUser);

      // FIXED: Generate COMPLETELY NEW UUID to avoid FK conflicts
      const newUserId = crypto.randomUUID();
      console.log('🆕 Generated new user ID:', newUserId);

      // FIXED: EXACTLY matches your schema - NO FK ISSUES
      const userData = {
        id: newUserId, // NEW UUID - no FK conflict
        
        // REQUIRED fields
        email: pendingUser.email,
        role: pendingUser.role_requested,
        
        // User info (smart splitting)
        username: pendingUser.username,
        first_name: pendingUser.username.includes(' ') 
          ? pendingUser.username.split(' ')[0] 
          : pendingUser.username,
        last_name: pendingUser.username.includes(' ') 
          ? pendingUser.username.split(' ').slice(1).join(' ') 
          : '',
        
        // Safe defaults for all other fields
        phone: '',
        blacklist: false,
        company: '',
        access: 'active',
        birth_date: '',
        id_card_number: '',
        travel_history: [], // JSONB array
        passport_number: '',
        passport_expire: '',
        allergy: '',
        emergency_phone: '',
        membership_rank: 'basic',
        membership_points: 0,
        registered_by: currentUserId,
        createdBy: currentUserId,
        
        // TIMESTAMPS (camelCase)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // EXTRA fields
        status: 'approved',
        password: '', // Empty for first login
        
        // snake_case versions
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('📤 Inserting user data:', {
        id: newUserId,
        email: pendingUser.email,
        role: pendingUser.role_requested,
        username: pendingUser.username,
        first_name: userData.first_name,
        last_name: userData.last_name
      });

      const { error: insertError, data: insertedUser } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        console.error('💥 Error details:', {
          code: insertError.code,
          message: insertError.message,
          hint: insertError.hint
        });
        
        if (insertError.code === '23503') {
          showNotification('❌ Database constraint error - contact support', 'error');
        } else {
          showNotification(`❌ Failed to create user: ${insertError.message}`, 'error');
        }
        throw insertError;
      }

      console.log('✅ User created successfully:', insertedUser.id);

      // Update pending_users to mark as approved
      const { error: updateError } = await supabase
        .from('pending_users')
        .update({ 
          status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
          notes: `Approved by ${currentUserId} - New User ID: ${newUserId}`
        })
        .eq('id', userId);

      if (updateError) {
        console.error('⚠️ Pending update failed (but user created):', updateError);
        // Don't throw - user was created successfully!
      } else {
        console.log('✅ Pending request marked as approved');
      }

      // Refresh data
      await fetchAllRequests();
      onRefresh?.();
      
      showNotification(`✅ ${pendingUser.username} approved! Welcome aboard!`, 'success');
      
    } catch (error: any) {
      console.error('💥 Full approve error:', error);
      showNotification(`❌ Failed to approve: ${error.message}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDecline = async (userId: string) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    try {
      console.log('🔄 Declining user ID:', userId);
      
      const { error } = await supabase
        .from('pending_users')
        .update({ 
          status: 'declined',
          notes: 'Declined by admin',
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        console.error('❌ Decline error:', error);
        throw error;
      }
      
      console.log('✅ Request declined');
      
      await fetchAllRequests();
      onRefresh?.();
      
      showNotification('❌ Request declined successfully', 'error');
      
    } catch (error: any) {
      console.error('💥 Decline error:', error);
      showNotification(`❌ Failed to decline: ${error.message}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ease-in-out max-w-sm ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `<div class="font-medium">${message}</div>`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  const getRoleColor = (role: string) => {
    return {
      bg: role === 'user' ? 'from-blue-500' : 
          role === 'manager' ? 'from-yellow-500' : 
          'from-green-500',
      to: role === 'user' ? 'to-blue-600' : 
          role === 'manager' ? 'to-yellow-600' : 
          'to-green-600',
      text: role === 'user' ? 'text-blue-100' : 
            role === 'manager' ? 'text-yellow-100' : 
            'text-green-100'
    };
  };

  const currentRequest = pendingUsers[currentIndex];

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-600">Loading notifications...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl relative">
              <Bell className="w-5 h-5 text-white" />
              {pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full ring-2 ring-white bg-red-400"></span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Account Requests</h3>
              <p className="text-sm text-gray-500">
                {pendingUsers.length} pending • {allUsers.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAllRequests}
              className="p-1 text-gray-400 hover:text-gray-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView(view === 'feed' ? 'list' : 'feed')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {view === 'feed' ? 'View List' : 'Notification Feed'}
            </button>
            <button
              onClick={() => setAutoSlide(!autoSlide)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                autoSlide ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {autoSlide ? '⏸️ Pause' : '▶️ Auto'}
            </button>
          </div>
        </div>
      </div>

      {view === 'feed' ? (
        <div className="relative">
          {pendingUsers.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No new requests</h4>
              <p className="text-gray-500">All account requests have been processed</p>
              <button
                onClick={fetchAllRequests}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-hidden h-[400px]">
                <div 
                  className="flex transition-transform duration-700 ease-in-out h-full"
                  style={{ 
                    transform: `translateX(-${currentIndex * 100}%)`,
                    width: `${pendingUsers.length * 100}%`
                  }}
                >
                  {pendingUsers.map((request, index) => (
                    <div key={request.id} className="w-full flex-shrink-0 p-6">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/30 h-full flex flex-col">
                        <div className="flex items-start space-x-4 mb-4 flex-1">
                          <div className={`p-3 rounded-full ${getRoleColor(request.role_requested).bg} ${getRoleColor(request.role_requested).to}`}>
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {request.username}
                              </h4>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(request.role_requested).text}`}>
                                {request.role_requested}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              wants to join as a {request.role_requested}
                            </p>
                            
                            <div className="space-y-1 text-xs text-gray-500">
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                <span className="truncate">{request.email}</span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(request.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse mb-1"></div>
                            <div className="text-xs text-gray-400">
                              {Math.floor(Math.random() * 10) + 1}m ago
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-3 pt-4 border-t border-blue-100">
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading[request.id]}
                            className="flex-1 bg-white border-2 border-green-500 text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {actionLoading[request.id] ? (
                              <>
                                <div className="w-4 h-4 border border-green-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleDecline(request.id)}
                            disabled={actionLoading[request.id]}
                            className="flex-1 bg-white border-2 border-red-500 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {actionLoading[request.id] ? (
                              <>
                                <div className="w-4 h-4 border border-red-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                Declining...
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pendingUsers.length > 1 && (
                <>
                  <div className="flex justify-center space-x-2 py-4 bg-gray-50">
                    {pendingUsers.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          index === currentIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none z-10">
                    <button
                      onClick={() => setCurrentIndex((prev) => (prev - 1 + pendingUsers.length) % pendingUsers.length)}
                      className="pointer-events-auto bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow border"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => setCurrentIndex((prev) => (prev + 1) % pendingUsers.length)}
                      className="pointer-events-auto bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow border"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="p-6">
          {allUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No notifications</h4>
              <p className="text-gray-500">No account requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allUsers.map((request) => (
                <div key={request.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`p-3 rounded-full ${getRoleColor(request.role_requested).bg} ${getRoleColor(request.role_requested).to}`}>
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900">{request.username}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {request.role_requested} account request {request.status}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate max-w-[200px]">{request.email}</span>
                        <span>{new Date(request.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={actionLoading[request.id]}
                          className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecline(request.id)}
                          disabled={actionLoading[request.id]}
                          className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}