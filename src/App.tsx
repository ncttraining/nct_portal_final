import { useState } from 'react';
import { AlertCircle, Shield, Calendar, GraduationCap, Users, Mail, Tag, MapPin, Building, Award, BookOpen, FileText, ArrowRight, UserCog, Inbox, CalendarClock, DoorOpen, CalendarDays } from 'lucide-react';
import PageHeader from './components/PageHeader';
import TrainerMap from './pages/TrainerMap';
import TrainerTypes from './pages/TrainerTypes';
import EmailTemplates from './pages/EmailTemplates';
import EmailQueueManagement from './pages/EmailQueueManagement';
import UserManagement from './pages/UserManagement';
import TrainerManagement from './pages/TrainerManagement';
import CourseBooking from './pages/CourseBooking';
import ClientManagement from './pages/ClientManagement';
import CertificateTemplates from './pages/CertificateTemplates';
import ViewIssueCertificates from './pages/ViewIssueCertificates';
import CourseTypesManager from './pages/CourseTypesManager';
import BookingsViewer from './pages/BookingsViewer';
import CandidatesManagement from './pages/CandidatesManagement';
import TrainerExpenses from './pages/TrainerExpenses';
import TrainerCalendar from './pages/TrainerCalendar';
import TrainerAvailability from './pages/TrainerAvailability';
import CentreManagement from './pages/CentreManagement';
import OpenCoursesDashboard from './pages/OpenCoursesDashboard';
import EditProfile from './components/EditProfile';
import { useAuth } from './contexts/AuthContext';

type PageType = 'home' | 'administration' | 'bookings-management' | 'course-management' | 'trainer-map' | 'trainer-types' | 'email-templates' | 'email-queue' | 'user-management' | 'trainer-management' | 'course-booking' | 'candidates-management' | 'client-management' | 'certificate-templates' | 'certificates' | 'course-types' | 'bookings-viewer' | 'trainer-expenses' | 'trainer-availability' | 'centre-management' | 'open-courses';

function App() {
  const { profile, reloadProfile } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [showEditProfile, setShowEditProfile] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const canManageBookings = isAdmin || profile?.can_manage_bookings;
  const canManageCourses = isAdmin || profile?.can_manage_courses;
  const canViewBookings = isAdmin || profile?.can_view_bookings;
  const canManageExpenses = isAdmin || profile?.can_manage_expenses;

  function hasAccess(page: string): boolean {
    switch (page) {
      case 'user-management':
      case 'trainer-management':
      case 'email-templates':
      case 'email-queue':
      case 'trainer-types':
      case 'trainer-availability':
        return isAdmin;
      case 'course-booking':
      case 'candidates-management':
      case 'trainer-map':
      case 'client-management':
      case 'centre-management':
      case 'open-courses':
        return canManageBookings;
      case 'certificate-templates':
      case 'certificates':
      case 'course-types':
        return canManageCourses;
      case 'bookings-viewer':
        return canViewBookings;
      case 'trainer-expenses':
        return canManageExpenses;
      default:
        return true;
    }
  }

  function handleNavigate(page: string) {
    if (page === 'home' || hasAccess(page)) {
      setCurrentPage(page as PageType);
    }
  }

  // Check for page access
  if (currentPage !== 'home' && currentPage !== 'administration' && currentPage !== 'bookings-management' && currentPage !== 'course-management') {
    if (!hasAccess(currentPage)) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-slate-400 mb-6">
              You do not have permission to access this page.
            </p>
            <button
              onClick={() => setCurrentPage('home')}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    // Render individual pages
    let pageContent = null;
    switch (currentPage) {
      case 'trainer-map':
        pageContent = <TrainerMap currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'trainer-types':
        pageContent = <TrainerTypes currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'email-templates':
        pageContent = <EmailTemplates currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'email-queue':
        pageContent = <EmailQueueManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'user-management':
        pageContent = <UserManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'trainer-management':
        pageContent = <TrainerManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'course-booking':
        pageContent = <CourseBooking currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'candidates-management':
        pageContent = <CandidatesManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'client-management':
        pageContent = <ClientManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'certificate-templates':
        pageContent = <CertificateTemplates currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'certificates':
        pageContent = <ViewIssueCertificates currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'course-types':
        pageContent = <CourseTypesManager currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'bookings-viewer':
        pageContent = <BookingsViewer currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'trainer-expenses':
        pageContent = <TrainerExpenses currentPage={currentPage} onNavigate={handleNavigate} userRole={profile?.role || 'user'} canManageBookings={canManageBookings} canManageExpenses={canManageExpenses} />;
        break;
      case 'trainer-availability':
        pageContent = <TrainerAvailability currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'centre-management':
        pageContent = <CentreManagement currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
      case 'open-courses':
        pageContent = <OpenCoursesDashboard currentPage={currentPage} onNavigate={handleNavigate} />;
        break;
    }

    if (pageContent) {
      return (
        <>
          {pageContent}
          {showEditProfile && profile && (
            <EditProfile
              profile={{
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }}
              onClose={() => setShowEditProfile(false)}
              onUpdate={reloadProfile}
            />
          )}
        </>
      );
    }
  }

  // Render section cards view
  if (currentPage === 'administration' || currentPage === 'bookings-management' || currentPage === 'course-management') {
    let sectionTitle = '';
    let sectionDescription = '';
    let sectionIcon: React.ElementType = Shield;
    let cards: Array<{ id: string; title: string; description: string; icon: React.ElementType }> = [];

    if (currentPage === 'administration' && isAdmin) {
      sectionTitle = 'Administration';
      sectionDescription = 'Manage trainers, users, email templates, and trainer types';
      sectionIcon = Shield;
      cards = [
        {
          id: 'trainer-management',
          title: 'Trainer Management',
          description: 'Add and manage trainer accounts and portal access',
          icon: UserCog,
        },
        {
          id: 'user-management',
          title: 'User Management',
          description: 'Manage user accounts and permissions',
          icon: Users,
        },
        {
          id: 'trainer-availability',
          title: 'Trainer Availability',
          description: 'Manage trainer availability and time off',
          icon: CalendarClock,
        },
        {
          id: 'email-templates',
          title: 'Email Templates',
          description: 'Create and manage email templates',
          icon: Mail,
        },
        {
          id: 'email-queue',
          title: 'Email Queue',
          description: 'Monitor and manage email delivery queue',
          icon: Inbox,
        },
        {
          id: 'trainer-types',
          title: 'Trainer Type Manager',
          description: 'Configure trainer types and attributes',
          icon: Tag,
        },
      ];
    } else if (currentPage === 'bookings-management' && canManageBookings) {
      sectionTitle = 'Bookings Management';
      sectionDescription = 'Manage course bookings, trainers, and clients';
      sectionIcon = Calendar;
      cards = [
        {
          id: 'course-booking',
          title: 'Course Booking & Scheduling',
          description: 'Schedule and manage course bookings',
          icon: BookOpen,
        },
        {
          id: 'open-courses',
          title: 'Open Courses Dashboard',
          description: 'Manage public course sessions and delegates',
          icon: CalendarDays,
        },
        {
          id: 'candidates-management',
          title: 'Candidates',
          description: 'Manage candidates and track certificates',
          icon: Users,
        },
        {
          id: 'trainer-map',
          title: 'Trainer Map',
          description: 'View and manage trainer locations',
          icon: MapPin,
        },
        {
          id: 'client-management',
          title: 'Clients',
          description: 'Manage client information and locations',
          icon: Building,
        },
        {
          id: 'centre-management',
          title: 'Centre Management',
          description: 'Manage in-centre training locations and rooms',
          icon: DoorOpen,
        },
      ];
    } else if (currentPage === 'course-management' && canManageCourses) {
      sectionTitle = 'Course Management';
      sectionDescription = 'Manage course types, certificates, and templates';
      sectionIcon = GraduationCap;
      cards = [
        {
          id: 'certificate-templates',
          title: 'Certificate Templates',
          description: 'Design and manage certificate templates',
          icon: Award,
        },
        {
          id: 'course-types',
          title: 'Course Types Manager',
          description: 'Configure course types and settings',
          icon: FileText,
        },
        {
          id: 'certificates',
          title: 'View / Issue Certificates',
          description: 'Issue and manage certificates',
          icon: Award,
        },
      ];
    }

    const SectionIcon = sectionIcon;

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <PageHeader
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onEditProfile={() => setShowEditProfile(true)}
        />

        {showEditProfile && profile && (
          <EditProfile
            profile={{
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            }}
            onClose={() => setShowEditProfile(false)}
            onUpdate={reloadProfile}
          />
        )}

        {/* Section Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <SectionIcon className="w-8 h-8 text-blue-400" />
              <h2 className="text-2xl font-semibold">{sectionTitle}</h2>
            </div>
            <p className="text-slate-400">{sectionDescription}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((card) => {
              const CardIcon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => handleNavigate(card.id)}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-left hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                      <CardIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                  <p className="text-sm text-slate-400">{card.description}</p>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Show calendar for trainers
  if (profile?.is_trainer && profile?.trainer_id) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <PageHeader
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onEditProfile={() => setShowEditProfile(true)}
        />

        {showEditProfile && profile && (
          <EditProfile
            profile={{
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            }}
            onClose={() => setShowEditProfile(false)}
            onUpdate={reloadProfile}
          />
        )}

        <TrainerCalendar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onEditProfile={() => setShowEditProfile(true)}
      />

      {showEditProfile && profile && (
        <EditProfile
          profile={{
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }}
          onClose={() => setShowEditProfile(false)}
          onUpdate={reloadProfile}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Portal Home Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">PORTAL HOME</h2>
          <p className="text-slate-400">
            Welcome to the National Compliance Training portal. Use the navigation menu above to access different areas of the system.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Access Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">System Status</h3>
              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
                All Systems Operational
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Database</span>
                <span className="text-green-400">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Authentication</span>
                <span className="text-green-400">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Storage</span>
                <span className="text-green-400">Available</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Your Permissions</h3>
            <div className="space-y-2 text-sm">
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-slate-300">Full Administrative Access</span>
                </div>
              )}
              {canManageBookings && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="text-slate-300">Bookings Management</span>
                </div>
              )}
              {canManageCourses && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span className="text-slate-300">Course Management</span>
                </div>
              )}
              {canViewBookings && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <span className="text-slate-300">View Bookings</span>
                </div>
              )}
              {!isAdmin && !canManageBookings && !canManageCourses && !canViewBookings && (
                <div className="text-slate-400">
                  Contact your administrator for access permissions.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Today's Focus</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div>Trainer coverage</div>
              <div>Insurance expiry</div>
              <div>DCPC registers</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-slate-500">
          NCT Portal - Version 1.1
        </div>
      </main>
    </div>
  );
}

export default App;
