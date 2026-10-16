import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Calendar,
  CheckCircle,
  Clock,
  Star,
  Shield,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Briefcase,
  Plus,
  Trash2,
  Edit3,
  MapPin,
  Check,
  X,
  Layers,
  CalendarCheck,
  BarChart3,
  UserCheck,
  ShieldAlert,
  Send,
  MessageSquare,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function Dashboard() {
  const { user, isProvider, isAdmin, isUser, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab state synced with URL search params
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam || (isAdmin ? 'analytics' : isProvider ? 'overview' : 'bookings')
  );

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);

  // ================= ADMIN STATE =================
  const [adminStats, setAdminStats] = useState(null);
  const [adminServices, setAdminServices] = useState([]);
  const [adminServiceFilter, setAdminServiceFilter] = useState('ALL');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminProviders, setAdminProviders] = useState([]);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);

  // ================= PROVIDER STATE =================
  const [providerProfile, setProviderProfile] = useState(null);
  const [providerBookings, setProviderBookings] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);

  // Provider Publish Service Form State
  const [pubCategory, setPubCategory] = useState('');
  const [pubServiceName, setPubServiceName] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubExp, setPubExp] = useState('5 years');
  const [pubPrice, setPubPrice] = useState('');
  const [pubLocation, setPubLocation] = useState('');
  const [pubRadius, setPubRadius] = useState(15);
  const [pubAvailability, setPubAvailability] = useState('Monday - Saturday, 9:00 AM - 7:00 PM');
  const [pubSubmitting, setPubSubmitting] = useState(false);
  const [pubMsg, setPubMsg] = useState('');

  // Provider Profile Edit State
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editExperienceYears, setEditExperienceYears] = useState(0);
  const [editAddress, setEditAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ================= USER STATE =================
  const [userBookings, setUserBookings] = useState([]);
  const [savedUserLocation, setSavedUserLocation] = useState(null);
  const [editUserName, setEditUserName] = useState(user?.full_name || '');
  const [editUserPhone, setEditUserPhone] = useState(user?.phone || '');
  const [editUserLocation, setEditUserLocation] = useState('');
  const [savingUserProfile, setSavingUserProfile] = useState(false);
  const [userProfileMessage, setUserProfileMessage] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, [user, activeTab]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isAdmin) {
        // Load admin tabs
        const stats = await api.get('/admin/stats');
        setAdminStats(stats);

        if (activeTab === 'services' || activeTab === 'analytics') {
          const svcs = await api.get('/admin/services', { status_filter: adminServiceFilter });
          setAdminServices(svcs);
        }
        if (activeTab === 'users') {
          const usrs = await api.get('/admin/users');
          setAdminUsers(usrs);
        }
        if (activeTab === 'providers') {
          const provs = await api.get('/admin/providers');
          setAdminProviders(provs);
        }
        if (activeTab === 'bookings') {
          const bks = await api.get('/admin/bookings');
          setAdminBookings(bks);
        }
        if (activeTab === 'reviews') {
          const revs = await api.get('/admin/reviews');
          setAdminReviews(revs);
        }
      } else if (isProvider) {
        // Load provider data
        const [pBookings, pProfile, pServices, cats, svcs] = await Promise.all([
          api.get('/bookings/provider'),
          api.get('/providers/me/profile'),
          api.get('/providers/me/services'),
          api.get('/categories'),
          api.get('/services')
        ]);
        setProviderBookings(pBookings);
        setProviderProfile(pProfile);
        setMyServices(pServices);
        setAllCategories(cats);
        setCatalogServices(svcs);

        setEditBusinessName(pProfile.business_name || '');
        setEditBio(pProfile.bio || '');
        setEditExperienceYears(pProfile.experience_years || 0);
        setEditAddress(pProfile.address || '');
        if (!pubLocation && pProfile.address) {
          setPubLocation(pProfile.address);
        }
      } else {
        const [uBookings, savedLocation] = await Promise.all([
          api.get('/bookings/my'),
          api.get('/users/me/location'),
        ]);
        setUserBookings(uBookings);
        setSavedUserLocation(savedLocation);
        setEditUserName(user?.full_name || '');
        setEditUserPhone(user?.phone || '');
        setEditUserLocation(savedLocation?.address_line || savedLocation?.city || '');
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ================= ADMIN ACTIONS =================
  const handleApproveService = async (providerServiceId) => {
    try {
      await api.post(`/admin/services/${providerServiceId}/approve`, {});
      alert('Service has been APPROVED and is now live in the marketplace!');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error approving service');
    }
  };

  const handleRejectService = async (providerServiceId) => {
    const reason = window.prompt(
      'Enter reason for rejection (this will be shown to the provider):',
      'Documentation insufficient or service does not meet quality requirements.'
    );
    if (!reason) return;
    try {
      await api.post(`/admin/services/${providerServiceId}/reject`, { reason });
      alert('Service marked as REJECTED.');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error rejecting service');
    }
  };

  const handleToggleAdminServiceActive = async (providerServiceId) => {
    try {
      await api.patch(`/admin/services/${providerServiceId}/toggle-active`, {});
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error toggling service status');
    }
  };

  const handleToggleUserActive = async (userId, currentActive) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { is_active: !currentActive });
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error updating user status');
    }
  };

  const handleToggleProviderVerify = async (providerId, currentVerify) => {
    try {
      await api.patch(`/admin/providers/${providerId}/verify`, { is_verified: !currentVerify });
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error updating provider verification');
    }
  };

  const handleAdminCancelBooking = async (bookingId) => {
    const reason = window.prompt('Enter cancellation reason:', 'Cancelled by administrator.');
    if (!reason) return;
    try {
      await api.patch(`/admin/bookings/${bookingId}/cancel`, { reason });
      alert('Booking cancelled and email notification sent to customer!');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error cancelling booking');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await api.delete(`/admin/reviews/${reviewId}`);
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error deleting review');
    }
  };

  // ================= PROVIDER ACTIONS =================
  const handlePublishService = async (e) => {
    e.preventDefault();
    if (!pubServiceName || !pubPrice) {
      alert('Please provide at least a service name and base price.');
      return;
    }

    setPubSubmitting(true);
    setPubMsg('');

    try {
      const res = await api.post('/providers/me/services', {
        category_name: pubCategory || 'Home Services',
        service_name: pubServiceName.trim(),
        description: pubDesc,
        experience: pubExp,
        base_price: Number(pubPrice),
        service_location: pubLocation || providerProfile?.address,
        service_radius: Number(pubRadius),
        availability: pubAvailability,
        is_active: true
      });

      setPubMsg(res.message || 'Service submitted successfully for admin review!');
      setPubServiceName('');
      setPubDesc('');
      setPubPrice('');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error publishing service');
    } finally {
      setPubSubmitting(false);
    }
  };

  const handleToggleMyServiceActive = async (psId) => {
    try {
      await api.patch(`/providers/me/services/${psId}/toggle-active`, {});
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error updating service status');
    }
  };

  const handleDeleteMyService = async (psId) => {
    if (!window.confirm('Are you sure you want to delete this service offering?')) return;
    try {
      await api.delete(`/providers/me/services/${psId}`);
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error deleting service');
    }
  };

  const handleProviderBookingStatusChange = async (bookingId, newStatus) => {
    try {
      const res = await api.patch(`/bookings/${bookingId}/status`, { status: newStatus });
      alert(
        `Booking ${newStatus}! ${res.email_notified ? 'Notification email dispatched to customer.' : ''}`
      );
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error updating booking');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/providers/me/profile', {
        business_name: editBusinessName,
        bio: editBio,
        experience_years: Number(editExperienceYears),
        address: editAddress
      });
      alert('Profile updated successfully!');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error saving profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCustomerProfile = async (event) => {
    event.preventDefault();
    setSavingUserProfile(true);
    setUserProfileMessage('');

    try {
      let locationData = null;
      if (editUserLocation.trim()) {
        if (editUserLocation.trim() === savedUserLocation?.address_line) {
          locationData = {
            title: 'Home',
            address_line: savedUserLocation.address_line,
            city: savedUserLocation.city,
            state: savedUserLocation.state,
            latitude: savedUserLocation.latitude,
            longitude: savedUserLocation.longitude,
            is_primary: true,
          };
        } else {
          const geocoded = await api.get('/maps/geocode', { query: editUserLocation.trim() });
          const match = geocoded[0];
          if (!match) throw new Error('We could not find that location. Choose a recognized city or area.');
          locationData = {
            title: 'Home',
            address_line: match.display_name,
            city: match.city || match.display_name.split(',')[0],
            state: match.state || null,
            latitude: match.latitude,
            longitude: match.longitude,
            is_primary: true,
          };
        }
      }

      const updatedUser = await api.put('/users/me', {
        full_name: editUserName.trim(),
        phone: editUserPhone.trim() || null,
      });
      updateUser(updatedUser);

      if (locationData) {
        const savedLocation = await api.put('/users/me/location', locationData);
        setSavedUserLocation(savedLocation);
        setEditUserLocation(savedLocation.address_line);
      }

      setUserProfileMessage('Profile details and service location saved.');
    } catch (err) {
      setUserProfileMessage(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setSavingUserProfile(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!providerProfile) return;
    const newAvail = !providerProfile.is_available;
    try {
      await api.put('/providers/me/profile', { is_available: newAvail });
      setProviderProfile((prev) => ({ ...prev, is_available: newAvail }));
    } catch (err) {
      alert(err.message || 'Error updating availability');
    }
  };

  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2>Please log in to view your dashboard.</h2>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Header Profile Strip */}
      <div className="card" style={{
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderLeft: `4px solid ${isProvider ? '#10b981' : (isAdmin ? '#7c3aed' : 'var(--primary)')}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.85rem' }}>{user.full_name}</h1>
              <span className="badge badge-primary">{user.role}</span>
              {isProvider && providerProfile && (
                <button
                  onClick={handleToggleAvailability}
                  style={{
                    cursor: 'pointer',
                    background: providerProfile.is_available ? '#ecfdf5' : '#fef2f2',
                    color: providerProfile.is_available ? '#065f46' : '#991b1b',
                    border: '1px solid currentColor',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.2rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                  title="Click to toggle availability"
                >
                  {providerProfile.is_available ? '● Online & Accepting Jobs' : '○ Offline / Busy'}
                </button>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {user.email} {user.phone && `• ${user.phone}`}
            </div>
          </div>

          <button onClick={loadDashboardData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Dashboard Tabs Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', flexWrap: 'wrap' }}>
          {isAdmin ? (
            <>
              <button
                onClick={() => switchTab('analytics')}
                className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <BarChart3 size={15} />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => switchTab('services')}
                className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Layers size={15} />
                <span>Service Approvals ({adminStats?.pending_services || 0} Pending)</span>
              </button>
              <button
                onClick={() => switchTab('users')}
                className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Users size={15} />
                <span>Users ({adminStats?.total_users || 0})</span>
              </button>
              <button
                onClick={() => switchTab('providers')}
                className={`btn btn-sm ${activeTab === 'providers' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <UserCheck size={15} />
                <span>Providers ({adminStats?.total_providers || 0})</span>
              </button>
              <button
                onClick={() => switchTab('bookings')}
                className={`btn btn-sm ${activeTab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <CalendarCheck size={15} />
                <span>Bookings ({adminStats?.total_bookings || 0})</span>
              </button>
              <button
                onClick={() => switchTab('reviews')}
                className={`btn btn-sm ${activeTab === 'reviews' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Star size={15} />
                <span>Reviews ({adminStats?.total_reviews || 0})</span>
              </button>
            </>
          ) : isProvider ? (
            <>
              <button
                onClick={() => switchTab('overview')}
                className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Overview
              </button>
              <button
                onClick={() => switchTab('services')}
                className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
              >
                My Services ({myServices.length})
              </button>
              <button
                onClick={() => switchTab('bookings')}
                className={`btn btn-sm ${activeTab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Bookings ({providerBookings.length})
              </button>
              <button
                onClick={() => switchTab('profile')}
                className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Profile & Settings
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => switchTab('bookings')}
                className={`btn btn-sm ${activeTab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <CalendarCheck size={15} />
                <span>My bookings ({userBookings.length})</span>
              </button>
              <button
                onClick={() => switchTab('profile')}
                className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <UserCheck size={15} />
                <span>My profile</span>
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
          <div>Loading marketplace data...</div>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* 1. ADMIN DASHBOARD PANELS (Requirement 10)               */}
          {/* ======================================================== */}
          {isAdmin && (
            <div>
              {/* TAB 1: ANALYTICS */}
              {activeTab === 'analytics' && adminStats && (
                <div>
                  <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Marketplace & AI Engine Analytics</h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2rem'
                  }}>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Total Customers</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem' }}>{adminStats.total_users}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Active Providers</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>{adminStats.total_providers}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Approved Live Services</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#059669' }}>{adminStats.approved_services}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Pending Review</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#f59e0b' }}>{adminStats.pending_services}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Total Bookings</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--primary)' }}>{adminStats.total_bookings}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Completed Jobs</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>{adminStats.completed_bookings}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Most Requested Services */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Most Requested Services</h3>
                      {adminStats.most_requested_services?.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No booking records yet.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {adminStats.most_requested_services?.map((item, idx) => (
                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: 600 }}>{item.service}</span>
                              <span className="badge badge-primary">{item.bookings} bookings</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Top Performing Providers */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Top Rated Specialists</h3>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {adminStats.top_providers?.map((p) => (
                          <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.business_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.total_ratings} reviews</div>
                            </div>
                            <span style={{ fontWeight: 700, color: '#b45309' }}>⭐ {p.rating}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SERVICE MANAGEMENT (APPROVAL / REJECTION) */}
              {activeTab === 'services' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Provider Service Approval & Moderation</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Review services submitted by providers. Only approved services appear in the marketplace.
                      </p>
                    </div>

                    {/* Filter buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            setAdminServiceFilter(st);
                            api.get('/admin/services', { status_filter: st }).then(setAdminServices);
                          }}
                          className={`btn btn-sm ${adminServiceFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {adminServices.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                      <p style={{ color: 'var(--text-muted)' }}>No provider services match the filter "{adminServiceFilter}".</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {adminServices.map((ps) => (
                        <div key={ps.id} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                                <h3 style={{ fontSize: '1.15rem' }}>{ps.service_name}</h3>
                                <span className={`badge ${
                                  ps.status === 'APPROVED' ? 'badge-success' :
                                  ps.status === 'PENDING' ? 'badge-warning' : 'badge-danger'
                                }`}>
                                  {ps.status}
                                </span>
                                {!ps.is_active && (
                                  <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                    INACTIVE
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Offered by: <strong>{ps.provider_business}</strong> ({ps.provider_name}) • {ps.category_name} • ₹{ps.price} base price
                              </div>

                              {ps.description && (
                                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.5rem', maxWidth: '750px' }}>
                                  {ps.description}
                                </p>
                              )}

                              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span>📍 {ps.service_location} ({ps.service_radius_km} km radius)</span>
                                <span>🕒 {ps.availability}</span>
                                <span>⭐ {ps.experience}</span>
                              </div>

                              {ps.rejection_reason && (
                                <div style={{ marginTop: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', color: '#991b1b', fontSize: '0.8rem' }}>
                                  <strong>Rejection Reason:</strong> {ps.rejection_reason}
                                </div>
                              )}
                            </div>

                            {/* Approval Action Controls */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
                              {ps.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleApproveService(ps.id)}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    <Check size={14} />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectService(ps.id)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    <X size={14} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {ps.status === 'APPROVED' && (
                                <button
                                  onClick={() => handleRejectService(ps.id)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#dc2626' }}
                                >
                                  Revoke / Reject
                                </button>
                              )}

                              {ps.status === 'REJECTED' && (
                                <button
                                  onClick={() => handleApproveService(ps.id)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#059669' }}
                                >
                                  Re-Approve
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleAdminServiceActive(ps.id)}
                                className="btn btn-secondary btn-sm"
                              >
                                {ps.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="card">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>User Management</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Email</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Bookings</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{u.full_name}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{u.email}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className="badge badge-primary">{u.role}</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                                {u.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{u.total_bookings}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              {u.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleToggleUserActive(u.id, u.is_active)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: PROVIDER MANAGEMENT */}
              {activeTab === 'providers' && (
                <div className="card">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Registered Specialists & Providers</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Business / Name</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Address</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Rating</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Services</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Verified</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Availability</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminProviders.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <div style={{ fontWeight: 600 }}>{p.business_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.name} ({p.email})</div>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>{p.address}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#b45309' }}>⭐ {p.rating_avg}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className="badge badge-primary">{p.approved_services} live / {p.total_services} total</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className={`badge ${p.is_verified ? 'badge-success' : 'badge-danger'}`}>
                                {p.is_verified ? 'Verified' : 'Unverified'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: p.is_available ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                {p.is_available ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <button
                                onClick={() => handleToggleProviderVerify(p.id, p.is_verified)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                {p.is_verified ? 'Unverify' : 'Verify'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: BOOKING MANAGEMENT */}
              {activeTab === 'bookings' && (
                <div className="card">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Marketplace Bookings & Moderation</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Ref</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Customer</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Provider</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Service</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Slot</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminBookings.map((b) => (
                          <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>{b.reference}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <div>{b.customer_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer_email}</div>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{b.provider_business}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{b.service_name}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>{b.date} • {b.time}</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>₹{b.amount}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className={`badge ${
                                b.status === 'ACCEPTED' ? 'badge-success' :
                                b.status === 'PENDING' ? 'badge-warning' :
                                b.status === 'COMPLETED' ? 'badge-primary' : 'badge-danger'
                              }`}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                <button
                                  onClick={() => handleAdminCancelBooking(b.id)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#dc2626', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Cancel & Notify
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: REVIEWS */}
              {activeTab === 'reviews' && (
                <div className="card">
                  <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Customer Reviews Moderation</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {adminReviews.map((r) => (
                      <div key={r.id} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <strong>{r.user_name}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>reviewed</span>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.provider_name}</span>
                            <span className="badge badge-primary">{r.sentiment}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>"{r.review_text}"</p>
                        </div>
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#dc2626' }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. PROVIDER PORTAL PANELS (Requirement 1 & 2)            */}
          {/* ======================================================== */}
          {isProvider && (
            <div>
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Total Service Requests</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem' }}>{providerBookings.length}</div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Pending Acceptance</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#f59e0b' }}>
                        {providerBookings.filter((b) => b.status === 'PENDING').length}
                      </div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Approved Live Services</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#10b981' }}>
                        {myServices.filter((s) => s.status === 'APPROVED').length}
                      </div>
                    </div>
                    <div className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Pending Admin Review</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem', color: '#f59e0b' }}>
                        {myServices.filter((s) => s.status === 'PENDING').length}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action: Publish Service Banner */}
                  <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                    border: '1px solid #bfdbfe',
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Publish Your Real Services</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        Add services with your custom pricing, service location, radius, and availability.
                      </p>
                    </div>
                    <button onClick={() => switchTab('services')} className="btn btn-primary">
                      <Plus size={16} />
                      <span>Add / Manage Services</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: MY SERVICES (PUBLISH & STATUS) */}
              {activeTab === 'services' && (
                <div>
                  {/* PUBLISH REAL SERVICE FORM (Requirement 1) */}
                  <div className="card" style={{ padding: '1.75rem', marginBottom: '2rem', borderTop: '4px solid var(--primary)' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Plus size={18} color="var(--primary)" />
                      <span>Publish a New Service</span>
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      Enter your service details. After submission, your service will be reviewed and approved by the marketplace administrator.
                    </p>

                    {pubMsg && (
                      <div style={{ padding: '0.85rem 1rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', color: '#166534', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                        {pubMsg}
                      </div>
                    )}

                    <form onSubmit={handlePublishService} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Service Category
                        </label>
                        <select
                          value={pubCategory}
                          onChange={(e) => setPubCategory(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        >
                          <option value="">Select Category...</option>
                          {allCategories.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Service Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. AC Repair, Bathroom Plumbing, Jet Wash..."
                          value={pubServiceName}
                          onChange={(e) => setPubServiceName(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Base / Starting Price (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          min="50"
                          placeholder="e.g. 550"
                          value={pubPrice}
                          onChange={(e) => setPubPrice(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Experience & Specialization
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 6 years experience, certified HVAC"
                          value={pubExp}
                          onChange={(e) => setPubExp(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Service Location (City / Area)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Koramangala, Sector 4, Indiranagar"
                          value={pubLocation}
                          onChange={(e) => setPubLocation(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Service Radius (km)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={pubRadius}
                          onChange={(e) => setPubRadius(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Availability Schedule
                        </label>
                        <input
                          type="text"
                          value={pubAvailability}
                          onChange={(e) => setPubAvailability(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Service Description & Scope
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Describe the exact diagnostics, repairs, or service procedures included..."
                          value={pubDesc}
                          onChange={(e) => setPubDesc(e.target.value)}
                          className="form-input"
                          style={{ width: '100%', padding: '0.65rem' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                        <button
                          type="submit"
                          disabled={pubSubmitting}
                          className="btn btn-primary"
                          style={{ padding: '0.65rem 1.75rem' }}
                        >
                          {pubSubmitting ? 'Submitting Service...' : 'Submit Service for Admin Approval'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* MY PUBLISHED SERVICES LIST */}
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>My Published Services ({myServices.length})</h3>
                    {myServices.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>You have not published any services yet. Use the form above to add your first service.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {myServices.map((s) => (
                          <div key={s.id} style={{
                            padding: '1.25rem',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            background: s.status === 'APPROVED' ? '#ffffff' : '#fafafa'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <h4 style={{ fontSize: '1.1rem', margin: 0 }}>{s.service_name}</h4>
                                <span className={`badge ${
                                  s.status === 'APPROVED' ? 'badge-success' :
                                  s.status === 'PENDING' ? 'badge-warning' : 'badge-danger'
                                }`}>
                                  {s.status}
                                </span>
                                {!s.is_active && (
                                  <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                    PAUSED
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                {s.category_name} • ₹{s.base_price} • {s.service_location} ({s.service_radius} km)
                              </div>
                              {s.description && (
                                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.35rem', maxWidth: '650px' }}>
                                  {s.description}
                                </p>
                              )}
                              {s.rejection_reason && (
                                <div style={{ fontSize: '0.8rem', color: '#dc2626', background: '#fef2f2', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                                  <strong>Admin Feedback:</strong> {s.rejection_reason}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleToggleMyServiceActive(s.id)}
                                className="btn btn-secondary btn-sm"
                              >
                                {s.is_active ? 'Pause Offering' : 'Activate Offering'}
                              </button>
                              <button
                                onClick={() => handleDeleteMyService(s.id)}
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#dc2626' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: BOOKINGS (ACCEPT / REJECT) */}
              {activeTab === 'bookings' && (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Incoming Service Requests ({providerBookings.length})</h3>
                  {providerBookings.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No customer service requests received yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {providerBookings.map((b) => (
                        <div key={b.id} style={{
                          padding: '1.25rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{b.service_name}</span>
                              <span className={`badge ${
                                b.status === 'ACCEPTED' ? 'badge-success' :
                                b.status === 'PENDING' ? 'badge-warning' :
                                b.status === 'COMPLETED' ? 'badge-primary' : 'badge-danger'
                              }`}>
                                {b.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Customer: <strong>{b.user_name}</strong> {b.user_email && `(${b.user_email})`} {b.user_phone && `• ${b.user_phone}`}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.35rem' }}>
                              📍 {b.service_address} • 📅 {b.booking_date} at {b.booking_time}
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--secondary)' }}>
                              Total Booking Value: ₹{b.total_amount}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {b.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleProviderBookingStatusChange(b.id, 'ACCEPTED')}
                                  className="btn btn-primary btn-sm"
                                  style={{ background: '#059669', borderColor: '#059669' }}
                                >
                                  Accept & Confirm
                                </button>
                                <button
                                  onClick={() => handleProviderBookingStatusChange(b.id, 'REJECTED')}
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#dc2626' }}
                                >
                                  Reject Request
                                </button>
                              </>
                            )}

                            {b.status === 'ACCEPTED' && (
                              <>
                                <button
                                  onClick={() => handleProviderBookingStatusChange(b.id, 'IN_PROGRESS')}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Start Job
                                </button>
                                <button
                                  onClick={() => handleProviderBookingStatusChange(b.id, 'COMPLETED')}
                                  className="btn btn-primary btn-sm"
                                  style={{ background: '#059669', borderColor: '#059669' }}
                                >
                                  Mark Completed
                                </button>
                              </>
                            )}

                            {b.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleProviderBookingStatusChange(b.id, 'COMPLETED')}
                                className="btn btn-primary btn-sm"
                                style={{ background: '#059669', borderColor: '#059669' }}
                              >
                                Mark Completed
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PROFILE */}
              {activeTab === 'profile' && (
                <div className="card" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Specialist Profile & Work Area</h3>
                  <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Business / Trade Name
                      </label>
                      <input
                        type="text"
                        value={editBusinessName}
                        onChange={(e) => setEditBusinessName(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.65rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editExperienceYears}
                        onChange={(e) => setEditExperienceYears(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.65rem' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Primary Workshop / Dispatch Address
                      </label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.65rem' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Professional Bio & Credentials
                      </label>
                      <textarea
                        rows={3}
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.65rem' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <button type="submit" disabled={savingProfile} className="btn btn-primary">
                        {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. CUSTOMER PORTAL PANELS (Requirement 11)               */}
          {/* ======================================================== */}
          {!isAdmin && !isProvider && (
            activeTab === 'profile' ? (
              <div className="customer-profile-layout">
                <section className="card customer-profile-summary">
                  <div className="customer-profile-avatar">{user.full_name?.[0]?.toUpperCase() || 'U'}</div>
                  <h2>{user.full_name}</h2>
                  <p>{user.email}</p>
                  <span className="badge badge-primary">Customer account</span>
                  <div className="customer-profile-location">
                    <MapPin size={17} />
                    <span>{savedUserLocation?.address_line || 'Add a service location to get nearby recommendations.'}</span>
                  </div>
                  <div className="customer-profile-stat">
                    <CalendarCheck size={17} />
                    <span>{userBookings.length} service booking{userBookings.length === 1 ? '' : 's'}</span>
                  </div>
                </section>

                <section className="card customer-profile-editor">
                  <div className="customer-profile-editor-heading">
                    <div>
                      <span className="customer-profile-kicker">Account settings</span>
                      <h2>Personal details</h2>
                      <p>Keep your contact details and usual service area ready for your next search.</p>
                    </div>
                    <MapPin size={23} color="var(--primary)" />
                  </div>

                  <form onSubmit={handleSaveCustomerProfile} className="customer-profile-form">
                    <div>
                      <label htmlFor="profile-full-name">Full name</label>
                      <input id="profile-full-name" value={editUserName} onChange={(event) => setEditUserName(event.target.value)} required minLength={2} />
                    </div>
                    <div>
                      <label htmlFor="profile-email">Email address</label>
                      <input id="profile-email" type="email" value={user.email} disabled />
                    </div>
                    <div>
                      <label htmlFor="profile-phone">Mobile number</label>
                      <input id="profile-phone" type="tel" value={editUserPhone} onChange={(event) => setEditUserPhone(event.target.value)} placeholder="Add a contact number" />
                    </div>
                    <div>
                      <label htmlFor="profile-location">Usual service location</label>
                      <input
                        id="profile-location"
                        value={editUserLocation}
                        onChange={(event) => setEditUserLocation(event.target.value)}
                        placeholder="City or neighborhood"
                        required
                      />
                      <span className="customer-profile-hint">We use this location to match nearby providers. You can change it any time.</span>
                    </div>
                    {userProfileMessage && <div className="customer-profile-message" role="status">{userProfileMessage}</div>}
                    <div className="customer-profile-form-actions">
                      <button type="submit" disabled={savingUserProfile} className="btn btn-primary">
                        {savingUserProfile ? 'Saving profile...' : 'Save profile'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : (
            <div className="card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.3rem' }}>My Service Bookings ({userBookings.length})</h3>
                <Link to="/discover" className="btn btn-primary btn-sm">
                  Find & Book Services
                </Link>
              </div>

              {userBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <p>You have not made any service bookings yet.</p>
                  <Link to="/discover" className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                    Discover Services
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {userBookings.map((b) => (
                    <div key={b.id} style={{
                      padding: '1.25rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{b.service_name}</span>
                          <span className={`badge ${
                            b.status === 'ACCEPTED' ? 'badge-success' :
                            b.status === 'PENDING' ? 'badge-warning' :
                            b.status === 'COMPLETED' ? 'badge-primary' : 'badge-danger'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Provider: <strong>{b.provider_name}</strong> • Ref: #{b.booking_reference}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                          📍 {b.service_address} • 📅 {b.booking_date} at {b.booking_time}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--secondary)' }}>
                          Total: ₹{b.total_amount}
                        </div>
                      </div>

                      <div>
                        {b.status === 'PENDING' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Cancel this booking request?')) {
                                await api.patch(`/bookings/${b.id}/status`, { status: 'CANCELLED' });
                                loadDashboardData();
                              }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#dc2626' }}
                          >
                            Cancel Request
                          </button>
                        )}
                        {b.status === 'COMPLETED' && !b.has_review && (
                          <Link to={`/providers/${b.provider_id}?review=true&booking_id=${b.id}`} className="btn btn-primary btn-sm">
                            Rate & Review
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          )}
        </>
      )}
    </div>
  );
}
